<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DLL-aligned Presentation Maker

This app is now structured for Vercel deployment with server-side Gemini access:
- Frontend: Vite + React static site
- Backend: Vercel serverless function at `/api/gemini`
- Secret handling: Gemini API key stays server-side (`GEMINI_API_KEY`)

## Environment Variables

Create `.env.local` for local/full-stack runs:

```bash
GEMINI_API_KEY=your_real_key_here
APPSTORE_AUTH_ENABLED=false
# Required only when APPSTORE_AUTH_ENABLED=true
# APPSTORE_SHARED_SECRET=replace_with_long_random_secret
# Optional cookie scope for subdomains
# APPSTORE_COOKIE_DOMAIN=.yourdomain.com
# Optional token timing hardening
# APPSTORE_ALLOWED_CLOCK_SKEW_SECONDS=20
# APPSTORE_MAX_TOKEN_TTL_SECONDS=120
# Optional app session cookie max age (seconds, default 3600)
# APPSTORE_SESSION_MAX_AGE_SECONDS=3600
# Optional button target when session is missing
# VITE_APPSTORE_URL=https://app.yourdomain.com
# Optional: allow paid AI image fallback when open-source image match is not found.
# Default is false for cost control.
# VITE_ENABLE_AI_IMAGE_FALLBACK=false
# Optional model overrides (low-cost defaults are already applied in code):
# VITE_GEMINI_TEXT_MODEL=gemini-2.0-flash-lite
# VITE_GEMINI_IMAGE_MODEL=gemini-2.0-flash-image
```

Optional:

```bash
VITE_GEMINI_PROXY_BASE_URL=https://your-vercel-domain.vercel.app
```

Use `VITE_GEMINI_PROXY_BASE_URL` only when your frontend is running somewhere else and needs to call a remote `/api/gemini`.

## Image Strategy (Cost + Relevance)

- The app now generates images directly with Google Gemini / Imagen (no open-license image fetch).
- Only high-confidence matches are used to keep images tightly related to the slide.
- Open-source matches are proxied server-side for reliable rendering and PPTX export.
- Cost-saver default: if no strong open image match is found, paid AI image generation is skipped unless `VITE_ENABLE_AI_IMAGE_FALLBACK=true`.
- AI-generated images are instructed to contain no text/labels.
- Intentional labels should be added with the manual image overlay editor in the slide view.

## Local Development

1. Install dependencies:
   `npm install`
2. Run full stack locally (recommended):
   `npx vercel dev`
3. Open the local URL printed by Vercel Dev.

## Secure Embedding (Step 1)

The app now supports secure session handoff from your main app store.

### What this protects

- Shared links are blocked unless a valid signed session token is present.
- AI/image API (`/api/gemini`) requires a valid session.
- Users who open the link directly see a secure-access screen instead of full functionality.

### Enable it in Vercel

Set these environment variables:

```bash
APPSTORE_AUTH_ENABLED=true
APPSTORE_SHARED_SECRET=use_a_long_random_secret
APPSTORE_COOKIE_DOMAIN=.yourdomain.com
APPSTORE_ALLOWED_CLOCK_SKEW_SECONDS=20
APPSTORE_MAX_TOKEN_TTL_SECONDS=120
APPSTORE_SESSION_MAX_AGE_SECONDS=3600
VITE_APPSTORE_URL=https://app.yourdomain.com
```

### How your main app should open this tool

Your app store backend should generate a short-lived signed token and append it as `?access=...` when opening the tool subdomain.

Token format:

`base64url(payload_json).base64url(hmac_sha256(payload_base64url, APPSTORE_SHARED_SECRET))`

Required payload fields:

- `sub` (user id)
- `exp` (unix seconds expiry; 60 seconds is supported)
- Optional: `email`, `role`, `iat`

Example backend signer (Node.js):

```js
import crypto from "crypto";

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createAccessToken(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + 60, // 60 seconds
  };

  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = b64url(sig);
  return `${payloadB64}.${sigB64}`;
}
```

Launch URL from your app store:

`https://tool.yourdomain.com/?access=<signed_token>`

## Deploy to Vercel

1. Import this repository into Vercel.
2. Set `GEMINI_API_KEY` (and auth vars if enabling secure embedding) in Project Settings -> Environment Variables.
3. Deploy.

Vercel will build the Vite app and host `/api/gemini` as a serverless function.
