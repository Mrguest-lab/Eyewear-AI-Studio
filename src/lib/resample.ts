// Classical (non-AI) resampling on raw RGBA pixels.
// Lanczos-3 with premultiplied alpha: sharp, halo-free edges on transparent PNGs.
// This interpolates pixels; it cannot invent detail that the source does not contain.

export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type ResampleFilter = 'lanczos3' | 'bilinear';

function sinc(x: number): number {
  if (x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

const FILTERS: Record<ResampleFilter, { radius: number; fn: (x: number) => number }> = {
  lanczos3: { radius: 3, fn: (x) => (Math.abs(x) < 3 ? sinc(x) * sinc(x / 3) : 0) },
  bilinear: { radius: 1, fn: (x) => Math.max(0, 1 - Math.abs(x)) }
};

interface Contribs {
  start: Int32Array;
  count: Int32Array;
  weights: Float32Array;
  maxTaps: number;
}

function buildContributions(srcLen: number, dstLen: number, filter: ResampleFilter): Contribs {
  const { radius, fn } = FILTERS[filter];
  const scale = srcLen / dstLen;
  const support = scale > 1 ? radius * scale : radius;
  const filterScale = scale > 1 ? scale : 1;
  const maxTaps = Math.ceil(support * 2) + 1;
  const start = new Int32Array(dstLen);
  const count = new Int32Array(dstLen);
  const weights = new Float32Array(dstLen * maxTaps);
  for (let i = 0; i < dstLen; i++) {
    const center = (i + 0.5) * scale - 0.5;
    const left = Math.ceil(center - support);
    const right = Math.floor(center + support);
    let n = 0;
    let sum = 0;
    for (let j = left; j <= right && n < maxTaps; j++) {
      const w = fn((j - center) / filterScale);
      weights[i * maxTaps + n] = w;
      sum += w;
      n++;
    }
    if (sum !== 0) for (let k = 0; k < n; k++) weights[i * maxTaps + k] /= sum;
    start[i] = left;
    count[i] = n;
  }
  return { start, count, weights, maxTaps };
}

/**
 * Resize an RGBA image to dstW x dstH. Width and height are scaled independently,
 * so callers must pass dimensions that keep the intended aspect ratio
 * (see computePlacement) to avoid stretching.
 */
export function resample(src: RGBAImage, dstW: number, dstH: number, filter: ResampleFilter = 'lanczos3'): RGBAImage {
  const sw = src.width;
  const sh = src.height;
  if (dstW < 1 || dstH < 1) throw new Error('Target size must be at least 1x1');
  if (sw === dstW && sh === dstH) return { width: sw, height: sh, data: new Uint8ClampedArray(src.data) };

  // Premultiply into floats.
  const s = src.data;
  const pre = new Float32Array(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    const a = s[i * 4 + 3] / 255;
    pre[i * 4] = s[i * 4] * a;
    pre[i * 4 + 1] = s[i * 4 + 1] * a;
    pre[i * 4 + 2] = s[i * 4 + 2] * a;
    pre[i * 4 + 3] = s[i * 4 + 3];
  }

  // Horizontal pass: sw x sh -> dstW x sh
  const hc = buildContributions(sw, dstW, filter);
  const tmp = new Float32Array(dstW * sh * 4);
  for (let y = 0; y < sh; y++) {
    const row = y * sw;
    for (let x = 0; x < dstW; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      const st = hc.start[x];
      const n = hc.count[x];
      const wo = x * hc.maxTaps;
      for (let k = 0; k < n; k++) {
        let sx = st + k;
        if (sx < 0) sx = 0;
        else if (sx >= sw) sx = sw - 1;
        const w = hc.weights[wo + k];
        const p = (row + sx) * 4;
        r += pre[p] * w;
        g += pre[p + 1] * w;
        b += pre[p + 2] * w;
        a += pre[p + 3] * w;
      }
      const o = (y * dstW + x) * 4;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
      tmp[o + 3] = a;
    }
  }

  // Vertical pass: dstW x sh -> dstW x dstH, un-premultiply into bytes.
  const vc = buildContributions(sh, dstH, filter);
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const st = vc.start[y];
    const n = vc.count[y];
    const wo = y * vc.maxTaps;
    for (let x = 0; x < dstW; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < n; k++) {
        let sy = st + k;
        if (sy < 0) sy = 0;
        else if (sy >= sh) sy = sh - 1;
        const w = vc.weights[wo + k];
        const p = (sy * dstW + x) * 4;
        r += tmp[p] * w;
        g += tmp[p + 1] * w;
        b += tmp[p + 2] * w;
        a += tmp[p + 3] * w;
      }
      const o = (y * dstW + x) * 4;
      if (a <= 0.5) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      } else {
        const inv = 255 / a;
        out[o] = r * inv;
        out[o + 1] = g * inv;
        out[o + 2] = b * inv;
        out[o + 3] = a;
      }
    }
  }
  return { width: dstW, height: dstH, data: out };
}

export function createImage(width: number, height: number, fill?: [number, number, number, number]): RGBAImage {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) {
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = fill[0];
      data[i * 4 + 1] = fill[1];
      data[i * 4 + 2] = fill[2];
      data[i * 4 + 3] = fill[3];
    }
  }
  return { width, height, data };
}
