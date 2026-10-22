// In-browser self-test for things that need a real canvas encoder:
// format conversion between JPG/PNG/WebP, transparency handling, exact output
// dimensions for 2K/4K presets, file-size targeting and ZIP packaging.
// Open /selftest.html on the deployed site (results also on window.__selftest).

import JSZip from 'jszip';
import { createImage } from './lib/resample';
import type { RGBAImage } from './lib/resample';
import { canEncode, encodeImage, loadImageFile, readHeader } from './lib/browser/imageIO';
import { exportWithPreset, renderTo } from './lib/browser/pipeline';
import { DEFAULT_PRESETS } from './lib/marketplacePresets';
import { getTargetSize, RATIOS } from './lib/dimensions';
import type { ImageFormat } from './lib/format';
import { sniffFormat } from './lib/format';

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

const results: Result[] = [];
const out = document.getElementById('out')!;

function log(r: Result) {
  results.push(r);
  const li = document.createElement('li');
  li.textContent = `${r.ok ? 'PASS' : r.detail.startsWith('SKIP') ? 'SKIP' : 'FAIL'}  ${r.name} — ${r.detail}`;
  li.style.color = r.ok ? '#00ff7f' : r.detail.startsWith('SKIP') ? '#fbbf24' : '#f87171';
  out.appendChild(li);
}

async function check(name: string, fn: () => Promise<string>) {
  try {
    log({ name, ok: true, detail: await fn() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log({ name, ok: msg.startsWith('SKIP'), detail: msg });
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** 320x200 test image: opaque red/blue halves + a fully transparent square. */
function testImage(): RGBAImage {
  const img = createImage(320, 200, [220, 30, 30, 255]);
  for (let y = 0; y < 200; y++) for (let x = 160; x < 320; x++) img.data.set([30, 60, 220, 255], (y * 320 + x) * 4);
  for (let y = 20; y < 60; y++) for (let x = 20; x < 60; x++) img.data.set([0, 0, 0, 0], (y * 320 + x) * 4);
  return img;
}

const px = (img: RGBAImage, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

async function main() {
  const formats: ImageFormat[] = ['jpeg', 'png', 'webp'];
  const support: Record<string, boolean> = {};
  for (const f of formats) support[f] = await canEncode(f);
  log({ name: 'Encoder support', ok: support.jpeg && support.png, detail: formats.map((f) => `${f}: ${support[f]}`).join(', ') });

  const src = testImage();
  const encoded: Partial<Record<ImageFormat, Blob>> = {};
  for (const f of formats) {
    await check(`Encode ${f.toUpperCase()}`, async () => {
      if (!support[f]) throw new Error('SKIP: browser cannot encode ' + f);
      const r = await encodeImage(src, { format: f, quality: 90, flattenColor: '#FFFFFF' });
      const sniffed = sniffFormat(await readHeader(r.blob));
      assert(sniffed === f, `bytes say ${sniffed}`);
      encoded[f] = r.blob;
      return `${r.blob.size} bytes, verified ${sniffed}${r.flattened ? ', transparency flattened' : ''}`;
    });
  }

  // Every conversion pair: decode source format, re-encode to target, verify.
  for (const from of formats) {
    for (const to of formats) {
      if (from === to) continue;
      await check(`Convert ${from.toUpperCase()} → ${to.toUpperCase()}`, async () => {
        if (!encoded[from] || !support[to]) throw new Error('SKIP: format not supported here');
        const decoded = await loadImageFile(encoded[from]!, `in.${from}`);
        assert(decoded.format === from, `input detected as ${decoded.format}`);
        const r = await encodeImage(decoded.image, { format: to, quality: 90, flattenColor: '#FFFFFF' });
        const back = await loadImageFile(r.blob, `out.${to}`);
        assert(back.format === to, `output is ${back.format}`);
        assert(back.width === 320 && back.height === 200, `size ${back.width}x${back.height}`);
        const hole = px(back.image, 40, 40);
        if (to === 'jpeg') assert(hole[3] === 255 && hole[0] > 240 && hole[1] > 240, `transparent area should be white, got ${hole}`);
        if (to !== 'jpeg' && from !== 'jpeg') assert(hole[3] === 0, `transparency lost: ${hole}`);
        const red = px(back.image, 100, 150);
        assert(red[0] > 180 && red[2] < 80, `colour drift ${red}`);
        return `${back.width}×${back.height}, ${r.blob.size} bytes, alpha@hole=${hole[3]}`;
      });
    }
  }

  await check('Transparent JPG fill colour', async () => {
    const r = await encodeImage(src, { format: 'jpeg', quality: 95, flattenColor: '#000000' });
    const back = await loadImageFile(r.blob);
    const hole = px(back.image, 40, 40);
    assert(hole[0] < 20 && hole[1] < 20, `expected black fill, got ${hole}`);
    return 'chosen background colour used';
  });

  await check('Max file size lowers JPG quality', async () => {
    const noisy = createImage(800, 800);
    for (let i = 0; i < noisy.data.length; i += 4) noisy.data.set([(i * 7) % 255, (i * 13) % 255, (i * 29) % 255, 255], i);
    const big = await encodeImage(noisy, { format: 'jpeg', quality: 95 });
    const limit = Math.round(big.blob.size * 0.6);
    const small = await encodeImage(noisy, { format: 'jpeg', quality: 95, maxBytes: limit, minQuality: 10 });
    assert(small.blob.size <= limit && !small.overSize, `${small.blob.size} > ${limit}`);
    return `${big.blob.size} → ${small.blob.size} bytes at q${small.qualityUsed}`;
  });

  // Exact 2K / 4K output sizes for every ratio (renders real canvases).
  const product = createImage(900, 600, [255, 255, 255, 255]);
  for (let y = 250; y < 350; y++) for (let x = 150; x < 750; x++) product.data.set([20, 20, 20, 255], (y * 900 + x) * 4);
  for (const tier of ['2k', '4k'] as const) {
    for (const r of RATIOS) {
      const { width, height } = getTargetSize(tier, r.id);
      await check(`Render ${tier.toUpperCase()} ${r.id}`, async () => {
        const { image, placement } = await renderTo(product, { width, height, strategy: 'product', background: '#FFFFFF', paddingPct: 5 });
        assert(image.width === width && image.height === height, `got ${image.width}x${image.height}`);
        assert(placement.productInside, 'product cropped');
        return `${width}×${height}, uniform scale ×${placement.scale.toFixed(3)}, product inside`;
      });
    }
  }

  await check('Amazon preset export + validation', async () => {
    const preset = DEFAULT_PRESETS.find((p) => p.id === 'amazon-main')!;
    const res = await exportWithPreset(product, preset);
    const dims = res.report.find((i) => i.id === 'dimensions')!;
    const fmt = res.report.find((i) => i.id === 'format')!;
    const bg = res.report.find((i) => i.id === 'background')!;
    assert(dims.status === 'pass' && fmt.status === 'pass', `${dims.value} ${fmt.value}`);
    assert(bg.status === 'pass', `background ${bg.value}`);
    return `${res.encode.width}×${res.encode.height} ${res.encode.format}, ${res.encode.blob.size} bytes`;
  });

  await check('ZIP packaging', async () => {
    const zip = new JSZip();
    zip.file('SKU-1/a.jpg', encoded.jpeg!);
    zip.file('SKU-1/b.png', encoded.png!);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const back = await JSZip.loadAsync(blob);
    const a = await back.file('SKU-1/a.jpg')!.async('uint8array');
    assert(sniffFormat(a) === 'jpeg' && a.length === encoded.jpeg!.size, 'jpg entry corrupted');
    return `${Object.keys(back.files).length} entries, ${blob.size} bytes`;
  });

  const failed = results.filter((r) => !r.ok);
  const summary = document.getElementById('summary')!;
  summary.textContent = `${results.length - failed.length}/${results.length} passed${failed.length ? ` — ${failed.length} failed` : ''}`;
  summary.style.color = failed.length ? '#f87171' : '#00ff7f';
  (window as any).__selftest = { done: true, passed: results.length - failed.length, failed: failed.length, results };
}

void main();
