// Free, on-device AI (no server, no API key): runs open-source ONNX models in a
// Web Worker with transformers.js (WebGPU when available, otherwise WebAssembly).
//  - Background removal: ormbg / ISNet (Apache-2.0), quantized
//  - Super-resolution:   Swin2SR ×2 classical / ×4 real-world (Apache-2.0)
// Models are downloaded once from the Hugging Face CDN and cached by the browser.

import type { RGBAImage } from '../resample.ts';
import { resample } from '../resample.ts';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

export const LOCAL_MODELS = {
  removeBackground: { id: 'onnx-community/ormbg-ONNX', sizeMB: { uint8: 44 } },
  upscale2: { id: 'Xenova/swin2SR-classical-sr-x2-64', sizeMB: { q8: 21, fp32: 54 } },
  upscale4: { id: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr', sizeMB: { q8: 21, fp32: 53 } }
} as const;

export type LocalAiRequest =
  | { task: 'removeBackground'; image: RGBAImage }
  | { task: 'upscale'; image: RGBAImage; scale: 2 | 4 };

let T: any = null;
const cache = new Map<string, any>();

async function lib() {
  if (!T) {
    T = await import(/* @vite-ignore */ TRANSFORMERS_URL);
    T.env.allowLocalModels = false;
  }
  return T;
}

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as any).gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

type Progress = (p: { stage: string; loaded?: number; total?: number; device?: string }) => void;

/** Devices that failed once (load or inference) are not retried in this session. */
const brokenDevices = new Set<string>();

/**
 * Run a task with WebGPU first, then WebAssembly. If loading OR inference fails on a
 * device (some GPUs/drivers fail at run time), the model is reloaded on the next device.
 */
async function withDevices<R>(
  key: string,
  factory: (device: string) => Promise<any>,
  task: (model: any, device: string) => Promise<R>,
  progress: Progress,
  only?: string[]
): Promise<R> {
  const devices = (only ?? ((await hasWebGPU()) ? ['webgpu', 'wasm'] : ['wasm'])).filter((d) => !brokenDevices.has(`${key}:${d}`));
  let lastErr: unknown = new Error('No usable device for on-device AI');
  for (const device of devices) {
    const cacheKey = `${key}:${device}`;
    try {
      if (!cache.has(cacheKey)) {
        progress({ stage: `Loading model (${device === 'webgpu' ? 'GPU' : 'CPU'})`, device });
        cache.set(cacheKey, await factory(device));
      }
      return await task(cache.get(cacheKey), device);
    } catch (err) {
      lastErr = err;
      cache.delete(cacheKey);
      brokenDevices.add(cacheKey);
      progress({ stage: `${device === 'webgpu' ? 'GPU' : 'CPU'} failed, retrying`, device });
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`On-device AI failed (${/^\d+$/.test(msg) ? 'out of memory or unsupported device' : msg}). Try a smaller image or Chrome/Edge on a desktop.`);
}

function progressCallback(progress: Progress) {
  return (p: any) => {
    if (p?.status === 'progress' && p.total) progress({ stage: `Downloading ${String(p.file).split('/').pop()}`, loaded: p.loaded, total: p.total });
  };
}

function toRawRGB(T: any, img: RGBAImage, x = 0, y = 0, w = img.width, h = img.height) {
  const out = new Uint8ClampedArray(w * h * 3);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const s = ((y + j) * img.width + (x + i)) * 4;
      const d = (j * w + i) * 3;
      // Composite on white so transparent pixels don't become black.
      const a = img.data[s + 3] / 255;
      out[d] = img.data[s] * a + 255 * (1 - a);
      out[d + 1] = img.data[s + 1] * a + 255 * (1 - a);
      out[d + 2] = img.data[s + 2] * a + 255 * (1 - a);
    }
  }
  return new T.RawImage(out, w, h, 3);
}

async function removeBackground(img: RGBAImage, progress: Progress): Promise<{ image: RGBAImage; device: string }> {
  const T = await lib();
  const id = LOCAL_MODELS.removeBackground.id;
  // Quantized CPU build: ~44 MB and reliable on any desktop browser (BiRefNet ran out of memory).
  return withDevices(
    'bg',
    (dev) => T.pipeline('background-removal', id, { device: dev, dtype: 'uint8', progress_callback: progressCallback(progress) }),
    async (segmenter, device) => {
      progress({ stage: 'Removing background (CPU, ~10–30 s)', device });
      const out = await segmenter(toRawRGB(T, img));
      let r = Array.isArray(out) ? out[0] : out;
      if (r.width !== img.width || r.height !== img.height) r = await r.resize(img.width, img.height);
      const data = new Uint8ClampedArray(img.data);
      for (let i = 0, n = img.width * img.height; i < n; i++) {
        data[i * 4 + 3] = Math.min(img.data[i * 4 + 3], r.data[i * r.channels + (r.channels - 1)]);
      }
      return { image: { width: img.width, height: img.height, data }, device };
    },
    progress,
    ['wasm']
  );
}

async function upscale(img: RGBAImage, scale: 2 | 4, progress: Progress): Promise<{ image: RGBAImage; device: string }> {
  const T = await lib();
  const id = scale === 2 ? LOCAL_MODELS.upscale2.id : LOCAL_MODELS.upscale4.id;
  return withDevices(
    `sr${scale}`,
    (dev) => T.pipeline('image-to-image', id, { device: dev, dtype: dev === 'webgpu' ? 'fp32' : 'q8', progress_callback: progressCallback(progress) }),
    (pipe, device) => upscaleTiles(T, pipe, device, img, scale, progress),
    progress
  );
}

async function upscaleTiles(T: any, pipe: any, device: string, img: RGBAImage, scale: 2 | 4, progress: Progress): Promise<{ image: RGBAImage; device: string }> {
  // Process in overlapping tiles to bound memory; stitch only each tile's centre.
  const tile = 192;
  const pad = 12;
  const W = img.width * scale;
  const H = img.height * scale;
  const out = new Uint8ClampedArray(W * H * 4);
  const tilesX = Math.ceil(img.width / tile);
  const tilesY = Math.ceil(img.height / tile);
  let done = 0;
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tile, y0 = ty * tile;
      const x1 = Math.min(img.width, x0 + tile), y1 = Math.min(img.height, y0 + tile);
      const sx = Math.max(0, x0 - pad), sy = Math.max(0, y0 - pad);
      const ex = Math.min(img.width, x1 + pad), ey = Math.min(img.height, y1 + pad);
      progress({ stage: `AI upscaling tile ${++done}/${tilesX * tilesY}`, loaded: done, total: tilesX * tilesY, device });
      const result = await pipe(toRawRGB(T, img, sx, sy, ex - sx, ey - sy));
      const r = Array.isArray(result) ? result[0] : result;
      const ch = r.channels;
      if (r.width < (ex - sx) * scale || r.height < (ey - sy) * scale) {
        throw new Error(`Unexpected model output ${r.width}×${r.height} for a ${ex - sx}×${ey - sy} tile`);
      }
      for (let y = y0; y < y1; y++) {
        for (let yy = 0; yy < scale; yy++) {
          const oy = y * scale + yy;
          const ry = (y - sy) * scale + yy;
          for (let x = x0; x < x1; x++) {
            for (let xx = 0; xx < scale; xx++) {
              const ox = x * scale + xx;
              const rx = (x - sx) * scale + xx;
              const s = (ry * r.width + rx) * ch;
              const d = (oy * W + ox) * 4;
              out[d] = r.data[s];
              out[d + 1] = r.data[s + 1];
              out[d + 2] = r.data[s + 2];
              out[d + 3] = 255;
            }
          }
        }
      }
    }
  }
  // Carry transparency over with classical resampling of the alpha channel.
  let hasAlpha = false;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) { hasAlpha = true; break; }
  if (hasAlpha) {
    const a = resample(img, W, H, 'lanczos3');
    for (let i = 0; i < W * H; i++) out[i * 4 + 3] = a.data[i * 4 + 3];
  }
  return { image: { width: W, height: H, data: out }, device };
}

const scope = globalThis as any;
if (typeof scope.document === 'undefined' && typeof scope.postMessage === 'function') {
  scope.onmessage = async (e: MessageEvent) => {
    const { id, req } = e.data as { id: number; req: LocalAiRequest };
    const progress: Progress = (p) => scope.postMessage({ id, progress: p });
    try {
      const res = req.task === 'removeBackground' ? await removeBackground(req.image, progress) : await upscale(req.image, req.scale, progress);
      scope.postMessage({ id, result: res }, [res.image.data.buffer]);
    } catch (err) {
      scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
    }
  };
}
