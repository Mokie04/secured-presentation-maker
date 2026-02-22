import crypto from 'crypto';

export type AppstoreSessionClaims = {
  sub: string;
  exp: number;
  iat?: number;
  email?: string;
  role?: string;
};

const SESSION_COOKIE_NAME = 'spm_session';

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function signPayload(payloadB64: string, secret: string): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest();
  return base64UrlEncode(digest);
}

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function isAppstoreAuthEnabled(): boolean {
  return process.env.APPSTORE_AUTH_ENABLED === 'true';
}

export function getAllowedClockSkewSeconds(): number {
  const raw = parseIntEnv(process.env.APPSTORE_ALLOWED_CLOCK_SKEW_SECONDS, 20);
  return Math.max(0, Math.min(120, raw));
}

export function getMaxTokenTtlSeconds(): number {
  const raw = parseIntEnv(process.env.APPSTORE_MAX_TOKEN_TTL_SECONDS, 900);
  return Math.max(30, Math.min(3600, raw));
}

export function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('=') || '');
    }
  }
  return null;
}

export function verifyAppstoreAccessToken(
  token: string | null | undefined,
  secret: string
): AppstoreSessionClaims | null {
  if (!token || !secret) return null;

  const trimmed = token.trim();
  const [payloadB64, signatureB64, ...rest] = trimmed.split('.');
  if (!payloadB64 || !signatureB64 || rest.length > 0) return null;

  const expectedSignature = signPayload(payloadB64, secret);
  if (!safeEqualString(signatureB64, expectedSignature)) return null;

  try {
    const payloadRaw = base64UrlDecode(payloadB64).toString('utf8');
    const payload = JSON.parse(payloadRaw) as Partial<AppstoreSessionClaims>;
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) return null;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const skewSec = getAllowedClockSkewSeconds();
    const maxTokenTtl = getMaxTokenTtlSeconds();

    // Allow short clock drift between issuer and verifier.
    if (payload.exp + skewSec <= nowSec) return null;

    if (typeof payload.iat === 'number') {
      if (!Number.isFinite(payload.iat)) return null;
      if (payload.iat > nowSec + skewSec) return null;
      if (payload.exp + skewSec < payload.iat) return null;
    }

    // Prevent accidentally minting very long-lived handoff tokens.
    const iatForTtl = typeof payload.iat === 'number' ? payload.iat : nowSec;
    if ((payload.exp - iatForTtl) > (maxTokenTtl + skewSec)) return null;

    return {
      sub: payload.sub,
      exp: payload.exp,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
    };
  } catch {
    return null;
  }
}

export function getClaimsFromNodeRequest(req: any): AppstoreSessionClaims | null {
  const secret = process.env.APPSTORE_SHARED_SECRET || '';
  if (!secret) return null;

  const cookieToken = getCookieValue(req?.headers?.cookie, SESSION_COOKIE_NAME);
  if (cookieToken) {
    const claimsFromCookie = verifyAppstoreAccessToken(cookieToken, secret);
    if (claimsFromCookie) return claimsFromCookie;
  }

  const headerToken = typeof req?.headers?.['x-appstore-access'] === 'string'
    ? req.headers['x-appstore-access']
    : '';
  if (headerToken) {
    const claimsFromHeader = verifyAppstoreAccessToken(headerToken, secret);
    if (claimsFromHeader) return claimsFromHeader;
  }

  return null;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const domain = process.env.APPSTORE_COOKIE_DOMAIN
    ? `; Domain=${process.env.APPSTORE_COOKIE_DOMAIN}`
    : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(1, Math.floor(maxAgeSeconds))}${secure}${domain}`;
}

export function buildClearSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const domain = process.env.APPSTORE_COOKIE_DOMAIN
    ? `; Domain=${process.env.APPSTORE_COOKIE_DOMAIN}`
    : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}${domain}`;
}

export function getRemainingSessionSeconds(claims: AppstoreSessionClaims): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = (claims.exp - nowSec) + getAllowedClockSkewSeconds();
  return Math.max(1, Math.floor(remaining));
}

export function requireSession(req: any, res: any): AppstoreSessionClaims | null {
  if (!isAppstoreAuthEnabled()) {
    return { sub: 'dev-bypass', exp: Math.floor(Date.now() / 1000) + 3600 };
  }

  const claims = getClaimsFromNodeRequest(req);
  if (claims) return claims;

  const message = 'Unauthorized: Sign in through the app store first.';
  if (typeof res?.status === 'function' && typeof res?.json === 'function') {
    res.status(401).json({ error: message });
  } else if (typeof res?.status === 'function' && typeof res?.send === 'function') {
    res.status(401).send(message);
  }
  return null;
}
