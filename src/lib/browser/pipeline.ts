// High-level browser pipeline: render to an exact size, encode, analyse and validate.

import type { RGBAImage } from '../resample.ts';
import type { Placement, FitStrategy, Rect } from '../dimensions.ts';
import type { QualityReport } from '../analysis.ts';
import type { MarketplacePreset, ValidationItem } from '../marketplacePresets.ts';
import { buildValidationReport, DEFAULT_PRESETS } from '../marketplacePresets.ts';
import type { ImageFormat } from '../format.ts';
import { canAllocate, encodeImage, runPixelOp } from './imageIO.ts';
import type { EncodeResult } from './imageIO.ts';

export async function analyze(img: RGBAImage): Promise<QualityReport> {
  const r = await runPixelOp<{ report: QualityReport }>({ op: 'analyze', image: img });
  return r.report;
}

export interface RenderSpec {
  width: number;
  height: number;
  strategy: FitStrategy;
  background: string;
  paddingPct?: number;
  productBox?: Rect | null;
  allowUpscale?: boolean;
}

export async function renderTo(img: RGBAImage, spec: RenderSpec): Promise<{ image: RGBAImage; placement: Placement }> {
  if (!canAllocate(spec.width, spec.height)) {
    throw new Error(
      `This browser cannot allocate a ${spec.width}×${spec.height} canvas (${((spec.width * spec.height) / 1e6).toFixed(1)} MP). iPhone/iPad Safari is limited to about 16.7 MP — use a desktop browser for 4K portrait sizes.`
    );
  }
  let productBox = spec.productBox;
  if (productBox === undefined && spec.strategy !== 'contain') {
    productBox = (await analyze(img)).product.box;
  }
  return runPixelOp({
    op: 'render',
    image: img,
    options: {
      width: spec.width,
      height: spec.height,
      strategy: spec.strategy,
      background: spec.background,
      paddingPct: spec.paddingPct ?? 0,
      productBox,
      allowUpscale: spec.allowUpscale ?? true
    }
  });
}

export interface ExportOutcome {
  image: RGBAImage;
  encode: EncodeResult;
  placement: Placement;
  quality: QualityReport;
  report: ValidationItem[];
  upscaleNote: string;
}

export function upscaleNote(placement: Placement, method: string): string {
  if (placement.scale > 1.005) {
    return `Upscaled ×${placement.scale.toFixed(2)} with ${method}. Interpolated pixels — this does not recover original photographic detail.`;
  }
  if (placement.scale < 0.995) return `Downscaled ×${placement.scale.toFixed(3)} (Lanczos-3).`;
  return 'Native resolution (no resampling).';
}

export async function exportWithPreset(
  img: RGBAImage,
  preset: MarketplacePreset,
  opts: { sourceWidth?: number; sourceHeight?: number; method?: string } = {}
): Promise<ExportOutcome> {
  const { image, placement } = await renderTo(img, {
    width: preset.width,
    height: preset.height,
    strategy: preset.fit,
    background: preset.background,
    paddingPct: preset.paddingPct,
    allowUpscale: preset.allowUpscale
  });
  const encode = await encodeImage(image, {
    format: preset.format,
    quality: preset.quality,
    flattenColor: preset.background === 'transparent' ? '#FFFFFF' : preset.background,
    maxBytes: preset.maxFileSizeKB ? preset.maxFileSizeKB * 1024 : null
  });
  const quality = await analyze(image);
  const note = upscaleNote(placement, opts.method || 'Lanczos-3 resampling (classical, not AI)');
  const report = buildValidationReport(
    {
      width: encode.width,
      height: encode.height,
      format: encode.format,
      fileSize: encode.blob.size,
      quality,
      scaleX: placement.scale,
      scaleY: placement.scale,
      sourceWidth: opts.sourceWidth ?? img.width,
      sourceHeight: opts.sourceHeight ?? img.height,
      upscaleMethod: note
    },
    preset
  );
  for (const n of placement.notes) report.push({ id: 'placement', label: 'Placement', value: n, status: /Warning/.test(n) ? 'warn' : 'info' });
  if (encode.flattened) report.push({ id: 'flatten', label: 'Transparency', value: 'Flattened onto background colour for JPG', status: 'info' });
  if (encode.qualityUsed !== undefined && encode.qualityUsed !== preset.quality) {
    report.push({ id: 'q', label: 'Quality', value: `Reduced to ${encode.qualityUsed} to meet the size limit`, status: 'info' });
  }
  return { image, encode, placement, quality, report, upscaleNote: note };
}

/** Ad-hoc export without a marketplace preset (e.g. "Upscale to 4K"). */
export function adhocPreset(width: number, height: number, format: ImageFormat, background = '#FFFFFF', fit: FitStrategy = 'contain'): MarketplacePreset {
  return {
    ...DEFAULT_PRESETS[DEFAULT_PRESETS.length - 1],
    id: 'adhoc',
    marketplace: 'Custom',
    name: `${width}×${height}`,
    width,
    height,
    format,
    background: background === 'transparent' && format === 'jpeg' ? '#FFFFFF' : background,
    fit,
    paddingPct: 0,
    quality: 92,
    maxFileSizeKB: null,
    requireWhiteBackground: false,
    minProductFillPct: null,
    minLongSidePx: null,
    needsVerification: false
  };
}
