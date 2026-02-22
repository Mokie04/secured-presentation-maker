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

- The app first searches open-license educational images from Openverse (`/api/open-images`).
- Only high-confidence matches are used to keep images tightly related to the slide.
- Open-source matches are converted to `data:` URLs server-side for reliable slide rendering and PPTX export.
- If no strong open image match is found, the app falls back to Gemini image generation.

## Local Development

1. Install dependencies:
   `npm install`
2. Run full stack locally (recommended):
   `npx vercel dev`
3. Open the local URL printed by Vercel Dev.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Set `GEMINI_API_KEY` in Project Settings -> Environment Variables.
3. Deploy.

Vercel will build the Vite app and host `/api/gemini` as a serverless function.
