# Eyewear AI Studio (ResizerHub)

Watermark-free e-commerce images for sunglasses and eyewear: product clean-up, true 2K/4K output,
marketplace presets with validation, JPG/PNG/WebP conversion, batch SKU processing and AI model photoshoots.

**Live app:** https://mrguest-lab.github.io/Eyewear-AI-Studio/  ·  **Self-test:** https://mrguest-lab.github.io/Eyewear-AI-Studio/selftest.html

## What runs where

| Feature | Where | Cost |
|---|---|---|
| JPG ↔ PNG ↔ WebP conversion, batch, ZIP, rename | Browser (Canvas, verified by file bytes) | Free |
| Resize, crop/pad, exact 2K/4K sizes, Lanczos-3 upscaling | Browser (Web Worker) | Free |
| Enhance (levels, denoise, clarity, sharpen), white background, dust removal, contact shadow | Browser | Free |
| Quality & marketplace validation, editable presets | Browser | Free |
| **AI super-resolution (Swin2SR ×2/×4)** | Browser, on-device (WebGPU or WebAssembly) | Free — one-time model download 21–54 MB |
| **AI background removal (BiRefNet-lite, MIT)** | Browser, on-device | Free — one-time model download ~224 MB |
| AI model photoshoots, AI relight, AI angle views | Your AI gateway → Gemini or Replicate FLUX Kontext | Paid per image by the provider |
| AI super-resolution Real-ESRGAN, AI background remover | Your AI gateway → Replicate | Paid per run |

The app never adds a watermark, logo, text, border or badge. Gemini images contain Google's invisible
SynthID watermark; the app discloses this and asks for consent before using Gemini, and does not try to remove it.
AI-generated angle views and model shots are labelled as AI-generated and are not presented as photographs of the item.

## Tabs

- **Eyewear Studio** – upload → enhance / white background / AI tools → resolution (Standard, 2K, 4K, custom) →
  marketplace export with validation report → download. Before/after compare slider and undo history.
- **AI Photoshoot** – adult male/female models; front, 45°, profile, close-up, lifestyle, campaign, studio,
  listing shots; pose/outfit/lighting/background; product-preservation level; reference-image conditioning.
- **Converter** – batch JPG/PNG/WebP with quality, transparency fill colour, rename pattern, savings, ZIP.
- **Batch SKUs** – many SKUs × many presets, SKU-based names, per-image status, ZIP with a folder per SKU.
- **Validate** – checks finished files exactly as uploaded.
- **Presets** – Amazon, Myntra, AJIO, Flipkart, Nykaa, Shopify, generic. Every field is editable;
  presets marked ⚠ need verification against current seller guidelines. Import/export JSON.
- **Quick Resize** – the original ResizerHub single/bulk resizer.
- **AI Backend** – gateway URL, optional passcode, provider disclosures, costs and hardware notes.

## Develop

Requires Node.js ≥ 22.6.

```bash
npm install
npm run dev          # http://localhost:3000 (proxies /api to the gateway on :8787)
node --experimental-strip-types --test tests/lib.test.ts tests/server.test.ts
npx tsc --noEmit
npm run build
```

Browser-only checks (real encoders, 2K/4K renders, ZIP): open `/selftest.html`.

## AI gateway (server)

`server/index.ts` is a dependency-free Node server that holds the API keys and forwards requests to providers.

```bash
cp .env.example .env    # fill GEMINI_API_KEY and/or REPLICATE_API_TOKEN
node --experimental-strip-types server/index.ts
```

Hosting options for the gateway (keys go in the host's secret/env settings):
- **Render / Railway / Fly.io** – start command `node --experimental-strip-types server/index.ts`, Node 22.
- **Google Cloud Run** – the same command; free tier covers light use.
- **Your own PC** – run the command above; set the app's AI Backend URL to `http://localhost:8787`.

Then open the app → **AI Backend** tab → paste the gateway URL (and passcode if you set `ACCESS_TOKEN`).
Set `ALLOWED_ORIGINS=https://mrguest-lab.github.io` so only your site can call it.

## Deploy the frontend to GitHub Pages

Pushing to `main` runs `.github/workflows/deploy.yml`: unit tests → type check → build → publish `dist/`
to GitHub Pages. Other branches run the tests and build only.

1. Repo **Settings → Pages → Source: GitHub Actions** (or the `gh-pages` branch).
2. `git push origin main`
3. Open https://mrguest-lab.github.io/Eyewear-AI-Studio/

## Limits to know

- Upscaling (Lanczos or AI) creates new pixels; it does not recover detail the camera never captured.
- Generative models can change small product details (logo lettering, hinge shape, lens tint). Prefer the
  local tools when exact product accuracy matters and compare AI output with the real product.
- iPhone/iPad Safari caps canvases at about 16.7 MP, so 4096×5120 and larger need a desktop browser.
- Safari may not encode WebP; the converter detects this and refuses instead of producing a renamed PNG.
- Automated checks cannot guarantee marketplace approval.
