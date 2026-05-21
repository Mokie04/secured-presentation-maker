import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  getRemainingSessionSeconds,
  getSessionMaxAgeSeconds,
  getClaimsFromNodeRequest,
  isAppstoreAuthEnabled,
  type AppstoreSessionClaims,
  verifyAppstoreAccessToken,
} from './_sessionAuth.js';
import { isJtiUsed, markJtiUsed } from '../lib/tokenCache.js';

export const config = {
  maxDuration: 30,
};

const ADMIN_ROLES = new Set(['admin', 'owner', 'super_admin', 'administrator']);

function normalizeRole(value: string | undefined): string {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function parseAdminList(value: string | undefined): Set<string> {
  return new Set(
    (value || '')
      .split(/[,\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAdminUser(claims: Pick<AppstoreSessionClaims, 'sub' | 'email' | 'role'>): boolean {
  if (ADMIN_ROLES.has(normalizeRole(claims.role))) {
    return true;
  }

  const adminEmails = parseAdminList(process.env.ADMIN_EMAILS);
  const email = (claims.email || '').trim().toLowerCase();
  if (email && adminEmails.has(email)) {
    return true;
  }

  const adminSubs = parseAdminList(process.env.ADMIN_SUBS);
  const sub = (claims.sub || '').trim().toLowerCase();
  return Boolean(sub && adminSubs.has(sub));
}

function buildUserPayload(claims: Pick<AppstoreSessionClaims, 'sub' | 'email' | 'role'>) {
  return {
    sub: claims.sub,
    email: claims.email || '',
    role: claims.role || '',
    isAdmin: isAdminUser(claims),
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  if (!isAppstoreAuthEnabled()) {
    return res.status(200).json({
      authenticated: true,
      mode: 'disabled',
      user: { sub: 'dev-bypass', isAdmin: true },
    });
  }

  const secret = process.env.APPSTORE_SHARED_SECRET || '';
  if (!secret) {
    return res.status(500).json({
      authenticated: false,
      error: 'Server is missing APPSTORE_SHARED_SECRET.',
    });
  }

  const rawAccess = typeof req.query?.access === 'string' ? req.query.access : '';
  if (rawAccess) {
    const claims = verifyAppstoreAccessToken(rawAccess, secret);
    if (!claims) {
      res.setHeader('Set-Cookie', buildClearSessionCookie());
      return res.status(401).json({
        authenticated: false,
        error: 'Invalid or expired access token.',
      });
    }

    const expectedAud = process.env.APPSTORE_AUDIENCE || 'presentation-maker';
    if (claims.aud && claims.aud !== expectedAud) {
      res.setHeader('Set-Cookie', buildClearSessionCookie());
      return res.status(401).json({
        authenticated: false,
        error: 'Invalid audience for this tool.',
      });
    }

    if (claims.jti && isJtiUsed(claims.jti)) {
      res.setHeader('Set-Cookie', buildClearSessionCookie());
      return res.status(401).json({
        authenticated: false,
        error: 'This access token was already used.',
      });
    }
    if (claims.jti) {
      markJtiUsed(claims.jti, Math.max(60, Math.min(5400, getRemainingSessionSeconds(claims))));
    }

    // Exchange short-lived handoff token for a dedicated session token.
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionMax = getSessionMaxAgeSeconds();
    const sessionClaims = {
      sub: claims.sub,
      email: claims.email || '',
      role: claims.role || '',
      aud: claims.aud || expectedAud,
      iat: nowSec,
      exp: nowSec + sessionMax,
    };
    const sessionToken = createSessionToken(sessionClaims, secret);
    res.setHeader('Set-Cookie', buildSessionCookie(sessionToken, sessionMax));

    return res.status(200).json({
      authenticated: true,
      activated: true,
      user: buildUserPayload(sessionClaims),
      expiresAt: sessionClaims.exp,
    });
  }

  const existingClaims = getClaimsFromNodeRequest(req);
  if (!existingClaims) {
    return res.status(401).json({
      authenticated: false,
      error: 'No active session.',
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: buildUserPayload(existingClaims),
    expiresAt: existingClaims.exp,
  });
}
