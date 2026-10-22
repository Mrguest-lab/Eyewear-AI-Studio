import type { OutputFormat, ResizeOptions } from '../types';
import { formatFromMime, sniffFormat } from '../lib/format';

/**
 * Loads an image file, blob, or URL into an HTMLImageElement
 */
export function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl: string | null = null;
    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file. Invalid format or corrupted file.'));
    };
  });
}

/**
 * Utility to format byte size nicely (e.g. "1.2 MB" or "420 KB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Derives output file extension from mime type
 */
export function getExtensionForFormat(format: OutputFormat): string {
  switch (format) {
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/avif':
      return 'avif';
    default:
      return 'jpg';
  }
}

/**
 * Computes destination canvas dimensions and image source/dest drawing rectangles
 */
export function calculateDrawDimensions(
  origW: number,
  origH: number,
  options: ResizeOptions
): {
  canvasWidth: number;
  canvasHeight: number;
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
} {
  const { width: targetW, height: targetH, fitMode, scalePercent } = options;

  if (fitMode === 'percentage') {
    const scale = Math.max(1, scalePercent) / 100;
    const canvasWidth = Math.round(origW * scale);
    const canvasHeight = Math.round(origH * scale);
    return {
      canvasWidth,
      canvasHeight,
      drawX: 0,
      drawY: 0,
      drawW: canvasWidth,
      drawH: canvasHeight
    };
  }

  if (fitMode === 'stretch') {
    return {
      canvasWidth: targetW,
      canvasHeight: targetH,
      drawX: 0,
      drawY: 0,
      drawW: targetW,
      drawH: targetH
    };
  }

  if (fitMode === 'maxBounds') {
    const ratio = Math.min(1, targetW / origW, targetH / origH);
    const canvasWidth = Math.round(origW * ratio);
    const canvasHeight = Math.round(origH * ratio);
    return {
      canvasWidth,
      canvasHeight,
      drawX: 0,
      drawY: 0,
      drawW: canvasWidth,
      drawH: canvasHeight
    };
  }

  if (fitMode === 'contain') {
    // Canvas is exact target dimensions
    const canvasWidth = targetW;
    const canvasHeight = targetH;

    // Scale image to fit inside without cropping
    const imageRatio = origW / origH;
    const canvasRatio = targetW / targetH;

    let drawW: number;
    let drawH: number;

    if (imageRatio > canvasRatio) {
      drawW = targetW;
      drawH = Math.round(targetW / imageRatio);
    } else {
      drawH = targetH;
      drawW = Math.round(targetH * imageRatio);
    }

    const drawX = Math.round((targetW - drawW) / 2);
    const drawY = Math.round((targetH - drawH) / 2);

    return { canvasWidth, canvasHeight, drawX, drawY, drawW, drawH };
  }

  // Cover mode (crop to fill)
  const canvasWidth = targetW;
  const canvasHeight = targetH;

  const imageRatio = origW / origH;
  const canvasRatio = targetW / targetH;

  let drawW: number;
  let drawH: number;

  if (imageRatio > canvasRatio) {
    drawH = targetH;
    drawW = Math.round(targetH * imageRatio);
  } else {
    drawW = targetW;
    drawH = Math.round(targetW / imageRatio);
  }

  const drawX = Math.round((targetW - drawW) / 2);
  const drawY = Math.round((targetH - drawH) / 2);

  return { canvasWidth, canvasHeight, drawX, drawY, drawW, drawH };
}

/**
 * Main processing function: turns an HTMLImageElement or File into processed Canvas Blob & metadata
 */
export async function processImage(
  source: File | Blob | HTMLImageElement,
  options: ResizeOptions
): Promise<{
  blob: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
  format: OutputFormat;
}> {
  const img = source instanceof HTMLImageElement ? source : await loadImage(source);

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  const dims = calculateDrawDimensions(origW, origH, options);
  const { canvasWidth, canvasHeight, drawX, drawY, drawW, drawH } = dims;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas context');

  // Smooth rendering settings
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Fill background color or handle transparency / blur backdrop
  const bgColor = options.adjustments?.backgroundColor || '#FFFFFF';

  if (options.adjustments?.backgroundColor === 'blur') {
    // Draw blurred image as backdrop
    ctx.save();
    ctx.filter = 'blur(20px) brightness(0.8)';
    ctx.drawImage(img, -20, -20, canvasWidth + 40, canvasHeight + 40);
    ctx.restore();
  } else if (bgColor !== 'transparent') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (options.format === 'image/jpeg') {
    // JPEGs do not support transparency; fallback to pure white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. Prepare transformations (rotation & flips)
  ctx.save();

  // Move canvas center for rotation/flip relative to draw position
  const centerX = drawX + drawW / 2;
  const centerY = drawY + drawH / 2;

  ctx.translate(centerX, centerY);

  if (options.adjustments?.rotate) {
    const rad = (options.adjustments.rotate * Math.PI) / 180;
    ctx.rotate(rad);
  }

  const scaleX = options.adjustments?.flipH ? -1 : 1;
  const scaleY = options.adjustments?.flipV ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  // Build filter CSS string
  const filters: string[] = [];
  if (options.adjustments?.brightness !== 0) {
    filters.push(`brightness(${100 + (options.adjustments?.brightness || 0)}%)`);
  }
  if (options.adjustments?.contrast !== 0) {
    filters.push(`contrast(${100 + (options.adjustments?.contrast || 0)}%)`);
  }
  if (options.adjustments?.saturation !== 0) {
    filters.push(`saturate(${100 + (options.adjustments?.saturation || 0)}%)`);
  }
  if (options.adjustments?.blur > 0) {
    filters.push(`blur(${options.adjustments.blur}px)`);
  }

  if (filters.length > 0) {
    ctx.filter = filters.join(' ');
  }

  // Draw the image centered relative to context translation
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  ctx.restore();

  // 3. Export to Blob with quality optimization
  let currentQuality = Math.min(1, Math.max(0.01, options.quality));
  let blob = await canvasToBlob(canvas, options.format, currentQuality);

  // If user requested a maximum target file size in bytes, adjust quality downward
  if (
    options.maxFileSizeBytes &&
    options.maxFileSizeBytes > 0 &&
    (options.format === 'image/jpeg' || options.format === 'image/webp' || options.format === 'image/avif')
  ) {
    let attempts = 0;
    while (blob.size > options.maxFileSizeBytes && currentQuality > 0.1 && attempts < 8) {
      currentQuality *= 0.85;
      const nextBlob = await canvasToBlob(canvas, options.format, currentQuality);
      if (nextBlob) {
        blob = nextBlob;
      }
      attempts++;
    }
  }

  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    width: canvasWidth,
    height: canvasHeight,
    size: blob.size,
    format: options.format
  };
}

/**
 * Helper to promise-ify canvas.toBlob. Browsers silently fall back to PNG for
 * formats they cannot encode (e.g. AVIF), so the result is checked by magic bytes.
 */
async function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas export failed'));
      },
      format,
      quality
    );
  });
  const actual = sniffFormat(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  if (actual !== formatFromMime(format)) {
    throw new Error(
      `This browser cannot encode ${getExtensionForFormat(format).toUpperCase()} (it produced ${actual ? actual.toUpperCase() : 'unknown data'}). Choose another format.`
    );
  }
  return blob;
}
