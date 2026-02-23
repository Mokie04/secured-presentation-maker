// Simple in-memory one-time token cache (clears on cold start). For production, replace with Redis.

const seen = new Set<string>();

// Expire entries after ttlMs. We store expiry timestamps and sweep lazily.
const expiries: Record<string, number> = {};

function sweep(now: number) {
  for (const [jti, exp] of Object.entries(expiries)) {
    if (exp <= now) {
      seen.delete(jti);
      delete expiries[jti];
    }
  }
}

export function markJtiUsed(jti: string, ttlSeconds: number): void {
  const now = Date.now();
  const exp = now + Math.max(1000, ttlSeconds * 1000);
  seen.add(jti);
  expiries[jti] = exp;
  if (seen.size > 1000) sweep(now);
}

export function isJtiUsed(jti: string): boolean {
  const now = Date.now();
  sweep(now);
  return seen.has(jti);
}
