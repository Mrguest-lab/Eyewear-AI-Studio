// Pure helpers for file formats, byte sizes and aspect-ratio labels.
// No DOM access here so the module can be unit-tested in Node.

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp';

export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp'
};

export const FORMAT_EXT: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  gif: 'gif',
  bmp: 'bmp'
};

export const FORMAT_LABEL: Record<ImageFormat, string> = {
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  gif: 'GIF',
  bmp: 'BMP'
};

/** Formats that the app can export to (encoding is verified at runtime). */
export const EXPORT_FORMATS: ImageFormat[] = ['jpeg', 'png', 'webp'];

export function formatFromMime(mime: string | undefined | null): ImageFormat | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg' || m === 'image/pjpeg') return 'jpeg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/avif') return 'avif';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/bmp') return 'bmp';
  return null;
}

/** Lossy formats accept a quality setting. */
export function isLossy(format: ImageFormat): boolean {
  return format === 'jpeg' || format === 'webp' || format === 'avif';
}

/** Formats that can hold an alpha channel. */
export function supportsAlpha(format: ImageFormat): boolean {
  return format === 'png' || format === 'webp' || format === 'avif' || format === 'gif';
}

/**
 * Detect the real encoding of an image from its first bytes (magic numbers).
 * Used to prove that an export is genuinely the requested format and not
 * a renamed fallback (browsers silently fall back to PNG for unsupported types).
 */
export function sniffFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return null;
}

function ascii(bytes: Uint8Array, start: number, len: number): string {
  let s = '';
  for (let i = start; i < start + len; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

const COMMON_RATIOS: [number, number][] = [
  [1, 1], [4, 5], [5, 4], [3, 4], [4, 3], [2, 3], [3, 2], [16, 9], [9, 16], [21, 9], [9, 21]
];

/**
 * Human label for the actual aspect ratio of width x height,
 * e.g. "4:5", or "≈3:4 (0.7499)" when the integers are not an exact match.
 */
export function aspectRatioLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '—';
  const g = gcd(width, height);
  const rw = width / g;
  const rh = height / g;
  if (rw <= 32 && rh <= 32) return `${rw}:${rh}`;
  const actual = width / height;
  let best: [number, number] | null = null;
  let bestErr = Infinity;
  for (const [a, b] of COMMON_RATIOS) {
    const err = Math.abs(actual - a / b) / (a / b);
    if (err < bestErr) {
      bestErr = err;
      best = [a, b];
    }
  }
  if (best && bestErr < 0.01) return `≈${best[0]}:${best[1]} (${actual.toFixed(4)})`;
  return actual.toFixed(4);
}

/** Parse "4:5" into a numeric width/height ratio. */
export function parseRatio(label: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:x×/]\s*(\d+(?:\.\d+)?)\s*$/.exec(label);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!(a > 0 && b > 0)) return null;
  return a / b;
}

export function stripExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** Make a string safe to use as a file name on Windows/macOS/Linux. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return cleaned || 'image';
}
