import {
  buildClearSessionCookie,
  buildSessionCookie,
  getRemainingSessionSeconds,
  getClaimsFromNodeRequest,
  isAppstoreAuthEnabled,
  verifyAppstoreAccessToken,
} from './_sessionAuth.js';

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

    const maxAge = getRemainingSessionSeconds(claims);
    res.setHeader('Set-Cookie', buildSessionCookie(rawAccess, maxAge));

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
