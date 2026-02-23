import {
  buildClearSessionCookie,
  buildSessionCookie,
  getRemainingSessionSeconds,
  getClaimsFromNodeRequest,
  isAppstoreAuthEnabled,
  verifyAppstoreAccessToken,
} from './_sessionAuth.js';
import { isJtiUsed, markJtiUsed } from '../lib/tokenCache.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  if (!isAppstoreAuthEnabled()) {
    return res.status(200).json({
      authenticated: true,
      mode: 'disabled',
      user: { sub: 'dev-bypass' },
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

    // Cap cookie lifetime to 60 minutes regardless of token TTL to keep users signed in
    const sessionMax = Math.min(getRemainingSessionSeconds(claims), 3600);
    res.setHeader('Set-Cookie', buildSessionCookie(rawAccess, sessionMax));

    return res.status(200).json({
      authenticated: true,
      activated: true,
      user: {
        sub: claims.sub,
        email: claims.email || '',
        role: claims.role || '',
      },
      expiresAt: claims.exp,
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
    user: {
      sub: existingClaims.sub,
      email: existingClaims.email || '',
      role: existingClaims.role || '',
    },
    expiresAt: existingClaims.exp,
  });
}
