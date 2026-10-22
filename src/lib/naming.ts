// SKU-based output file naming.

import { sanitizeFileName, stripExtension } from './format.ts';

/**
 * Guess the SKU from an uploaded filename: drop the extension, a trailing " (2)" copy
 * marker and a trailing "_1"/"_02" shot index. Users can edit the result per image.
 */
export function skuFromFileName(fileName: string): string {
  let base = stripExtension(fileName).trim();
  base = base.replace(/\s*\(\d+\)$/, '');
  base = base.replace(/_\d{1,2}$/, '');
  return base.trim() || 'image';
}

export interface NameTokens {
  sku: string;
  name: string;
  index: number;
  preset?: string;
  width?: number;
  height?: number;
  view?: string;
  ext: string;
}

export const DEFAULT_NAME_TEMPLATE = '{sku}_{index}';

/** Render a filename template. Tokens: {sku} {name} {index} {index2} {preset} {w} {h} {view} */
export function renderFileName(template: string, t: NameTokens): string {
  const out = (template || DEFAULT_NAME_TEMPLATE)
    .replace(/\{sku\}/g, t.sku)
    .replace(/\{name\}/g, stripExtension(t.name))
    .replace(/\{index2\}/g, String(t.index).padStart(2, '0'))
    .replace(/\{index\}/g, String(t.index))
    .replace(/\{preset\}/g, t.preset ?? '')
    .replace(/\{w\}/g, t.width ? String(t.width) : '')
    .replace(/\{h\}/g, t.height ? String(t.height) : '')
    .replace(/\{view\}/g, t.view ?? '')
    .replace(/[_-]{2,}/g, (m) => m[0])
    .replace(/[_-]+$/, '');
  return `${sanitizeFileName(out)}.${t.ext}`;
}

/** Make names unique within one download/ZIP by appending -2, -3, ... before the extension. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return n;
    const dot = n.lastIndexOf('.');
    const candidate = dot > 0 ? `${n.slice(0, dot)}-${count + 1}${n.slice(dot)}` : `${n}-${count + 1}`;
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}
