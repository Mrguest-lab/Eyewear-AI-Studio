// Traditional (non-generative) photo enhancement on raw RGBA pixels.
// These operations never invent product detail: product pixels are only
// tone-mapped, denoised or sharpened, and background cleanup leaves pixels
// that belong to the product untouched.

import type { RGBAImage } from './resample.ts';
import { analyzeBackground, luma } from './analysis.ts';
import type { Rect } from './dimensions.ts';

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function cloneImage(img: RGBAImage): RGBAImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

/**
 * Linked auto-levels: one black/white point from the luminance histogram is applied
 * equally to R, G and B, so the product's hue and saturation are preserved.
 */
export function autoLevels(img: RGBAImage, clipPct = 0.3): RGBAImage {
  const out = cloneImage(img);
  const d = out.data;
  const hist = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    hist[Math.round(luma(d[i], d[i + 1], d[i + 2]))]++;
    total++;
  }
  if (!total) return out;
  const clip = (total * clipPct) / 100;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) {
    acc += hist[lo];
    if (acc > clip) break;
  }
  acc = 0;
  for (; hi > 0; hi--) {
    acc += hist[hi];
    if (acc > clip) break;
  }
  if (hi - lo < 16 || (lo <= 1 && hi >= 254)) return out;
  const scale = 255 / (hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255((d[i] - lo) * scale);
    d[i + 1] = clamp255((d[i + 1] - lo) * scale);
    d[i + 2] = clamp255((d[i + 2] - lo) * scale);
  }
  return out;
}

/** White balance so the measured background color becomes neutral grey/white. */
export function neutralizeBackgroundCast(img: RGBAImage): RGBAImage {
  const bg = analyzeBackground(img);
  const [r, g, b] = bg.color;
  if (bg.status === 'transparent' || r < 120 || g < 120 || b < 120) return cloneImage(img);
  const target = Math.max(r, g, b);
  const fr = target / r, fg = target / g, fb = target / b;
  const out = cloneImage(img);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] * fr);
    d[i + 1] = clamp255(d[i + 1] * fg);
    d[i + 2] = clamp255(d[i + 2] * fb);
  }
  return out;
}

export interface ToneAdjustments {
  brightness?: number; // -100..100
  contrast?: number; // -100..100
  saturation?: number; // -100..100
}

export function adjustTone(img: RGBAImage, adj: ToneAdjustments): RGBAImage {
  const out = cloneImage(img);
  const d = out.data;
  const br = ((adj.brightness ?? 0) / 100) * 64;
  const c = (adj.contrast ?? 0) / 100;
  const cf = c >= 0 ? 1 + c * 1.5 : 1 + c;
  const sf = 1 + (adj.saturation ?? 0) / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = (d[i] - 128) * cf + 128 + br;
    let g = (d[i + 1] - 128) * cf + 128 + br;
    let b = (d[i + 2] - 128) * cf + 128 + br;
    const l = luma(r, g, b);
    r = l + (r - l) * sf;
    g = l + (g - l) * sf;
    b = l + (b - l) * sf;
    d[i] = clamp255(r);
    d[i + 1] = clamp255(g);
    d[i + 2] = clamp255(b);
  }
  return out;
}

/** Edge-preserving 3x3 sigma filter: averages only neighbours of similar brightness. */
export function denoise(img: RGBAImage, sigma = 10): RGBAImage {
  const { width: w, height: h, data: s } = img;
  const out = cloneImage(img);
  const d = out.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4;
      const l0 = luma(s[p], s[p + 1], s[p + 2]);
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const q = ((y + dy) * w + (x + dx)) * 4;
          if (Math.abs(luma(s[q], s[q + 1], s[q + 2]) - l0) <= sigma) {
            r += s[q];
            g += s[q + 1];
            b += s[q + 2];
            n++;
          }
        }
      }
      d[p] = r / n;
      d[p + 1] = g / n;
      d[p + 2] = b / n;
    }
  }
  return out;
}

/** O(n) box blur of a single float channel, running sums, clamped edges. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / size;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / size;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Approximate Gaussian blur (3 box passes). */
export function gaussianBlurChannel(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(1, Math.round(radius / 1.5));
  return boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r);
}

/**
 * Unsharp mask on luminance only (avoids colour fringes on frames and lenses).
 * amount 0..2, radius in px, threshold in luma levels.
 */
export function unsharpMask(img: RGBAImage, amount = 0.6, radius = 1.2, threshold = 2): RGBAImage {
  const { width: w, height: h } = img;
  const out = cloneImage(img);
  const d = out.data;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = luma(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  const B = gaussianBlurChannel(L, w, h, radius);
  for (let i = 0; i < w * h; i++) {
    const diff = L[i] - B[i];
    if (Math.abs(diff) < threshold) continue;
    const delta = diff * amount;
    d[i * 4] = clamp255(d[i * 4] + delta);
    d[i * 4 + 1] = clamp255(d[i * 4 + 1] + delta);
    d[i * 4 + 2] = clamp255(d[i * 4 + 2] + delta);
  }
  return out;
}

export interface WhiteBackgroundOptions {
  /** Max channel difference from the background colour still treated as background (0-120). */
  tolerance?: number;
  /** Soft edge width in px. */
  feather?: number;
  /** Remove isolated dust/specks on the background smaller than this fraction of the image. */
  speckMaxFraction?: number;
  /** Output: composite on a colour, or keep transparency. */
  output?: 'white' | 'transparent';
  backgroundColor?: [number, number, number];
  /** Synthetic soft contact shadow under the product, 0 = none, 1 = strong. */
  shadow?: number;
}

export interface WhiteBackgroundResult {
  image: RGBAImage;
  detectedBackground: [number, number, number];
  backgroundFraction: number;
  specksRemoved: number;
  productBox: Rect | null;
  warnings: string[];
}

/**
 * Replace a reasonably plain studio background with pure white (or transparency).
 * Background = pixels connected to the image border whose colour is within `tolerance`
 * of the detected border colour. Enclosed areas (e.g. clear lenses inside a frame) are kept.
 * Product pixels are copied unchanged.
 */
export function whiteBackground(img: RGBAImage, opts: WhiteBackgroundOptions = {}): WhiteBackgroundResult {
  const { width: w, height: h, data: s } = img;
  const n = w * h;
  const tol = Math.max(1, Math.min(120, opts.tolerance ?? 38));
  const warnings: string[] = [];
  const bgStats = analyzeBackground(img);
  const bg = bgStats.color;
  if (bgStats.status === 'busy') {
    warnings.push(
      'Background is not plain. Automatic cleanup works best on studio shots; check edges carefully or use an AI background-removal provider.'
    );
  }

  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (s[p + 3] < 16) {
      dist[i] = 0;
      continue;
    }
    dist[i] = Math.max(Math.abs(s[p] - bg[0]), Math.abs(s[p + 1] - bg[1]), Math.abs(s[p + 2] - bg[2]));
  }

  // Flood fill from the border.
  const isBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0, qt = 0;
  const push = (i: number) => {
    if (!isBg[i] && dist[i] <= tol) {
      isBg[i] = 1;
      queue[qt++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }

  // Connected components of the foreground: remove small specks away from the product.
  const label = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const boxes: Rect[] = [];
  for (let start = 0; start < n; start++) {
    if (isBg[start] || label[start] >= 0) continue;
    const id = sizes.length;
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
    qh = qt = 0;
    queue[qt++] = start;
    label[start] = id;
    while (qh < qt) {
      const i = queue[qh++];
      count++;
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && !isBg[i - 1] && label[i - 1] < 0) { label[i - 1] = id; queue[qt++] = i - 1; }
      if (x < w - 1 && !isBg[i + 1] && label[i + 1] < 0) { label[i + 1] = id; queue[qt++] = i + 1; }
      if (i >= w && !isBg[i - w] && label[i - w] < 0) { label[i - w] = id; queue[qt++] = i - w; }
      if (i < n - w && !isBg[i + w] && label[i + w] < 0) { label[i + w] = id; queue[qt++] = i + w; }
    }
    sizes.push(count);
    boxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
  }

  const speckMax = Math.max(4, n * (opts.speckMaxFraction ?? 0.0004));
  const largest = sizes.reduce((m, v) => Math.max(m, v), 0);
  // Union box of significant components = product region.
  let px0 = w, py0 = h, px1 = -1, py1 = -1;
  sizes.forEach((sz, id) => {
    if (sz > speckMax || sz >= largest * 0.02) {
      const b = boxes[id];
      px0 = Math.min(px0, b.x);
      py0 = Math.min(py0, b.y);
      px1 = Math.max(px1, b.x + b.width - 1);
      py1 = Math.max(py1, b.y + b.height - 1);
    }
  });
  const margin = Math.round(Math.min(w, h) * 0.01);
  const removeIds = new Set<number>();
  sizes.forEach((sz, id) => {
    if (sz > speckMax) return;
    const b = boxes[id];
    const inside =
      px1 >= 0 && b.x >= px0 - margin && b.y >= py0 - margin && b.x + b.width - 1 <= px1 + margin && b.y + b.height - 1 <= py1 + margin;
    if (!inside) removeIds.add(id);
  });
  if (removeIds.size) {
    for (let i = 0; i < n; i++) {
      if (!isBg[i] && removeIds.has(label[i])) {
        isBg[i] = 1;
        dist[i] = 0; // fully background, no partial alpha
      }
    }
  }

  // Alpha matte: product = 1; background pixels near the tolerance edge keep partial alpha (anti-aliasing).
  let alpha = new Float32Array(n);
  let bgCount = 0;
  for (let i = 0; i < n; i++) {
    if (!isBg[i]) {
      alpha[i] = s[i * 4 + 3] / 255;
      continue;
    }
    bgCount++;
    const t = (dist[i] - tol * 0.6) / (tol * 0.4);
    alpha[i] = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    alpha[i] *= s[i * 4 + 3] / 255;
  }
  const feather = Math.max(0, Math.min(6, opts.feather ?? 1));
  if (feather >= 1) {
    const blurred = boxBlur(alpha, w, h, Math.round(feather));
    // Only soften edges outward: never reduce opacity inside the product.
    for (let i = 0; i < n; i++) if (isBg[i]) alpha[i] = Math.max(alpha[i], Math.min(blurred[i], 1));
  }

  const productBox = px1 >= 0 ? { x: px0, y: py0, width: px1 - px0 + 1, height: py1 - py0 + 1 } : null;
  if (!productBox) warnings.push('No product detected: the whole image looked like background. Lower the tolerance.');

  // Optional synthetic contact shadow beneath the product box.
  let shadow: Float32Array | null = null;
  const shadowStrength = Math.max(0, Math.min(1, opts.shadow ?? 0));
  if (shadowStrength > 0 && productBox) {
    shadow = new Float32Array(n);
    const cx = productBox.x + productBox.width / 2;
    const cy = Math.min(h - 1, productBox.y + productBox.height * 0.98);
    const rx = productBox.width * 0.48;
    const ry = Math.max(3, productBox.height * 0.07);
    for (let y = Math.max(0, Math.floor(cy - ry * 3)); y < Math.min(h, Math.ceil(cy + ry * 3)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx * 1.5)); x < Math.min(w, Math.ceil(cx + rx * 1.5)); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const r2 = dx * dx + dy * dy;
        shadow[y * w + x] = 0.35 * shadowStrength * Math.exp(-r2 * 1.6);
      }
    }
  }

  const outData = new Uint8ClampedArray(n * 4);
  const fill = opts.backgroundColor ?? [255, 255, 255];
  const transparent = opts.output === 'transparent';
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const a = alpha[i];
    if (transparent) {
      outData[p] = s[p];
      outData[p + 1] = s[p + 1];
      outData[p + 2] = s[p + 2];
      const sh = shadow ? shadow[i] * (1 - a) : 0;
      outData[p + 3] = clamp255(Math.max(a, sh) * 255);
      if (sh > a) outData[p] = outData[p + 1] = outData[p + 2] = 0;
      continue;
    }
    if (a >= 1) {
      outData[p] = s[p];
      outData[p + 1] = s[p + 1];
      outData[p + 2] = s[p + 2];
    } else {
      const sh = shadow ? 1 - shadow[i] : 1;
      outData[p] = s[p] * a + fill[0] * sh * (1 - a);
      outData[p + 1] = s[p + 1] * a + fill[1] * sh * (1 - a);
      outData[p + 2] = s[p + 2] * a + fill[2] * sh * (1 - a);
    }
    outData[p + 3] = 255;
  }

  return {
    image: { width: w, height: h, data: outData },
    detectedBackground: bg,
    backgroundFraction: bgCount / n,
    specksRemoved: removeIds.size,
    productBox,
    warnings
  };
}

export interface EnhanceOptions {
  levels?: boolean;
  neutralize?: boolean;
  denoise?: number; // 0 = off, else sigma
  sharpen?: number; // unsharp amount 0..2
  clarity?: number; // large-radius local contrast 0..1
  tone?: ToneAdjustments;
}

export const ENHANCE_DEFAULTS: EnhanceOptions = {
  levels: true,
  neutralize: false,
  denoise: 8,
  sharpen: 0.5,
  clarity: 0.15,
  tone: { brightness: 0, contrast: 0, saturation: 0 }
};

/** Product-safe enhancement chain: levels -> white balance -> denoise -> clarity -> sharpen -> tone. */
export function enhance(img: RGBAImage, opts: EnhanceOptions = ENHANCE_DEFAULTS): RGBAImage {
  let out = img;
  if (opts.levels) out = autoLevels(out);
  if (opts.neutralize) out = neutralizeBackgroundCast(out);
  if (opts.denoise && opts.denoise > 0) out = denoise(out, opts.denoise);
  if (opts.clarity && opts.clarity > 0) {
    out = unsharpMask(out, opts.clarity, Math.max(4, Math.min(out.width, out.height) * 0.015), 1);
  }
  if (opts.sharpen && opts.sharpen > 0) out = unsharpMask(out, opts.sharpen, 1.2, 2);
  if (opts.tone && (opts.tone.brightness || opts.tone.contrast || opts.tone.saturation)) out = adjustTone(out, opts.tone);
  return out === img ? cloneImage(img) : out;
}
