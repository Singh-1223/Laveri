// Pure helpers (no React Native imports) so the stale-edit logic can be unit tested with node.

// Columns the server trigger rewrites on every update, so they never match the client's value.
const SERVER_OWNED_PATCH_COLUMNS = new Set(['updated_at', 'updated_by']);
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function sameValue(local: unknown, remote: unknown): boolean {
  const left = local ?? null;
  const right = remote ?? null;
  if (left === null || right === null) return left === right;
  if (typeof left === 'string' && typeof right === 'string') {
    if (left === right) return true;
    if (ISO_TIMESTAMP.test(left) && ISO_TIMESTAMP.test(right)) {
      const a = Date.parse(left);
      const b = Date.parse(right);
      return Number.isFinite(a) && a === b;
    }
    return false;
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') return Number(left) === Number(right);
  if (typeof left === 'number' || typeof right === 'number') return Number(left) === Number(right);
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * True when the server row already holds every value this PATCH would write. That happens when
 * an upload batch is retried after a dropped connection: the first attempt reached the server
 * and bumped its version, so the replay looks "stale" even though nothing is actually lost.
 * A patch that only touches server-owned columns (e.g. an auto-save that changed nothing but
 * `updated_at`) carries no data, so dropping it can never lose anything and it counts as applied.
 * Any differing data value is NOT treated as applied and is surfaced as a conflict.
 */
export function patchAlreadyApplied(patch: Record<string, unknown>, remote: Record<string, unknown> | null | undefined) {
  if (!remote) return false;
  const keys = Object.keys(patch).filter((key) => !SERVER_OWNED_PATCH_COLUMNS.has(key));
  return keys.every((key) => sameValue(patch[key], remote[key]));
}

// Columns the client never sends in a patch (stripped before upload), so they are ignored here too.
const IMMUTABLE_PATCH_COLUMNS = new Set(['id', 'farm_id', 'created_at', 'created_by', 'version']);

export function sanitizePatch(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !IMMUTABLE_PATCH_COLUMNS.has(key)));
}

function parseObject(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Decides whether an already-logged stale conflict was really a replay of an edit that had
 * already reached the server.
 * 1. `remotePayloadJson` is the server row captured at the moment the conflict was logged. If
 *    that snapshot already held the edit, it was applied — unaffected by later edits to the row.
 * 2. Otherwise fall back to the current server row (if provided).
 * Returns false when the local payload is missing or unreadable, so such conflicts stay visible.
 */
export function conflictAlreadyApplied(
  localPayloadJson: string | null | undefined,
  remotePayloadJson: string | null | undefined,
  currentRemote?: Record<string, unknown> | null,
) {
  const local = parseObject(localPayloadJson);
  if (!local) return false;
  const patch = sanitizePatch(local);
  if (patchAlreadyApplied(patch, parseObject(remotePayloadJson))) return true;
  return patchAlreadyApplied(patch, currentRemote);
}
