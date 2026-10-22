// Output-size math: resolution tiers, aspect ratios and product-safe placement.
// Pure functions only (unit-tested in Node).

export type RatioId = '1:1' | '4:5' | '3:4' | '16:9' | '9:16';
export type ResolutionTier = 'standard' | '2k' | '4k';

export const RATIOS: { id: RatioId; label: string; w: number; h: number }[] = [
  { id: '1:1', label: 'Square 1:1', w: 1, h: 1 },
  { id: '4:5', label: 'Portrait 4:5', w: 4, h: 5 },
  { id: '3:4', label: 'Portrait 3:4', w: 3, h: 4 },
  { id: '16:9', label: 'Landscape 16:9', w: 16, h: 9 },
  { id: '9:16', label: 'Vertical 9:16', w: 9, h: 16 }
];

export const TIERS: { id: ResolutionTier; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: '2k', label: '2K' },
  { id: '4k', label: '4K' }
];

/**
 * Exact pixel sizes per tier and ratio. Portrait/square sizes are width-based
 * (2048 / 4096 wide); 16:9 and 9:16 use the common QHD / 4K UHD sizes.
 * 3:4 heights are the closest integer (2048 * 4/3 = 2730.67 -> 2731).
 */
export const RESOLUTION_TABLE: Record<RatioId, Record<ResolutionTier, { width: number; height: number }>> = {
  '1:1': {
    standard: { width: 1080, height: 1080 },
    '2k': { width: 2048, height: 2048 },
    '4k': { width: 4096, height: 4096 }
  },
  '4:5': {
    standard: { width: 1080, height: 1350 },
    '2k': { width: 2048, height: 2560 },
    '4k': { width: 4096, height: 5120 }
  },
  '3:4': {
    standard: { width: 1080, height: 1440 },
    '2k': { width: 2048, height: 2731 },
    '4k': { width: 4096, height: 5461 }
  },
  '16:9': {
    standard: { width: 1920, height: 1080 },
    '2k': { width: 2560, height: 1440 },
    '4k': { width: 3840, height: 2160 }
  },
  '9:16': {
    standard: { width: 1080, height: 1920 },
    '2k': { width: 1440, height: 2560 },
    '4k': { width: 2160, height: 3840 }
  }
};

export function getTargetSize(tier: ResolutionTier, ratio: RatioId): { width: number; height: number } {
  return { ...RESOLUTION_TABLE[ratio][tier] };
}

/** Closest integer height for a width at ratio rw:rh. */
export function heightForWidth(width: number, rw: number, rh: number): number {
  return Math.max(1, Math.round((width * rh) / rw));
}

export function widthForHeight(height: number, rw: number, rh: number): number {
  return Math.max(1, Math.round((height * rw) / rh));
}

export interface SizeLimits {
  minSide: number;
  maxSide: number;
  maxPixels: number;
}

/**
 * Default browser limits. Desktop Chrome/Edge/Firefox handle 16384px sides;
 * iOS Safari caps canvases at ~16.7 MP, which is below 4096x5120.
 */
export const BROWSER_LIMITS: SizeLimits = { minSide: 16, maxSide: 16384, maxPixels: 16384 * 16384 };
export const IOS_SAFARI_MAX_PIXELS = 16_777_216;

export function validateCustomSize(width: number, height: number, limits: SizeLimits = BROWSER_LIMITS): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(width) || !Number.isInteger(height)) errors.push('Width and height must be whole pixels.');
  if (width < limits.minSide || height < limits.minSide) errors.push(`Minimum side is ${limits.minSide}px.`);
  if (width > limits.maxSide || height > limits.maxSide) errors.push(`Maximum side is ${limits.maxSide}px.`);
  if (width * height > limits.maxPixels) {
    errors.push(`${(width * height / 1e6).toFixed(1)} MP exceeds the ${(limits.maxPixels / 1e6).toFixed(1)} MP limit.`);
  }
  return errors;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placement {
  /** Canvas (output) size */
  canvasWidth: number;
  canvasHeight: number;
  /** Where the whole source image is drawn on the canvas (may extend past edges when cropping). */
  draw: Rect;
  /** Uniform scale applied to the source. Width and height always share it: no stretching. */
  scale: number;
  /** True when part of the source falls outside the canvas. */
  cropped: boolean;
  /** True when the detected product box is fully inside the canvas. */
  productInside: boolean;
  /** Notes for the user explaining decisions (e.g. crop refused). */
  notes: string[];
}

export type FitStrategy = 'contain' | 'cover' | 'product';

export interface PlacementOptions {
  strategy: FitStrategy;
  /** Padding around the product/source as a percent of the shorter canvas side (0-45). */
  paddingPct?: number;
  /** Detected product bounding box in source pixels. Used to avoid cropping the product. */
  productBox?: Rect | null;
  /** Allow scaling the image up. Upscaling is still uniform; quality depends on the resampler. */
  allowUpscale?: boolean;
}

/**
 * Compute where to draw a srcW x srcH image on a target canvas without distorting it.
 * - contain: whole image visible, letterboxed with background.
 * - cover:   fills canvas; cropping is refused if it would cut the product box.
 * - product: scales so the product box (plus padding) fits the canvas and centers it,
 *            cropping only empty background.
 */
export function computePlacement(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  opts: PlacementOptions
): Placement {
  const notes: string[] = [];
  const pad = Math.max(0, Math.min(45, opts.paddingPct ?? 0)) / 100;
  const padPx = Math.round(Math.min(targetW, targetH) * pad);
  const innerW = Math.max(1, targetW - 2 * padPx);
  const innerH = Math.max(1, targetH - 2 * padPx);
  const allowUp = opts.allowUpscale ?? true;
  const box = opts.productBox && opts.productBox.width > 0 && opts.productBox.height > 0 ? opts.productBox : null;

  const containScale = Math.min(innerW / srcW, innerH / srcH);
  let scale: number;
  let cx: number; // canvas point where the source anchor lands
  let cy: number;
  let anchorX: number; // anchor in source pixels
  let anchorY: number;

  if (opts.strategy === 'product' && box) {
    scale = Math.min(innerW / box.width, innerH / box.height);
    anchorX = box.x + box.width / 2;
    anchorY = box.y + box.height / 2;
  } else if (opts.strategy === 'cover') {
    scale = Math.max(targetW / srcW, targetH / srcH);
    anchorX = srcW / 2;
    anchorY = srcH / 2;
    if (box) {
      const coverBoxW = box.width * scale;
      const coverBoxH = box.height * scale;
      if (coverBoxW > targetW || coverBoxH > targetH) {
        notes.push('Cover crop would cut the product; switched to contain to keep it whole.');
        scale = containScale;
      } else {
        // Shift the crop window so the product stays fully inside.
        anchorX = clampAnchor(srcW / 2, box.x, box.width, srcW, targetW / scale);
        anchorY = clampAnchor(srcH / 2, box.y, box.height, srcH, targetH / scale);
      }
    }
  } else {
    scale = containScale;
    anchorX = srcW / 2;
    anchorY = srcH / 2;
  }

  if (!allowUp && scale > 1) {
    notes.push('Upscaling disabled: image kept at original size inside the canvas.');
    scale = 1;
  }

  cx = targetW / 2;
  cy = targetH / 2;
  let dx = cx - anchorX * scale;
  let dy = cy - anchorY * scale;
  const dw = srcW * scale;
  const dh = srcH * scale;

  // In product mode, avoid showing empty canvas when the source could cover it:
  // keep the image edges from moving inside the canvas if the image is bigger than it.
  if (opts.strategy === 'product' && box) {
    if (dw >= targetW) dx = Math.min(0, Math.max(targetW - dw, dx));
    if (dh >= targetH) dy = Math.min(0, Math.max(targetH - dh, dy));
  }

  const draw = { x: dx, y: dy, width: dw, height: dh };
  const cropped = dx < -0.5 || dy < -0.5 || dx + dw > targetW + 0.5 || dy + dh > targetH + 0.5;
  let productInside = true;
  if (box) {
    const bx = dx + box.x * scale;
    const by = dy + box.y * scale;
    productInside =
      bx >= -0.5 && by >= -0.5 && bx + box.width * scale <= targetW + 0.5 && by + box.height * scale <= targetH + 0.5;
  }
  if (box && !productInside) notes.push('Warning: product extends beyond the canvas.');

  return { canvasWidth: targetW, canvasHeight: targetH, draw, scale, cropped, productInside, notes };
}

/** Keep a crop window of size `win` (source px) containing [boxStart, boxStart+boxLen]. Returns window center. */
function clampAnchor(center: number, boxStart: number, boxLen: number, srcLen: number, win: number): number {
  let start = center - win / 2;
  if (boxStart < start) start = boxStart;
  if (boxStart + boxLen > start + win) start = boxStart + boxLen - win;
  start = Math.max(0, Math.min(srcLen - win, start));
  return start + win / 2;
}

/** Describe how the final pixels were produced relative to the source pixels. */
export function describeScale(scale: number): string {
  if (Math.abs(scale - 1) < 0.005) return 'Native (1:1 pixels)';
  if (scale < 1) return `Downscaled ×${scale.toFixed(3)}`;
  return `Upscaled ×${scale.toFixed(2)}`;
}
