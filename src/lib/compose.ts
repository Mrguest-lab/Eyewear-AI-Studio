// Place a resampled image onto an output canvas buffer (pure, testable).

import type { RGBAImage } from './resample.ts';
import { createImage, resample } from './resample.ts';
import type { ResampleFilter } from './resample.ts';
import { computePlacement } from './dimensions.ts';
import type { PlacementOptions, Placement } from './dimensions.ts';

export function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Alpha-composite `src` over `dst` with its top-left at integer (dx, dy). Mutates dst. */
export function compositeOver(dst: RGBAImage, src: RGBAImage, dx: number, dy: number): void {
  const x0 = Math.max(0, dx), y0 = Math.max(0, dy);
  const x1 = Math.min(dst.width, dx + src.width), y1 = Math.min(dst.height, dy + src.height);
  const d = dst.data, s = src.data;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const sp = ((y - dy) * src.width + (x - dx)) * 4;
      const dp = (y * dst.width + x) * 4;
      const sa = s[sp + 3] / 255;
      if (sa >= 1) {
        d[dp] = s[sp]; d[dp + 1] = s[sp + 1]; d[dp + 2] = s[sp + 2]; d[dp + 3] = 255;
        continue;
      }
      if (sa <= 0) continue;
      const da = d[dp + 3] / 255;
      const oa = sa + da * (1 - sa);
      d[dp] = (s[sp] * sa + d[dp] * da * (1 - sa)) / oa;
      d[dp + 1] = (s[sp + 1] * sa + d[dp + 1] * da * (1 - sa)) / oa;
      d[dp + 2] = (s[sp + 2] * sa + d[dp + 2] * da * (1 - sa)) / oa;
      d[dp + 3] = oa * 255;
    }
  }
}

/** Replace transparency with a solid colour (needed for JPG). */
export function flatten(img: RGBAImage, color: [number, number, number]): RGBAImage {
  const out = createImage(img.width, img.height, [color[0], color[1], color[2], 255]);
  compositeOver(out, img, 0, 0);
  return out;
}

export interface RenderOptions extends PlacementOptions {
  width: number;
  height: number;
  /** '#RRGGBB' or 'transparent' */
  background: string;
  filter?: ResampleFilter;
}

/**
 * Render `src` onto an exact width x height output: uniform scale (never stretched),
 * product-safe placement, background fill, Lanczos resampling.
 */
export function renderToSize(src: RGBAImage, opts: RenderOptions): { image: RGBAImage; placement: Placement } {
  const placement = computePlacement(src.width, src.height, opts.width, opts.height, opts);
  const bg = opts.background === 'transparent' ? null : parseHexColor(opts.background) ?? [255, 255, 255];
  const out = createImage(opts.width, opts.height, bg ? [bg[0], bg[1], bg[2], 255] : [0, 0, 0, 0]);
  // Integer target box for the scaled image; keep the uniform scale.
  const dw = Math.max(1, Math.round(placement.draw.width));
  const dh = Math.max(1, Math.round(placement.draw.height));
  const scaled = dw === src.width && dh === src.height ? src : resample(src, dw, dh, opts.filter ?? 'lanczos3');
  compositeOver(out, scaled, Math.round(placement.draw.x), Math.round(placement.draw.y));
  return { image: out, placement };
}
