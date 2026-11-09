// End-to-end simulation of the connector's PATCH upload against a model of the Supabase server.
// Mirrors platform.native.ts uploadData: UPDATE ... WHERE id = ? AND version = previousVersion;
// on no match, read the row and either skip (already applied) or log a conflict.
// The server model reproduces the audit trigger (version := old.version + 1, updated_at rewritten).
import assert from 'node:assert/strict';
import test from 'node:test';
import { conflictAlreadyApplied, patchAlreadyApplied, sanitizePatch } from '../src/data/powersync/stale-patch.ts';

function makeServer(rows) {
  const table = new Map(rows.map((row) => [row.id, { ...row }]));
  let clock = 0;
  return {
    table,
    // Supabase .update(patch).eq('id').eq('version', prev). Returns the row or null.
    update(id, patch, previousVersion) {
      const row = table.get(id);
      if (!row || row.version !== previousVersion) return null;
      Object.assign(row, patch, { version: row.version + 1, updated_at: `2026-10-19T21:11:${String(++clock).padStart(2, '0')}.000+00:00` });
      return row;
    },
    read(id) { const row = table.get(id); return row ? { ...row } : null; },
  };
}

// One local edit = one PowerSync PATCH CrudEntry. The client increments version locally,
// so previousValues.version is the version the edit was based on.
function edit(local, id, changes) {
  const row = local.get(id);
  const op = { id, opData: { ...changes, updated_at: new Date(0).toISOString(), version: row.version + 1 }, previousValues: { version: row.version } };
  Object.assign(row, changes, { version: row.version + 1 });
  return op;
}

// uploadData for one CRUD transaction. `dropAfter` simulates the connection dying after N ops
// reached the server (the SDK then retries the whole transaction because complete() never ran).
function uploadTransaction(server, ops, conflicts, { fixed, dropAfter = Infinity }) {
  let sent = 0;
  for (const op of ops) {
    if (sent === dropAfter) throw new Error('network dropped');
    const patch = sanitizePatch(op.opData);
    const updated = server.update(op.id, patch, op.previousValues.version);
    sent += 1;
    if (updated) continue;
    const current = server.read(op.id);
    if (fixed && patchAlreadyApplied(patch, current)) continue;
    conflicts.push({ id: op.id, local_payload: JSON.stringify(op.opData), remote_payload: JSON.stringify(current) });
  }
}

function runUpload(server, transactions, options) {
  const conflicts = [];
  for (const ops of transactions) {
    let attempt = 0;
    for (;;) {
      try {
        uploadTransaction(server, ops, conflicts, { ...options, dropAfter: attempt === 0 ? options.dropAfter : Infinity });
        break; // transaction.complete()
      } catch {
        attempt += 1; // SDK delayRetry, then the same transaction is uploaded again
      }
    }
  }
  return conflicts;
}

function milkFarm(count) {
  const rows = Array.from({ length: count }, (_, index) => ({ id: `entry-${index}`, volume_ml: 8000 + index, updated_at: '2026-10-18T06:00:00.000+00:00', version: 3 }));
  return { server: makeServer(rows), local: new Map(rows.map((row) => [row.id, { ...row }])) };
}

test('BEFORE the fix: a dropped connection mid-save logs every already-uploaded row as a conflict', () => {
  const { server, local } = milkFarm(30);
  const save = [...local.keys()].map((id, index) => edit(local, id, { volume_ml: 10000 + index }));
  const conflicts = runUpload(server, [save], { fixed: false, dropAfter: 20 });
  assert.equal(conflicts.length, 20);
  // ...yet the server holds every value the phone saved: nothing was actually lost.
  save.forEach((op) => assert.equal(server.read(op.id).volume_ml, op.opData.volume_ml));
});

test('AFTER the fix: the same dropped connection logs zero conflicts and all data is on the server', () => {
  const { server, local } = milkFarm(30);
  const save = [...local.keys()].map((id, index) => edit(local, id, { volume_ml: 10000 + index }));
  const conflicts = runUpload(server, [save], { fixed: true, dropAfter: 20 });
  assert.equal(conflicts.length, 0);
  save.forEach((op) => assert.equal(server.read(op.id).volume_ml, op.opData.volume_ml));
});

test('AFTER the fix: unchanged auto-save rows (timestamp-only patch) replay cleanly', () => {
  const { server, local } = milkFarm(10);
  const save = [...local.keys()].map((id) => edit(local, id, {}));
  assert.equal(runUpload(server, [save], { fixed: true, dropAfter: 6 }).length, 0);
});

test('AFTER the fix: several queued saves to the same rows, dropping mid-way, stay conflict-free', () => {
  const { server, local } = milkFarm(15);
  const ids = [...local.keys()];
  const saves = [1, 2, 3].map((round) => ids.map((id, index) => edit(local, id, { volume_ml: round * 1000 + index })));
  assert.equal(runUpload(server, saves, { fixed: true, dropAfter: 7 }).length, 0);
  ids.forEach((id, index) => assert.equal(server.read(id).volume_ml, 3000 + index));
});

test('AFTER the fix: a genuine edit from another device is still reported, never hidden', () => {
  const { server, local } = milkFarm(3);
  server.update('entry-1', { volume_ml: 5555 }, 3); // other device wins first
  const save = [...local.keys()].map((id, index) => edit(local, id, { volume_ml: 10000 + index }));
  const conflicts = runUpload(server, [save], { fixed: true });
  assert.deepEqual(conflicts.map((conflict) => conflict.id), ['entry-1']);
  assert.equal(server.read('entry-1').volume_ml, 5555);
});

test('backlog cleanup: old replay conflicts resolve from the saved snapshot even after later edits', () => {
  const { server, local } = milkFarm(30);
  const save = [...local.keys()].map((id, index) => edit(local, id, { volume_ml: 10000 + index }));
  const backlog = runUpload(server, [save], { fixed: false, dropAfter: 20 }); // the old 105-style list
  // Days later the user edits the same rows again, so the current server values differ.
  [...local.keys()].forEach((id) => server.update(id, { volume_ml: 1 }, server.read(id).version));
  const unresolved = backlog.filter((row) => !conflictAlreadyApplied(row.local_payload, row.remote_payload, server.read(row.id)));
  assert.equal(unresolved.length, 0);
});

test('backlog cleanup: a genuine conflict stays visible', () => {
  const { server, local } = milkFarm(2);
  server.update('entry-0', { volume_ml: 4444 }, 3);
  const save = [edit(local, 'entry-0', { volume_ml: 9999 })];
  const backlog = runUpload(server, [save], { fixed: false });
  assert.equal(backlog.length, 1);
  assert.equal(conflictAlreadyApplied(backlog[0].local_payload, backlog[0].remote_payload, server.read('entry-0')), false);
});

test('backlog cleanup: unreadable payloads are left visible', () => {
  assert.equal(conflictAlreadyApplied(null, null, null), false);
  assert.equal(conflictAlreadyApplied('not json', '{}', {}), false);
});
