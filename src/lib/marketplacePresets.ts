// Editable marketplace export presets and the validation report built from them.
// Marketplace rules change: every default below is a starting point flagged for
// verification against the marketplace's current seller guidelines.

import type { ImageFormat } from './format.ts';
import { aspectRatioLabel, formatBytes, FORMAT_LABEL, gcd } from './format.ts';
import type { FitStrategy } from './dimensions.ts';
import type { QualityReport } from './analysis.ts';

export interface MarketplacePreset {
  id: string;
  marketplace: string;
  name: string;
  imageType: 'product' | 'model' | 'any';
  width: number;
  height: number;
  /** Background fill used when padding/letterboxing. 'transparent' requires PNG/WebP. */
  background: string;
  format: ImageFormat;
  /** 1-100, used for JPG/WebP */
  quality: number;
  /** null = no limit */
  maxFileSizeKB: number | null;
  fit: FitStrategy;
  /** Padding around the product as % of the shorter side */
  paddingPct: number;
  allowUpscale: boolean;
  requireWhiteBackground: boolean;
  /** Minimum share of the longer image side the product should span (e.g. 85). null = no check. */
  minProductFillPct: number | null;
  /** Minimum acceptable longer side in px for the source/output. null = none. */
  minLongSidePx: number | null;
  needsVerification: boolean;
  notes: string;
  builtIn?: boolean;
}

const VERIFY_NOTE = 'Starting values only. Verify against the latest seller guidelines before bulk uploads.';

export const DEFAULT_PRESETS: MarketplacePreset[] = [
  {
    id: 'amazon-main', marketplace: 'Amazon', name: 'Amazon main product image', imageType: 'product',
    width: 2000, height: 2000, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 10240,
    fit: 'product', paddingPct: 6, allowUpscale: true, requireWhiteBackground: true, minProductFillPct: 85,
    minLongSidePx: 1000, needsVerification: true, notes: VERIFY_NOTE, builtIn: true
  },
  {
    id: 'amazon-lifestyle', marketplace: 'Amazon', name: 'Amazon secondary / model image', imageType: 'model',
    width: 2000, height: 2000, background: '#FFFFFF', format: 'jpeg', quality: 90, maxFileSizeKB: 10240,
    fit: 'contain', paddingPct: 0, allowUpscale: true, requireWhiteBackground: false, minProductFillPct: null,
    minLongSidePx: 1000, needsVerification: true, notes: VERIFY_NOTE, builtIn: true
  },
  {
    id: 'myntra-product', marketplace: 'Myntra', name: 'Myntra product image', imageType: 'product',
    width: 1080, height: 1440, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 5120,
    fit: 'product', paddingPct: 8, allowUpscale: true, requireWhiteBackground: true, minProductFillPct: 70,
    minLongSidePx: 1440, needsVerification: true, notes: VERIFY_NOTE, builtIn: true
  },
  {
    id: 'myntra-model', marketplace: 'Myntra', name: 'Myntra model image', imageType: 'model',
    width: 1080, height: 1440, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 5120,
    fit: 'cover', paddingPct: 0, allowUpscale: true, requireWhiteBackground: false, minProductFillPct: null,
    minLongSidePx: 1440, needsVerification: true, notes: VERIFY_NOTE, builtIn: true
  },
  {
    id: 'ajio-product', marketplace: 'AJIO', name: 'AJIO product image', imageType: 'product',
    width: 1080, height: 1350, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 5120,
    fit: 'product', paddingPct: 8, allowUpscale: true, requireWhiteBackground: true, minProductFillPct: 70,
    minLongSidePx: 1350, needsVerification: true,
    notes: VERIFY_NOTE + ' AJIO rejects WebP image links in feeds; keep JPG.', builtIn: true
  },
  {
    id: 'ajio-model', marketplace: 'AJIO', name: 'AJIO model image', imageType: 'model',
    width: 1080, height: 1350, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 5120,
    fit: 'cover', paddingPct: 0, allowUpscale: true, requireWhiteBackground: false, minProductFillPct: null,
    minLongSidePx: 1350, needsVerification: true, notes: VERIFY_NOTE, builtIn: true
  },
  {
    id: 'flipkart-product', marketplace: 'Flipkart', name: 'Flipkart product image', imageType: 'product',
    width: 1100, height: 1100, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 10240,
    fit: 'product', paddingPct: 7, allowUpscale: true, requireWhiteBackground: true, minProductFillPct: 80,
    minLongSidePx: 1100, needsVerification: true,
    notes: VERIFY_NOTE + ' Flipkart listings use public JPEG URLs; main image = product on white, no model.', builtIn: true
  },
  {
    id: 'nykaa-product', marketplace: 'Nykaa', name: 'Nykaa product image', imageType: 'product',
    width: 1080, height: 1350, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 8192,
    fit: 'product', paddingPct: 8, allowUpscale: true, requireWhiteBackground: true, minProductFillPct: 70,
    minLongSidePx: 1080, needsVerification: true, notes: VERIFY_NOTE, builtIn: true
  },
  {
    id: 'shopify-product', marketplace: 'Shopify', name: 'Shopify product image', imageType: 'any',
    width: 2048, height: 2048, background: '#FFFFFF', format: 'jpeg', quality: 90, maxFileSizeKB: 20480,
    fit: 'product', paddingPct: 6, allowUpscale: true, requireWhiteBackground: false, minProductFillPct: null,
    minLongSidePx: 2048, needsVerification: true, notes: VERIFY_NOTE, builtIn: true
  },
  {
    id: 'generic-product', marketplace: 'Generic', name: 'Generic marketplace product photo', imageType: 'product',
    width: 2000, height: 2000, background: '#FFFFFF', format: 'jpeg', quality: 92, maxFileSizeKB: 5120,
    fit: 'product', paddingPct: 6, allowUpscale: true, requireWhiteBackground: true, minProductFillPct: 80,
    minLongSidePx: 1000, needsVerification: false, notes: 'Neutral studio default.', builtIn: true
  }
];

export function presetRatioLabel(p: Pick<MarketplacePreset, 'width' | 'height'>): string {
  const g = gcd(p.width, p.height);
  const a = p.width / g, b = p.height / g;
  return a <= 32 && b <= 32 ? `${a}:${b}` : aspectRatioLabel(p.width, p.height);
}

export function validatePresetDefinition(p: MarketplacePreset): string[] {
  const errors: string[] = [];
  if (!p.name.trim()) errors.push('Name is required.');
  if (!(Number.isInteger(p.width) && p.width >= 16 && p.width <= 16384)) errors.push('Width must be 16–16384 px.');
  if (!(Number.isInteger(p.height) && p.height >= 16 && p.height <= 16384)) errors.push('Height must be 16–16384 px.');
  if (!(p.quality >= 1 && p.quality <= 100)) errors.push('Quality must be 1–100.');
  if (p.maxFileSizeKB !== null && !(p.maxFileSizeKB > 0)) errors.push('Max file size must be positive or empty.');
  if (p.background === 'transparent' && p.format === 'jpeg') errors.push('JPG cannot store transparency; pick PNG/WebP or a colour.');
  if (p.background !== 'transparent' && !/^#[0-9a-fA-F]{6}$/.test(p.background)) errors.push('Background must be #RRGGBB or transparent.');
  if (p.paddingPct < 0 || p.paddingPct > 45) errors.push('Padding must be 0–45%.');
  return errors;
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface ValidationItem {
  id: string;
  label: string;
  value: string;
  status: CheckStatus;
  message?: string;
}

export interface ExportFacts {
  width: number;
  height: number;
  /** Format detected from the encoded bytes */
  format: ImageFormat | null;
  fileSize: number;
  quality?: QualityReport;
  /** Uniform scale used for the placement (for stretch detection; always uniform in this app). */
  scaleX?: number;
  scaleY?: number;
  /** Size of the source image before export */
  sourceWidth?: number;
  sourceHeight?: number;
  upscaleMethod?: string;
}

/** Build the pre-export validation report. Never claims marketplace approval. */
export function buildValidationReport(facts: ExportFacts, preset?: MarketplacePreset | null): ValidationItem[] {
  const items: ValidationItem[] = [];
  const ratio = aspectRatioLabel(facts.width, facts.height);
  items.push({
    id: 'dimensions',
    label: 'Final dimensions',
    value: `${facts.width} × ${facts.height} px`,
    status: preset ? (facts.width === preset.width && facts.height === preset.height ? 'pass' : 'fail') : 'info',
    message: preset && (facts.width !== preset.width || facts.height !== preset.height)
      ? `Preset expects ${preset.width} × ${preset.height} px.`
      : undefined
  });
  let ratioStatus: CheckStatus = 'info';
  let ratioMsg: string | undefined;
  if (preset) {
    const want = preset.width / preset.height;
    const got = facts.width / facts.height;
    ratioStatus = Math.abs(got - want) / want <= 0.005 ? 'pass' : 'fail';
    if (ratioStatus === 'fail') ratioMsg = `Preset ratio is ${presetRatioLabel(preset)}.`;
  }
  items.push({ id: 'ratio', label: 'Actual aspect ratio', value: ratio, status: ratioStatus, message: ratioMsg });

  items.push({
    id: 'format',
    label: 'File format (from file bytes)',
    value: facts.format ? FORMAT_LABEL[facts.format] : 'Unknown',
    status: !facts.format ? 'fail' : preset ? (facts.format === preset.format ? 'pass' : 'fail') : 'info',
    message: preset && facts.format !== preset.format ? `Preset expects ${FORMAT_LABEL[preset.format]}.` : undefined
  });

  const maxBytes = preset?.maxFileSizeKB ? preset.maxFileSizeKB * 1024 : null;
  items.push({
    id: 'filesize',
    label: 'File size',
    value: formatBytes(facts.fileSize, 2),
    status: maxBytes ? (facts.fileSize <= maxBytes ? 'pass' : 'fail') : 'info',
    message: maxBytes && facts.fileSize > maxBytes ? `Over the ${formatBytes(maxBytes)} limit.` : undefined
  });

  if (facts.scaleX !== undefined && facts.scaleY !== undefined) {
    const stretched = Math.abs(facts.scaleX - facts.scaleY) / Math.max(facts.scaleX, facts.scaleY) > 0.002;
    items.push({
      id: 'stretch',
      label: 'Proportions',
      value: stretched ? 'Stretched' : 'Uniform scale (no stretching)',
      status: stretched ? 'fail' : 'pass'
    });
  }

  if (facts.sourceWidth && facts.sourceHeight) {
    items.push({
      id: 'source',
      label: 'Original → final resolution',
      value: `${facts.sourceWidth} × ${facts.sourceHeight} → ${facts.width} × ${facts.height}`,
      status: 'info',
      message: facts.upscaleMethod
    });
  }

  const q = facts.quality;
  if (q) {
    const bg = q.background;
    const bgLabel: Record<typeof bg.status, string> = {
      'pure-white': `Pure white (${(bg.pureWhiteFraction * 100).toFixed(1)}% of border ≥ RGB 250)`,
      'near-white': `Near white (${(bg.nearWhiteFraction * 100).toFixed(1)}% ≥ RGB 235)`,
      transparent: 'Transparent',
      'uniform-color': `Uniform colour rgb(${bg.color.join(', ')})`,
      busy: 'Not plain / busy'
    };
    let bgStatus: CheckStatus = 'info';
    if (preset?.requireWhiteBackground) {
      bgStatus = bg.status === 'pure-white' ? 'pass' : bg.status === 'near-white' ? 'warn' : 'fail';
    }
    items.push({ id: 'background', label: 'Background (border pixels)', value: bgLabel[bg.status], status: bgStatus });

    items.push({
      id: 'transparency',
      label: 'Transparency',
      value: q.transparency.any ? `${(q.transparency.fraction * 100).toFixed(1)}% transparent pixels` : 'None (fully opaque)',
      status: q.transparency.any && preset?.requireWhiteBackground ? 'warn' : 'info'
    });

    const sh = q.sharpness;
    items.push({
      id: 'sharpness',
      label: 'Sharpness',
      value: `${sh.level} (score ${sh.score.toFixed(0)})`,
      status: sh.level === 'sharp' ? 'pass' : sh.level === 'soft' ? 'warn' : 'fail',
      message: sh.level !== 'sharp' ? 'Edges look soft. Use a sharper source; upscaling cannot restore lost detail.' : undefined
    });

    const pr = q.product;
    if (pr.box) {
      const fill = pr.longSideFraction * 100;
      let fillStatus: CheckStatus = 'info';
      if (preset?.minProductFillPct) fillStatus = fill >= preset.minProductFillPct ? 'pass' : 'warn';
      items.push({
        id: 'fill',
        label: 'Product coverage (longer side)',
        value: `${fill.toFixed(0)}%`,
        status: fillStatus,
        message: fillStatus === 'warn' ? `Preset asks for ≥ ${preset!.minProductFillPct}%. Reduce padding.` : undefined
      });
      const t = pr.touches;
      const touching = [t.top && 'top', t.right && 'right', t.bottom && 'bottom', t.left && 'left'].filter(Boolean);
      items.push({
        id: 'crop',
        label: 'Product cropping',
        value: touching.length ? `Touches ${touching.join(', ')} edge` : 'Product fully inside frame',
        status: touching.length && preset?.imageType !== 'model' ? 'warn' : touching.length ? 'info' : 'pass',
        message: touching.length && preset?.imageType !== 'model' ? 'Product may be partially cropped.' : undefined
      });
      items.push({
        id: 'symmetry',
        label: 'Left/right symmetry',
        value: `${(pr.symmetry * 100).toFixed(0)}%`,
        status: 'info',
        message:
          pr.symmetry < 0.7
            ? 'Low symmetry. Expected for side/45° views; for a front view check for distortion or a cut-off temple.'
            : undefined
      });
    } else {
      items.push({ id: 'fill', label: 'Product detection', value: 'No product found against background', status: 'warn' });
    }
  }

  if (preset?.minLongSidePx) {
    const longSide = Math.max(facts.sourceWidth ?? facts.width, facts.sourceHeight ?? facts.height);
    items.push({
      id: 'source-res',
      label: 'Source resolution',
      value: `${longSide}px longer side`,
      status: longSide >= preset.minLongSidePx ? 'pass' : 'warn',
      message:
        longSide < preset.minLongSidePx
          ? `Source is below ${preset.minLongSidePx}px; output was upscaled, so fine detail is interpolated.`
          : undefined
    });
  }

  if (preset?.needsVerification) {
    items.push({
      id: 'verify',
      label: 'Preset status',
      value: 'Needs verification',
      status: 'warn',
      message: 'These rules are editable defaults, not confirmed current marketplace requirements.'
    });
  }
  return items;
}

export function summarizeReport(items: ValidationItem[]): { fails: number; warns: number; passes: number } {
  return {
    fails: items.filter((i) => i.status === 'fail').length,
    warns: items.filter((i) => i.status === 'warn').length,
    passes: items.filter((i) => i.status === 'pass').length
  };
}
