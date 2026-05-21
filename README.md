<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DLL-aligned Presentation Maker

This app is now structured for Vercel deployment with server-side AI access:
- Frontend: Vite + React static site
- Backend: Vercel serverless function at `/api/gemini`
- Secret handling: provider API keys stay server-side

## Environment Variables

Create `.env.local` for local/full-stack runs:

```bash
GEMINI_API_KEY=your_real_key_here
# Use xAI/Grok for text generation.
AI_TEXT_PROVIDER=xai
XAI_API_KEY=your_xai_key_here
# Optional xAI text model override. Defaults to grok-4.3.
# XAI_TEXT_MODEL=grok-4.3
# Optional image provider. Set to xai to use Grok Imagine instead of Gemini/Imagen.
# AI_IMAGE_PROVIDER=xai
# Optional xAI image model override. Defaults to grok-imagine-image-quality.
# XAI_IMAGE_MODEL=grok-imagine-image-quality
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
# Optional: text-only mode. Skips Gemini/Imagen image generation and shows uploadable image placeholders.
# VITE_DISABLE_IMAGES=true
# Optional Gemini model overrides. Used only when the corresponding provider is Gemini:
# VITE_GEMINI_TEXT_MODEL=gemini-2.0-flash-lite
# VITE_GEMINI_IMAGE_MODEL=gemini-2.0-flash-image
# Optional shared generated-image cache using Cloudflare R2:
# R2_ACCOUNT_ID=your_cloudflare_account_id
# R2_ACCESS_KEY_ID=your_r2_access_key_id
# R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
# R2_BUCKET_NAME=your_private_bucket_name
# R2_IMAGE_CACHE_SECRET=use_a_long_random_secret_for_cache_keys
```

Optional:

```bash
VITE_GEMINI_PROXY_BASE_URL=https://your-vercel-domain.vercel.app
```

Use `VITE_GEMINI_PROXY_BASE_URL` only when your frontend is running somewhere else and needs to call a remote `/api/gemini`.

## Image Strategy (Cost + Relevance)

- The app can generate images with xAI Grok Imagine or Google Gemini / Imagen.
- Only high-confidence matches are used to keep images tightly related to the slide.
- If Cloudflare R2 env vars are configured, generated images are cached in R2 and reused across devices before calling the image provider again.
- AI-generated images are instructed to contain no text/labels.
- Intentional labels should be added with the manual image overlay editor in the slide view.

### Cloudflare R2 Image Cache

Create a private R2 bucket and an R2 API token with object read/write access to that bucket. Add the `R2_*` variables above to Vercel. The app stores generated image bytes at `generated-images/v1/<hmac>.png`; the HMAC key is derived from the normalized image prompt, selected model, aspect ratio, and `R2_IMAGE_CACHE_SECRET`.

If any R2 variable is missing, the app skips shared image caching and falls back to direct image generation.

## Text Provider

Set `AI_TEXT_PROVIDER=xai` and `XAI_API_KEY` to use xAI/Grok for lesson-plan, slide, and lecture text generation. The app translates its existing JSON schemas into xAI structured output requests. Gemini can still be used for text by setting `AI_TEXT_PROVIDER=gemini` and `GEMINI_API_KEY`.

For text-only deployments, set `VITE_DISABLE_IMAGES=true`. The app will skip image API calls, keep using the text provider for lesson and slide content, and show image placeholders that can be replaced by manual uploads.

To use xAI for generated slide images, set `AI_IMAGE_PROVIDER=xai`, keep `VITE_DISABLE_IMAGES` unset or `false`, and configure `XAI_API_KEY`. The default xAI image model is `grok-imagine-image-quality`.

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
