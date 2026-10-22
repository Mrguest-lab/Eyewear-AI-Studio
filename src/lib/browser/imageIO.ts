// Browser-side decode / encode with verification.
// Every export is checked by reading the encoded file's magic bytes, so a browser
// that silently falls back to PNG can never be reported as a JPG/WebP conversion.

import type { RGBAImage } from '../resample.ts';
import type { ImageFormat } from '../format.ts';
import { FORMAT_LABEL, FORMAT_MIME, formatFromMime, isLossy, sniffFormat } from '../format.ts';
import { flatten, parseHexColor } from '../compose.ts';
import type { WorkerOp } from './pixelWorker.ts';
import { runOp } from './pixelWorker.ts';

export interface LoadedImage {
  image: RGBAImage;
  width: number;
  height: number;
  /** Format detected from the file bytes (falls back to the MIME type). */
  format: ImageFormat | null;
  size: number;
  name: string;
}

export async function readHeader(blob: Blob, n = 32): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, n).arrayBuffer());
}

export async function loadImageFile(file: Blob, name = (file as File).name || 'image'): Promise<LoadedImage> {
  const format = sniffFormat(await readHeader(file)) ?? formatFromMime(file.type);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image', premultiplyAlpha: 'none' });
  } catch {
    throw new Error(`${name}: this browser cannot decode the file (unsupported or corrupt image).`);
  }
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, width, height).data;
  return { image: { width, height, data }, width, height, format, size: file.size, name };
}

export function rasterToCanvas(img: RGBAImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed (image may be too large for this browser).'))), mime, quality)
  );
}

const encodeSupport = new Map<ImageFormat, Promise<boolean>>();

/** Probe whether this browser can really encode a format (not just accept the MIME string). */
export function canEncode(format: ImageFormat): Promise<boolean> {
  if (!encodeSupport.has(format)) {
    encodeSupport.set(
      format,
      (async () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = 2;
          const blob = await toBlob(c, FORMAT_MIME[format], 0.8);
          return sniffFormat(await readHeader(blob)) === format;
        } catch {
          return false;
        }
      })()
    );
  }
  return encodeSupport.get(format)!;
}

/** Check that the browser can allocate a canvas of this size (iOS Safari caps ~16.7 MP). */
export function canAllocate(width: number, height: number): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = '#010203';
    ctx.fillRect(width - 1, height - 1, 1, 1);
    const px = ctx.getImageData(width - 1, height - 1, 1, 1).data;
    c.width = c.height = 0;
    return px[0] === 1 && px[1] === 2 && px[2] === 3;
  } catch {
    return false;
  }
}

export interface EncodeOptions {
  format: ImageFormat;
  /** 1-100 */
  quality?: number;
  /** Colour used to replace transparency when the format has no alpha (JPG). */
  flattenColor?: string;
  /** Lower lossy quality (down to minQuality) until the file fits. */
  maxBytes?: number | null;
  minQuality?: number;
}

export interface EncodeResult {
  blob: Blob;
  format: ImageFormat;
  qualityUsed?: number;
  width: number;
  height: number;
  /** True when maxBytes could not be met. */
  overSize: boolean;
  flattened: boolean;
}

export class UnsupportedFormatError extends Error {}

export async function encodeImage(img: RGBAImage, opts: EncodeOptions): Promise<EncodeResult> {
  const { format } = opts;
  if (!(await canEncode(format))) {
    throw new UnsupportedFormatError(
      `${FORMAT_LABEL[format]} encoding is not supported by this browser. Use Chrome, Edge or Firefox, or choose another format.`
    );
  }
  let src = img;
  let flattened = false;
  if (format === 'jpeg') {
    let hasAlpha = false;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) { hasAlpha = true; break; }
    if (hasAlpha) {
      src = flatten(img, parseHexColor(opts.flattenColor || '#FFFFFF') ?? [255, 255, 255]);
      flattened = true;
    }
  }
  const canvas = rasterToCanvas(src);
  const mime = FORMAT_MIME[format];
  let q = Math.max(1, Math.min(100, opts.quality ?? 92));
  let blob = await toBlob(canvas, mime, isLossy(format) ? q / 100 : undefined);
  let overSize = false;
  if (opts.maxBytes && blob.size > opts.maxBytes) {
    if (isLossy(format)) {
      // Binary search the highest quality that fits.
      let lo = Math.max(1, opts.minQuality ?? 40), hi = q - 1, best: Blob | null = null, bestQ = q;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const b = await toBlob(canvas, mime, mid / 100);
        if (b.size <= opts.maxBytes) {
          best = b;
          bestQ = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (best) {
        blob = best;
        q = bestQ;
      } else overSize = true;
    } else overSize = true;
  }
  const actual = sniffFormat(await readHeader(blob));
  if (actual !== format) {
    throw new UnsupportedFormatError(
      `Export check failed: requested ${FORMAT_LABEL[format]} but the browser produced ${actual ? FORMAT_LABEL[actual] : 'unknown data'}.`
    );
  }
  canvas.width = canvas.height = 0;
  return { blob, format: actual, qualityUsed: isLossy(format) ? q : undefined, width: img.width, height: img.height, overSize, flattened };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Prepare a reference image for an AI provider: these models work at ~1 MP internally,
 * so the long side is capped (default 1536px) to keep uploads small. The original
 * full-resolution image is never modified.
 */
export async function referenceForAI(img: RGBAImage, maxSide = 1536, format: ImageFormat = 'png'): Promise<string> {
  let src = img;
  const long = Math.max(img.width, img.height);
  if (long > maxSide) {
    const s = maxSide / long;
    src = (await runPixelOp({ op: 'resample', image: img, width: Math.round(img.width * s), height: Math.round(img.height * s) })) as RGBAImage;
  }
  const enc = await encodeImage(src, { format, quality: 92 });
  return blobToDataUrl(enc.blob);
}

// ---------- worker client ----------

let worker: Worker | null = null;
let workerFailed = false;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./pixelWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const { id, result, error } = e.data;
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        if (error) p.reject(new Error(error));
        else p.resolve(result);
      };
      worker.onerror = () => {
        workerFailed = true;
        for (const p of pending.values()) p.reject(new Error('Image worker crashed (possibly out of memory).'));
        pending.clear();
        worker = null;
      };
    } catch {
      workerFailed = true;
      return null;
    }
  }
  return worker;
}

/**
 * Run a pixel operation in the worker (falls back to the main thread).
 * For ops that return { image } the image is returned directly; other results are returned as-is.
 */
export async function runPixelOp<T = unknown>(payload: WorkerOp): Promise<T> {
  const w = getWorker();
  const unwrap = (r: any) => (payload.op === 'resample' || payload.op === 'enhance' ? r.image : r);
  if (!w) return unwrap(runOp(payload));
  // Copy so the caller's buffer stays usable after transfer.
  const image = { ...payload.image, data: new Uint8ClampedArray(payload.image.data) };
  const id = ++seq;
  const result = await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, payload: { ...payload, image } }, [image.data.buffer]);
  });
  return unwrap(result);
}
