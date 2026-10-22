// Unit tests for the pure image libraries.
// Run: npm test   (node --experimental-strip-types --test tests/*.test.ts)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aspectRatioLabel, formatBytes, sniffFormat, parseRatio, sanitizeFileName } from '../src/lib/format.ts';
import {
  RESOLUTION_TABLE,
  getTargetSize,
  heightForWidth,
  computePlacement,
  validateCustomSize,
  IOS_SAFARI_MAX_PIXELS
} from '../src/lib/dimensions.ts';
import { resample, createImage } from '../src/lib/resample.ts';
import type { RGBAImage } from '../src/lib/resample.ts';
import { analyzeBackground, detectProduct, measureSharpness, analyzeImage } from '../src/lib/analysis.ts';
import { whiteBackground, autoLevels, enhance } from '../src/lib/enhance.ts';
import {
  DEFAULT_PRESETS,
  buildValidationReport,
  validatePresetDefinition,
  presetRatioLabel
} from '../src/lib/marketplacePresets.ts';
import { skuFromFileName, renderFileName, uniqueNames } from '../src/lib/naming.ts';
import { buildPhotoshootPrompt, DEFAULT_PHOTOSHOOT } from '../src/lib/prompts.ts';

// ---------- helpers ----------

/** A white canvas with a dark "sunglasses-like" rectangle pair in the middle. */
function productOnWhite(w: number, h: number, bg: [number, number, number] = [255, 255, 255]): RGBAImage {
  const img = createImage(w, h, [bg[0], bg[1], bg[2], 255]);
  const put = (x: number, y: number, c: [number, number, number]) => {
    const p = (y * w + x) * 4;
    img.data[p] = c[0];
    img.data[p + 1] = c[1];
    img.data[p + 2] = c[2];
  };
  const y0 = Math.round(h * 0.4), y1 = Math.round(h * 0.6);
  for (let y = y0; y < y1; y++) {
    for (let x = Math.round(w * 0.2); x < Math.round(w * 0.45); x++) put(x, y, [30, 30, 35]);
    for (let x = Math.round(w * 0.55); x < Math.round(w * 0.8); x++) put(x, y, [30, 30, 35]);
    // bridge
    if (y < y0 + 3) for (let x = Math.round(w * 0.45); x < Math.round(w * 0.55); x++) put(x, y, [30, 30, 35]);
  }
  return img;
}

// ---------- format ----------

test('sniffFormat identifies real encodings by magic bytes', () => {
  assert.equal(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(sniffFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  assert.equal(sniffFormat(webp), 'webp');
  const avif = new Uint8Array([0, 0, 0, 0x1c, ...new TextEncoder().encode('ftypavif')]);
  assert.equal(sniffFormat(avif), 'avif');
  assert.equal(sniffFormat(new Uint8Array([1, 2, 3, 4])), null);
});

test('aspectRatioLabel reports exact and approximate ratios', () => {
  assert.equal(aspectRatioLabel(2048, 2048), '1:1');
  assert.equal(aspectRatioLabel(2048, 2560), '4:5');
  assert.equal(aspectRatioLabel(3840, 2160), '16:9');
  assert.equal(aspectRatioLabel(2160, 3840), '9:16');
  assert.match(aspectRatioLabel(2048, 2731), /^≈3:4/);
  assert.equal(parseRatio('4:5'), 0.8);
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(sanitizeFileName('a/b:c?.jpg'), 'a-b-c-.jpg');
});

// ---------- dimensions ----------

test('resolution table matches the required 2K / 4K pixel sizes', () => {
  assert.deepEqual(getTargetSize('2k', '1:1'), { width: 2048, height: 2048 });
  assert.deepEqual(getTargetSize('4k', '1:1'), { width: 4096, height: 4096 });
  assert.deepEqual(getTargetSize('2k', '4:5'), { width: 2048, height: 2560 });
  assert.deepEqual(getTargetSize('4k', '4:5'), { width: 4096, height: 5120 });
  assert.deepEqual(getTargetSize('2k', '3:4'), { width: 2048, height: 2731 });
  assert.deepEqual(getTargetSize('4k', '3:4'), { width: 4096, height: 5461 });
  assert.deepEqual(getTargetSize('4k', '16:9'), { width: 3840, height: 2160 });
  assert.deepEqual(getTargetSize('4k', '9:16'), { width: 2160, height: 3840 });
  assert.equal(heightForWidth(2048, 3, 4), 2731);
  assert.equal(heightForWidth(4096, 3, 4), 5461);
  for (const ratio of Object.values(RESOLUTION_TABLE)) {
    for (const size of Object.values(ratio)) {
      assert.ok(Number.isInteger(size.width) && Number.isInteger(size.height));
    }
  }
});

test('custom size validation enforces limits', () => {
  assert.deepEqual(validateCustomSize(2000, 2000), []);
  assert.ok(validateCustomSize(20000, 100).length > 0);
  assert.ok(validateCustomSize(10, 10).length > 0);
  assert.ok(validateCustomSize(4096, 5120, { minSide: 16, maxSide: 16384, maxPixels: IOS_SAFARI_MAX_PIXELS }).length > 0);
});

test('contain placement never stretches and fits inside the canvas', () => {
  const p = computePlacement(1200, 800, 2048, 2560, { strategy: 'contain' });
  assert.equal(p.canvasWidth, 2048);
  assert.equal(p.canvasHeight, 2560);
  assert.ok(Math.abs(p.draw.width / p.draw.height - 1200 / 800) < 1e-9, 'aspect ratio preserved');
  assert.ok(p.draw.x >= -0.01 && p.draw.y >= -0.01);
  assert.ok(p.draw.x + p.draw.width <= 2048.01 && p.draw.y + p.draw.height <= 2560.01);
  assert.equal(p.cropped, false);
});

test('cover placement refuses to crop the product', () => {
  // Wide product spanning almost the whole width of a landscape photo, target is a tall portrait.
  const productBox = { x: 50, y: 300, width: 1100, height: 200 };
  const p = computePlacement(1200, 800, 1080, 1440, { strategy: 'cover', productBox });
  assert.equal(p.productInside, true);
  assert.ok(p.notes.some((n) => /switched to contain/.test(n)));
});

test('cover placement shifts the crop window to keep a small product inside', () => {
  const productBox = { x: 1000, y: 350, width: 150, height: 100 };
  const p = computePlacement(1200, 800, 1000, 1000, { strategy: 'cover', productBox });
  assert.equal(p.productInside, true);
  assert.equal(p.cropped, true);
});

test('product placement fills the target around the product with padding', () => {
  const productBox = { x: 200, y: 300, width: 800, height: 200 };
  const p = computePlacement(1200, 800, 2000, 2000, { strategy: 'product', productBox, paddingPct: 5 });
  assert.equal(p.productInside, true);
  const productW = productBox.width * p.scale;
  assert.ok(Math.abs(productW - 1800) < 1, `product spans 90% width, got ${productW}`);
});

// ---------- resample ----------

test('resample produces exact target dimensions and preserves flat colour', () => {
  const src = createImage(100, 80, [200, 100, 50, 255]);
  const up = resample(src, 400, 320);
  assert.equal(up.width, 400);
  assert.equal(up.height, 320);
  assert.equal(up.data.length, 400 * 320 * 4);
  const mid = (160 * 400 + 200) * 4;
  assert.deepEqual([...up.data.slice(mid, mid + 4)], [200, 100, 50, 255]);
  const down = resample(src, 25, 20);
  assert.equal(down.width, 25);
  assert.deepEqual([...down.data.slice(0, 4)], [200, 100, 50, 255]);
});

test('resample keeps transparent pixels transparent without dark halos', () => {
  const src = createImage(10, 10, [0, 0, 0, 0]);
  for (let y = 3; y < 7; y++) for (let x = 3; x < 7; x++) {
    const p = (y * 10 + x) * 4;
    src.data.set([255, 0, 0, 255], p);
  }
  const out = resample(src, 40, 40);
  assert.equal(out.data[3], 0, 'corner stays transparent');
  // Any visible pixel must stay pure red (premultiplied alpha avoids black fringes).
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] > 20) {
      assert.ok(out.data[i] >= 250 && out.data[i + 1] <= 5, `fringe at ${i / 4}`);
    }
  }
});

// ---------- analysis ----------

test('background analysis detects pure white and busy backgrounds', () => {
  assert.equal(analyzeBackground(productOnWhite(200, 150)).status, 'pure-white');
  const offWhite = productOnWhite(200, 150, [240, 240, 238]);
  assert.equal(analyzeBackground(offWhite).status, 'near-white');
  const noisy = createImage(100, 100);
  for (let i = 0; i < noisy.data.length; i += 4) {
    noisy.data[i] = (i * 37) % 256;
    noisy.data[i + 1] = (i * 91) % 256;
    noisy.data[i + 2] = (i * 13) % 256;
    noisy.data[i + 3] = 255;
  }
  assert.equal(analyzeBackground(noisy).status, 'busy');
});

test('product detection finds the bounding box, symmetry and edge contact', () => {
  const img = productOnWhite(200, 100);
  const det = detectProduct(img);
  assert.ok(det.box);
  assert.equal(det.box!.x, 40);
  assert.equal(det.box!.width, 120);
  assert.ok(det.symmetry > 0.95, `symmetric product, got ${det.symmetry}`);
  assert.deepEqual(det.touches, { top: false, right: false, bottom: false, left: false });
});

test('sharpness separates a crisp edge from a blurred one', () => {
  const sharp = productOnWhite(400, 300);
  const blurred = resample(resample(sharp, 40, 30, 'bilinear'), 400, 300, 'bilinear');
  const s1 = measureSharpness(sharp);
  const s2 = measureSharpness(blurred);
  assert.equal(s1.level, 'sharp');
  assert.ok(s2.score < s1.score / 3, `blurred ${s2.score} vs sharp ${s1.score}`);
  assert.notEqual(s2.level, 'sharp');
});

// ---------- enhance ----------

test('whiteBackground turns an off-white studio background pure white and keeps product pixels', () => {
  const img = productOnWhite(200, 120, [228, 226, 222]);
  // dust speck far from the product
  img.data.set([120, 120, 120, 255], (5 * 200 + 5) * 4);
  const before = [...img.data.slice(((60) * 200 + 60) * 4, ((60) * 200 + 60) * 4 + 4)];
  const res = whiteBackground(img, { tolerance: 40, feather: 1 });
  const bg = analyzeBackground(res.image);
  assert.equal(bg.status, 'pure-white');
  assert.equal(res.specksRemoved, 1);
  const p = (5 * 200 + 5) * 4;
  assert.deepEqual([...res.image.data.slice(p, p + 3)], [255, 255, 255], 'speck removed');
  const after = [...res.image.data.slice(((60) * 200 + 60) * 4, ((60) * 200 + 60) * 4 + 4)];
  assert.deepEqual(after, before, 'product pixel untouched');
  assert.ok(res.productBox);
});

test('whiteBackground keeps enclosed light regions (clear lens inside a frame)', () => {
  const w = 120, h = 80;
  const img = createImage(w, h, [235, 235, 235, 255]);
  // Frame ring with a light interior equal to the background colour.
  for (let y = 20; y < 60; y++) for (let x = 20; x < 100; x++) {
    const ring = y < 24 || y >= 56 || x < 24 || x >= 96;
    if (ring) img.data.set([20, 20, 20, 255], (y * w + x) * 4);
  }
  const res = whiteBackground(img, { tolerance: 30 });
  const inside = (40 * w + 60) * 4;
  assert.deepEqual([...res.image.data.slice(inside, inside + 3)], [235, 235, 235], 'lens interior preserved');
  const outside = (5 * w + 5) * 4;
  assert.deepEqual([...res.image.data.slice(outside, outside + 3)], [255, 255, 255]);
});

test('whiteBackground transparent output and contact shadow', () => {
  const res = whiteBackground(productOnWhite(200, 120, [240, 240, 240]), { output: 'transparent' });
  assert.equal(res.image.data[3], 0);
  const shadowed = whiteBackground(productOnWhite(200, 200), { shadow: 1 });
  const box = shadowed.productBox!;
  const y = Math.min(199, Math.round(box.y + box.height * 0.98) + 2);
  const p = (y * 200 + 100) * 4;
  assert.ok(shadowed.image.data[p] < 255, 'shadow darkens background under the product');
});

test('autoLevels stretches a flat low-contrast image while keeping hue', () => {
  const img = createImage(10, 10);
  for (let i = 0; i < 100; i++) {
    const v = 80 + (i % 10) * 10; // 80..170
    img.data.set([v, v * 0.5, v * 0.25, 255], i * 4);
  }
  const out = autoLevels(img, 0);
  let max = 0;
  for (let i = 0; i < out.data.length; i += 4) max = Math.max(max, out.data[i]);
  assert.ok(max > 230);
  const e = enhance(img);
  assert.equal(e.width, 10);
});

// ---------- presets & validation ----------

test('default presets are valid, editable and flagged for verification', () => {
  for (const p of DEFAULT_PRESETS) assert.deepEqual(validatePresetDefinition(p), [], p.id);
  const marketplaces = new Set(DEFAULT_PRESETS.map((p) => p.marketplace));
  for (const m of ['Amazon', 'Myntra', 'AJIO', 'Flipkart', 'Nykaa', 'Shopify', 'Generic']) assert.ok(marketplaces.has(m), m);
  assert.ok(DEFAULT_PRESETS.filter((p) => p.marketplace !== 'Generic').every((p) => p.needsVerification));
  assert.equal(presetRatioLabel({ width: 1080, height: 1440 }), '3:4');
  const bad = { ...DEFAULT_PRESETS[0], format: 'jpeg' as const, background: 'transparent' };
  assert.ok(validatePresetDefinition(bad).length > 0);
});

test('validation report flags dimension, format, size and background violations', () => {
  const preset = DEFAULT_PRESETS.find((p) => p.id === 'amazon-main')!;
  const okImg = productOnWhite(400, 400);
  const good = buildValidationReport(
    { width: 2000, height: 2000, format: 'jpeg', fileSize: 500_000, quality: analyzeImage(okImg), scaleX: 2, scaleY: 2 },
    preset
  );
  const byId = Object.fromEntries(good.map((i) => [i.id, i]));
  assert.equal(byId.dimensions.status, 'pass');
  assert.equal(byId.format.status, 'pass');
  assert.equal(byId.filesize.status, 'pass');
  assert.equal(byId.background.status, 'pass');
  assert.equal(byId.stretch.status, 'pass');
  assert.equal(byId.verify.status, 'warn');

  const bad = buildValidationReport(
    {
      width: 1999, height: 2000, format: 'png', fileSize: 11 * 1024 * 1024,
      quality: analyzeImage(productOnWhite(400, 400, [200, 210, 220])), scaleX: 2, scaleY: 1.5
    },
    preset
  );
  const b = Object.fromEntries(bad.map((i) => [i.id, i]));
  assert.equal(b.dimensions.status, 'fail');
  assert.equal(b.ratio.status, 'pass'); // 1999/2000 is within 0.5%
  assert.equal(b.format.status, 'fail');
  assert.equal(b.filesize.status, 'fail');
  assert.equal(b.background.status, 'fail');
  assert.equal(b.stretch.status, 'fail');
});

// ---------- naming & prompts ----------

test('SKU file naming', () => {
  assert.equal(skuFromFileName('VK-2190-C1 (2).jpg'), 'VK-2190-C1');
  assert.equal(skuFromFileName('SP-6800-RED_3.png'), 'SP-6800-RED');
  assert.equal(renderFileName('{sku}_{index2}_{preset}', { sku: 'TT-8234-PNK', name: 'x.jpg', index: 1, preset: 'amazon-main', ext: 'jpg' }), 'TT-8234-PNK_01_amazon-main.jpg');
  assert.equal(renderFileName('{sku}_{view}', { sku: 'A', name: 'x', index: 1, ext: 'png' }), 'A.png');
  assert.deepEqual(uniqueNames(['a.jpg', 'a.jpg', 'b.jpg', 'A.jpg']), ['a.jpg', 'a-2.jpg', 'b.jpg', 'A-3.jpg']);
});

test('photoshoot prompt locks the product and forbids watermarks', () => {
  const prompt = buildPhotoshootPrompt(DEFAULT_PHOTOSHOOT);
  assert.match(prompt, /adult woman/);
  assert.match(prompt, /Reproduce them EXACTLY/);
  assert.match(prompt, /No text, captions, watermarks/);
  const male = buildPhotoshootPrompt({ ...DEFAULT_PHOTOSHOOT, gender: 'male', shot: 'profile', preservation: 'creative' });
  assert.match(male, /adult man/);
  assert.match(male, /side-profile/);
});
