// Image quality analysis on raw RGBA pixels: sharpness, background, transparency,
// product bounding box and cropping/symmetry heuristics.
// These are automated heuristics; they cannot guarantee marketplace approval.

import type { RGBAImage } from './resample.ts';
import type { Rect } from './dimensions.ts';

export interface BackgroundStats {
  /** Median border color */
  color: [number, number, number];
  /** Fraction of border pixels that are pure white (all channels >= 250 and opaque). */
  pureWhiteFraction: number;
  /** Fraction of border pixels that are near-white (all channels >= 235 and opaque). */
  nearWhiteFraction: number;
  /** Fraction of border pixels with alpha < 250. */
  transparentFraction: number;
  /** Luminance standard deviation across the border ring (0 = perfectly uniform). */
  lumaStdDev: number;
  status: 'pure-white' | 'near-white' | 'transparent' | 'uniform-color' | 'busy';
}

export interface SharpnessResult {
  /** Mean of the top 1% absolute Laplacian responses, at a normalized 1024px analysis size. */
  score: number;
  level: 'sharp' | 'soft' | 'blurry';
}

export interface ProductDetection {
  box: Rect | null;
  /** Product box area as a fraction of the image area. */
  fillFraction: number;
  /** Fraction of the longer product side relative to the matching image side. */
  longSideFraction: number;
  /** Which image edges the product touches (possible crop). */
  touches: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  /** Left/right mirror similarity of the product mask, 0..1 (front views of eyewear are usually > 0.85). */
  symmetry: number;
}

export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Collect border ring pixel indices (ring thickness as fraction of the shorter side, min 1px). */
function borderIndices(w: number, h: number, frac = 0.02): number[] {
  const t = Math.max(1, Math.round(Math.min(w, h) * frac));
  const idx: number[] = [];
  const step = Math.max(1, Math.floor((w * h) / 400000)); // sample big images
  for (let y = 0; y < h; y += 1) {
    const edgeRow = y < t || y >= h - t;
    if (edgeRow) {
      for (let x = 0; x < w; x += step) idx.push(y * w + x);
    } else {
      for (let x = 0; x < t; x++) idx.push(y * w + x);
      for (let x = w - t; x < w; x++) idx.push(y * w + x);
    }
  }
  return idx;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = values.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
}

export function analyzeBackground(img: RGBAImage): BackgroundStats {
  const { width: w, height: h, data } = img;
  const idx = borderIndices(w, h);
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  let pure = 0, near = 0, transp = 0, sum = 0, sumSq = 0, opaque = 0;
  for (const i of idx) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
    if (a < 250) {
      transp++;
      continue;
    }
    opaque++;
    rs.push(r); gs.push(g); bs.push(b);
    if (r >= 250 && g >= 250 && b >= 250) pure++;
    if (r >= 235 && g >= 235 && b >= 235) near++;
    const l = luma(r, g, b);
    sum += l;
    sumSq += l * l;
  }
  const n = idx.length || 1;
  const mean = opaque ? sum / opaque : 0;
  const std = opaque ? Math.sqrt(Math.max(0, sumSq / opaque - mean * mean)) : 0;
  const stats: BackgroundStats = {
    color: [median(rs), median(gs), median(bs)],
    pureWhiteFraction: pure / n,
    nearWhiteFraction: near / n,
    transparentFraction: transp / n,
    lumaStdDev: std,
    status: 'busy'
  };
  if (stats.transparentFraction > 0.9) stats.status = 'transparent';
  else if (stats.pureWhiteFraction >= 0.98) stats.status = 'pure-white';
  else if (stats.nearWhiteFraction >= 0.95) stats.status = 'near-white';
  else if (std < 6) stats.status = 'uniform-color';
  return stats;
}

/** Downscale to a grayscale buffer whose longer side is at most maxSide (box filter). */
export function toGray(img: RGBAImage, maxSide = 1024): { gray: Float32Array; width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const gray = new Float32Array(w * h);
  const cnt = new Float32Array(w * h);
  const { data } = img;
  for (let y = 0; y < img.height; y++) {
    const ty = Math.min(h - 1, Math.floor(y * scale));
    for (let x = 0; x < img.width; x++) {
      const tx = Math.min(w - 1, Math.floor(x * scale));
      const p = (y * img.width + x) * 4;
      const a = data[p + 3] / 255;
      // Composite on white so transparent areas read as flat background.
      const l = luma(data[p], data[p + 1], data[p + 2]) * a + 255 * (1 - a);
      gray[ty * w + tx] += l;
      cnt[ty * w + tx]++;
    }
  }
  for (let i = 0; i < gray.length; i++) gray[i] /= cnt[i] || 1;
  return { gray, width: w, height: h };
}

export function measureSharpness(img: RGBAImage): SharpnessResult {
  const { gray, width: w, height: h } = toGray(img, 1024);
  if (w < 3 || h < 3) return { score: 0, level: 'blurry' };
  const resp: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      resp.push(Math.abs(lap));
    }
  }
  resp.sort((a, b) => b - a);
  const top = Math.max(1, Math.floor(resp.length * 0.01));
  let s = 0;
  for (let i = 0; i < top; i++) s += resp[i];
  const score = s / top;
  const level = score >= 40 ? 'sharp' : score >= 18 ? 'soft' : 'blurry';
  return { score, level };
}

export function hasTransparency(img: RGBAImage): { any: boolean; fraction: number } {
  let t = 0;
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) if (img.data[i * 4 + 3] < 255) t++;
  return { any: t > 0, fraction: t / n };
}

/**
 * Foreground mask: pixel differs from the background color by more than `threshold`
 * (max channel difference), or is opaque on a transparent background.
 */
export function foregroundMask(img: RGBAImage, bg: [number, number, number], threshold = 28): Uint8Array {
  const n = img.width * img.height;
  const mask = new Uint8Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const a = d[p + 3];
    if (a < 16) continue;
    const diff = Math.max(Math.abs(d[p] - bg[0]), Math.abs(d[p + 1] - bg[1]), Math.abs(d[p + 2] - bg[2]));
    if (diff > threshold) mask[i] = 1;
  }
  return mask;
}

export function detectProduct(img: RGBAImage, bgStats?: BackgroundStats, threshold = 28): ProductDetection {
  const bg = bgStats ?? analyzeBackground(img);
  const { width: w, height: h } = img;
  let mask: Uint8Array;
  if (bg.status === 'transparent') {
    mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (img.data[i * 4 + 3] >= 16) mask[i] = 1;
  } else {
    mask = foregroundMask(img, bg.color, threshold);
  }
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (count < Math.max(4, w * h * 0.0005) || maxX < 0) {
    return {
      box: null,
      fillFraction: 0,
      longSideFraction: 0,
      touches: { top: false, right: false, bottom: false, left: false },
      symmetry: 0
    };
  }
  const box = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  // Mirror symmetry of the mask inside the box.
  let inter = 0, union = 0;
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + Math.floor(box.width / 2); x++) {
      const mx = box.x + box.width - 1 - (x - box.x);
      const a = mask[y * w + x], b = mask[y * w + mx];
      if (a || b) union++;
      if (a && b) inter++;
    }
  }
  const edge = 1;
  return {
    box,
    fillFraction: (box.width * box.height) / (w * h),
    longSideFraction: Math.max(box.width / w, box.height / h),
    touches: {
      top: box.y <= edge - 1,
      left: box.x <= edge - 1,
      bottom: box.y + box.height >= h - edge + 1,
      right: box.x + box.width >= w - edge + 1
    },
    symmetry: union ? inter / union : 0
  };
}

export interface QualityReport {
  width: number;
  height: number;
  megapixels: number;
  sharpness: SharpnessResult;
  background: BackgroundStats;
  transparency: { any: boolean; fraction: number };
  product: ProductDetection;
}

export function analyzeImage(img: RGBAImage): QualityReport {
  const background = analyzeBackground(img);
  return {
    width: img.width,
    height: img.height,
    megapixels: (img.width * img.height) / 1e6,
    sharpness: measureSharpness(img),
    background,
    transparency: hasTransparency(img),
    product: detectProduct(img, background)
  };
}
