import { requireSupabase } from './client';

const CACHE_LIFETIME_MS = 9 * 60 * 1_000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function cacheKey(bucket: string, storagePath: string) {
  return `${bucket}:${storagePath}`;
}

/**
 * Reuses a signed Storage URL for nine minutes. Supabase URLs are issued for
 * ten minutes, leaving a buffer so the app refreshes them before expiry.
 */
export async function getCachedSignedUrl(bucket: string, storagePath: string) {
  const key = cacheKey(bucket, storagePath);
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) return null;

  signedUrlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + CACHE_LIFETIME_MS });
  return data.signedUrl;
}

export function invalidateCachedSignedUrl(bucket: string, storagePath: string) {
  signedUrlCache.delete(cacheKey(bucket, storagePath));
}
