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
# Use DeepSeek for text generation.
AI_TEXT_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_key_here
# Optional DeepSeek text model override. Defaults to deepseek-v4-flash.
# DEEPSEEK_TEXT_MODEL=deepseek-v4-flash
# Optional xAI/Grok text provider.
# AI_TEXT_PROVIDER=xai
# XAI_API_KEY=your_xai_key_here
# Optional xAI text model override. Defaults to grok-4.3.
# XAI_TEXT_MODEL=grok-4.3
# Optional image provider. Set to xai to use Grok Imagine instead of Gemini/Imagen.
# AI_IMAGE_PROVIDER=xai
# Optional xAI image model override. Defaults to grok-imagine-image-quality.
# XAI_IMAGE_MODEL=grok-imagine-image-quality
# Optional xAI image request timeout in ms. Defaults to 25000 to avoid Vercel 504s.
# XAI_IMAGE_TIMEOUT_MS=25000
# Optional Replicate image provider. Set to replicate to use FLUX Schnell instead of Gemini/Imagen.
# AI_IMAGE_PROVIDER=replicate
# REPLICATE_API_TOKEN=your_replicate_api_token_here
# REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell
# REPLICATE_IMAGE_TIMEOUT_MS=45000
APPSTORE_AUTH_ENABLED=false
# Required only when APPSTORE_AUTH_ENABLED=true
# APPSTORE_SHARED_SECRET=replace_with_long_random_secret
# Optional cookie scope for subdomains
# APPSTORE_COOKIE_DOMAIN=.yourdomain.com
# Optional cookie SameSite policy. Defaults to None in production for app-store embeds.
# APPSTORE_COOKIE_SAMESITE=none
# Optional token timing hardening
# APPSTORE_ALLOWED_CLOCK_SKEW_SECONDS=20
# APPSTORE_MAX_TOKEN_TTL_SECONDS=120
# Optional app session cookie max age (seconds, default 3600)
# APPSTORE_SESSION_MAX_AGE_SECONDS=3600
# Optional button target when session is missing
# VITE_APPSTORE_URL=https://app.yourdomain.com
# Optional only when a separate frontend origin calls this API with credentials.
# API_ALLOWED_ORIGINS=https://your-frontend-domain.com
# Optional admin image-limit bypass. Comma or space separated.
# ADMIN_EMAILS=admin@example.com
# ADMIN_SUBS=appstore-user-id
# Optional: text-only mode. Skips Gemini/Imagen image generation and shows uploadable image placeholders.
# VITE_DISABLE_IMAGES=true
# Optional Gemini model overrides. Used only when the corresponding provider is Gemini:
# VITE_GEMINI_TEXT_MODEL=gemini-2.0-flash-lite
# VITE_GEMINI_IMAGE_MODEL=gemini-2.0-flash-image
# Optional Gate 0 routing boundary. Uploaded K-12 files skip reusable seeds and use isolated browser text-cache keys.
# Leave unset or false for the exact legacy route and cache behavior.
# VITE_SOURCE_PRIMARY_ROUTING_V1=true
# Optional shared generated text/image cache using Cloudflare R2:
# R2_ACCOUNT_ID=your_cloudflare_account_id
# R2_ACCESS_KEY_ID=your_r2_access_key_id
# R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
# R2_BUCKET_NAME=your_private_bucket_name
# R2_GENERATION_CACHE_SECRET=use_a_long_random_secret_for_text_cache_keys
# R2_IMAGE_CACHE_SECRET=use_a_long_random_secret_for_cache_keys
# Optional semantic image index in Cloudflare KV. Enables subject/concept reuse across lesson plans.
# CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
# CLOUDFLARE_API_TOKEN=token_with_workers_kv_write
# R2_IMAGE_CACHE_KV_NAMESPACE_ID=your_kv_namespace_id
```

Optional:

```bash
VITE_GEMINI_PROXY_BASE_URL=https://your-vercel-domain.vercel.app
```

Use `VITE_GEMINI_PROXY_BASE_URL` only when your frontend is running somewhere else and needs to call a remote `/api/gemini`. If you do that, set `API_ALLOWED_ORIGINS` on the API deployment to the exact frontend origin so browser preflight requests can complete. Same-origin deployments should leave `VITE_GEMINI_PROXY_BASE_URL` empty.

## Image Strategy (Cost + Relevance)

- The app can generate images with Replicate FLUX Schnell, xAI Grok Imagine, or Google Gemini / Imagen.
- If `PEXELS_API_KEY` is configured, the server can use Pexels as a free stock-photo fallback before paid AI image generation. The key must stay server-side in Vercel env and must not use a `VITE_` prefix.
- Only high-confidence matches are used to keep images tightly related to the slide.
- If Cloudflare R2 env vars are configured, generated images are cached in R2 and reused across devices before calling the image provider again.
- AI-generated images are instructed to contain no text/labels.
- Intentional labels should be added with the manual image overlay editor in the slide view.

Image lookup order is:

1. Curated approved R2 images.
2. Previously cached R2 semantic/generated images.
3. Pexels landscape photo search, when enabled and the slide is not a diagram/infographic.
4. Paid AI image generation.

Pexels results are downloaded server-side, converted to the same data URL shape used by generated images, cached back into R2 when R2 is configured, and returned with photographer/source attribution. Pexels credits are rendered on the slide image and included in PPTX speaker notes/export output. Uploaded lesson plans are parsed for text/table structure only; slide images are selected from each generated slide's image prompt and metadata, not copied from embedded DOCX/PDF images.

To avoid paid image spend, set `AI_IMAGE_PROVIDER=pexels` or `PAID_IMAGE_GENERATION_DISABLED=true` in the server environment. The app will still use curated images, R2 cache, and Pexels, but it will stop before Replicate, Gemini, or xAI image generation when those free sources miss.

Batch slide generation has an additional client-side cost guard: each generated deck/session allows paid AI image fallback on at most four high-value slide images. All slides can still use curated R2, teacher-uploaded R2, generated/Pexels cache, and Pexels before this cap applies. Manual single-image regeneration remains available for deliberate teacher edits.

### Cloudflare R2 Shared Cache

Create a private R2 bucket and an R2 API token with object read/write access to that bucket. Add the `R2_*` variables above to Vercel. The app stores legacy generated image bytes at `generated-images/v1/<hmac>.png`; the HMAC key is derived from the normalized image prompt, selected model, aspect ratio, and `R2_IMAGE_CACHE_SECRET`.

The app also writes a semantic image index and stores reusable images under organized R2 paths such as `generated-images/v2/<subject>/<visual-role>/<grade-band>/<hmac>/image.png`. If `R2_IMAGE_CACHE_KV_NAMESPACE_ID` and a Cloudflare API token are configured, KV is used as the primary semantic index. The app also keeps an R2 index fallback at `generated-images/v2/_index/<hash>.json`, so deployments with only R2 credentials can still reuse cached images. This lets images for similar concepts in the same subject, such as Values Education decision-making visuals, be reused across different lesson plans and compatible grade bands.

Approved curated classroom images should be stored in R2 instead of committed under `public/curated-images`. Curated R2 images are checked before older generated semantic-cache records and before local static fallback files, so a newer approved HD image can replace an older generated or static asset without changing the app bundle. Upload approved images with:

```bash
npm run upload:curated-images -- ./curated-image-batches/english-grade-7-q1-week-1.json --dry-run
npm run upload:curated-images -- ./curated-image-batches/english-grade-7-q1-week-1.json
```

The upload manifest should include one row per approved visual with `collection`, `subject`, `topic`, `gradeLevel`, `gradeBand`, `learningCompetency`, `slideTemplate`, `visualRole`, and `semanticAnchor`. The API first looks for anchor-specific keys such as `generated-images/v2/_curated/english-poetry-imagery/activity/grade-7/anchors/core-memory-sharing/image.png`, then broader fallbacks only when an image has no anchor.

To generate and upload image batches from Lesson Exemplar/BOW source files, create a manifest like `docs/r2-image-generation-manifest.example.json`, then run:

```bash
npm run generate:r2-images -- ./curated-image-batches/science-force-motion.json --env .env.r2.local --env .env.replicate.local --dry-run
npm run generate:r2-images -- ./curated-image-batches/science-force-motion.json --env .env.r2.local --env .env.replicate.local --auto-curated
```

The generator supports PDF, DOCX, TXT, and MD sources. It does not perform OCR, so scanned PDFs must be converted to extractable text first. Real runs create local review artifacts under `outputs/<batch>/`, write generated semantic-cache entries to R2, and upload `_curated` R2 objects only when both `generation.autoCurated` is `true` in the manifest and `--auto-curated` is present on the command line.

Teacher-uploaded slide replacements are also saved to R2 when image caching is configured. These are stored under `generated-images/v2/_uploaded/<subject>/<grade>/<topic>/<session-or-day>/<slide-role>/...` and indexed by subject, grade, topic, session/day, slide role, competency, and semantic anchor. Lookup checks curated approved images first, then teacher-uploaded overrides, then generated/Pexels semantic cache records.

The app also stores successful text generation responses at `generated-text/v1/<hmac>.json`; the HMAC key is derived from the normalized request contents, selected text provider/model, request config, and `R2_GENERATION_CACHE_SECRET` or `R2_IMAGE_CACHE_SECRET`. If any required R2 variable is missing, the app skips shared caching and falls back to direct generation.

## Text Provider

Set `AI_TEXT_PROVIDER=deepseek` and `DEEPSEEK_API_KEY` to use DeepSeek for lesson-plan, slide, and lecture text generation. The default DeepSeek text model is `deepseek-v4-flash`; override it with `DEEPSEEK_TEXT_MODEL` when needed.

Set `AI_TEXT_PROVIDER=xai` and `XAI_API_KEY` to use xAI/Grok instead. Gemini can still be used for text by setting `AI_TEXT_PROVIDER=gemini` and `GEMINI_API_KEY`.

## Session Alignment

`VITE_SOURCE_PRIMARY_ROUTING_V1=true` activates the reversible Gate 0 source-authority boundary. Uploaded K-12 content then bypasses reusable lesson seeds and uses route-scoped browser text-generation cache keys; topic-only generation remains on the legacy path. Unset or set the flag to `false` to use the previous routing and cache keys. Gate 0 does not change prompts, models, images, layouts, or export behavior.

`VITE_VISUAL_TEACHING_COMPOSER_V1=true` enables the source-primary Gate 3.5 visual teaching composer after Gate 2 and before semantic scene compilation. It requires a configured server-side `AI_TEXT_PROVIDER` and its corresponding API key. Activation also requires the existing Gate 3 semantic, Gate 4 visual-system, and Gate 5 end-to-end flags to be enabled; a partial chain preserves the pre-composer behavior without calling the provider. It is ignored for legacy/topic-only routes and remains subordinate to `VITE_SOURCE_PRIMARY_PRODUCTION_ARMED` and Gate 6 rollout eligibility. Generation quota is authorized immediately before the provider call, released if composition or validation fails, and retained only for a validated presentation. Leave the composer flag unset or `false` to preserve the current Gates 0-6 scene behavior. Enabling this flag does not change `AI_TEXT_PROVIDER`, `AI_IMAGE_PROVIDER`, or production rollout by itself.

For K-12 uploaded lesson plans, per-session/day slide generation first extracts the selected `Session N` or `Day N` source block when those markers are present. That selected block is treated as the binding source for a presentation outline, and the slide deck is generated from that outline with the full lesson plan kept only as secondary context. Generated outlines and session decks are checked for weak source coverage or wrong-session/day title leakage and retried once with stricter alignment instructions before being shown.

The header language switch controls the app interface. The input screen has a separate presentation-language control for generated slide text and speaker notes. When an uploaded or pasted lesson plan strongly matches Filipino or Araling Panlipunan markers, such as `Araling Panlipunan`, `Aral-Pan`, `Asignatura: Filipino`, `Baitang`, `Markahan`, `Layunin`, `Pamantayang Pangnilalaman`, `Kasanayang Pampagkatuto`, `Gawain`, `Pagtataya`, or `Takdang-Aralin`, the app auto-selects Filipino for the presentation language before generation. Teachers can override the presentation language manually without changing the interface language.

For text-only deployments, set `VITE_DISABLE_IMAGES=true`. The app will skip image API calls, keep using the text provider for lesson and slide content, and show image placeholders that can be replaced by manual uploads.

To use xAI for generated slide images, set `AI_IMAGE_PROVIDER=xai`, keep `VITE_DISABLE_IMAGES` unset or `false`, configure `XAI_API_KEY`, and leave `PAID_IMAGE_GENERATION_DISABLED` unset or `false`. The default xAI image model is `grok-imagine-image-quality`.

To use Replicate FLUX Schnell for generated slide images, set `AI_IMAGE_PROVIDER=replicate`, `REPLICATE_API_TOKEN`, and `REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell` in the server environment. Do not prefix the Replicate token with `VITE_`; it must not be exposed to frontend code. Replicate still runs after curated R2, teacher-uploaded R2, generated/Pexels cache, and Pexels lookup, and it still obeys the four-paid-images-per-deck guard.

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

Admin image testing: when `role` is `admin`, `owner`, `super_admin`, or `administrator`, or when the verified token `email`/`sub` is listed in `ADMIN_EMAILS`/`ADMIN_SUBS`, the frontend skips the local daily image-generation limit. Admin bulk generation is still capped per presentation run to avoid provider timeouts; remaining placeholders can be regenerated manually. Provider-side quota, billing, and rate limits still apply.

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
