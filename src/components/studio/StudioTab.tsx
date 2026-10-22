import React, { useMemo, useState } from 'react';
import {
  Download,
  Eraser,
  FileType,
  Glasses,
  Maximize,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Undo2,
  UserRound,
  Wand2
} from 'lucide-react';
import type { TabProps, WorkImage } from './types';
import type { RGBAImage } from '../../lib/resample';
import { loadImageFile, encodeImage, downloadBlob, runPixelOp, referenceForAI, blobToDataUrl } from '../../lib/browser/imageIO';
import type { LoadedImage } from '../../lib/browser/imageIO';
import { exportWithPreset, renderTo } from '../../lib/browser/pipeline';
import type { ExportOutcome } from '../../lib/browser/pipeline';
import { usePresets } from '../../lib/browser/presetStore';
import type { EnhanceOptions, WhiteBackgroundOptions, WhiteBackgroundResult } from '../../lib/enhance';
import { ENHANCE_DEFAULTS } from '../../lib/enhance';
import { FORMAT_EXT, FORMAT_LABEL, aspectRatioLabel, formatBytes } from '../../lib/format';
import type { FitStrategy } from '../../lib/dimensions';
import { skuFromFileName, renderFileName } from '../../lib/naming';
import { buildProductViewPrompt, buildRelightPrompt } from '../../lib/prompts';
import type { ProductView } from '../../lib/prompts';
import { generate, loadOutput, removeBackground, upscale as aiUpscale } from '../../lib/browser/aiClient';
import { presetRatioLabel } from '../../lib/marketplacePresets';
import { Btn, CompareView, FilePicker, Notice, Panel, Select, Slider, Stat, ValidationReport, errorMessage, useBlobUrl, useRasterUrl, checkerStyle } from './ui';
import { DEFAULT_RESOLUTION, ResolutionPicker, resolveSize } from './ResolutionPicker';
import type { ResolutionValue } from './ResolutionPicker';
import { useAi } from './useAi';
import { AiProviderPicker, providerReady } from './AiProviderPicker';
import type { ProviderChoice } from './AiProviderPicker';

interface HistoryStep {
  image: RGBAImage;
  label: string;
  kind: 'original' | 'local' | 'ai';
}

interface RefView {
  id: string;
  view: 'front' | 'side' | 'three-quarter' | 'other';
  loaded: LoadedImage;
  file: File;
}

interface AiView {
  id: string;
  view: ProductView;
  image: RGBAImage;
  blob: Blob;
  provider: string;
  model: string;
}

export const StudioTab: React.FC<TabProps> = ({ work, setWork, goTo }) => {
  const [original, setOriginal] = useState<{ loaded: LoadedImage; file: Blob } | null>(null);
  const [sku, setSku] = useState('');
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [enhanceOpts, setEnhanceOpts] = useState<EnhanceOptions>(ENHANCE_DEFAULTS);
  const [wbOpts, setWbOpts] = useState<WhiteBackgroundOptions>({ tolerance: 38, feather: 1, shadow: 0.5, speckMaxFraction: 0.0004, output: 'white' });
  const [resolution, setResolution] = useState<ResolutionValue>(DEFAULT_RESOLUTION);
  const [fit, setFit] = useState<FitStrategy>('contain');
  const [upscaleMethod, setUpscaleMethod] = useState<'lanczos' | 'ai'>('lanczos');
  const [presets] = usePresets();
  const [presetId, setPresetId] = useState('amazon-main');
  const [exported, setExported] = useState<ExportOutcome | null>(null);
  const [refs, setRefs] = useState<RefView[]>([]);
  const [aiViews, setAiViews] = useState<AiView[]>([]);
  const [choice, setChoice] = useState<ProviderChoice>({ provider: '', consent: false });
  const ai = useAi();

  const current = history.length ? history[history.length - 1] : null;
  const beforeUrl = useBlobUrl(original?.file ?? null);
  const afterUrl = useRasterUrl(current && history.length > 1 ? current.image : null);
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const hasAi = history.some((h) => h.kind === 'ai');

  const startFrom = (img: RGBAImage, file: Blob, loaded: LoadedImage, label: string, kind: HistoryStep['kind'] = 'original') => {
    setOriginal({ loaded, file });
    setHistory([{ image: img, label, kind }]);
    setExported(null);
    setNotes([]);
    setError(null);
  };

  // Pick up an image sent from another tab (e.g. a photoshoot result).
  React.useEffect(() => {
    if (!work || (current && work.image === current.image)) return;
    const blob = work.sourceBlob ?? null;
    const loaded: LoadedImage = { image: work.image, width: work.image.width, height: work.image.height, format: null, size: blob?.size ?? 0, name: work.name };
    setSku(work.sku);
    if (blob) startFrom(work.image, blob, loaded, work.origin === 'ai' ? `AI-generated (${work.note ?? 'provider output'})` : 'Original', work.origin === 'ai' ? 'ai' : 'original');
  }, [work]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (image: RGBAImage, label: string, kind: HistoryStep['kind']) => {
    setHistory((h) => [...h, { image, label, kind }]);
    setExported(null);
    setWork({
      image,
      name: original?.loaded.name ?? 'image',
      sku: sku || 'image',
      origin: kind === 'ai' || hasAi ? 'ai' : 'edited',
      sourceBlob: original?.file
    });
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onUpload = (files: File[]) =>
    run('Loading image', async () => {
      const file = files[0];
      const loaded = await loadImageFile(file);
      setSku(skuFromFileName(file.name));
      startFrom(loaded.image, file, loaded, 'Original upload');
      setWork({ image: loaded.image, name: file.name, sku: skuFromFileName(file.name), origin: 'upload', sourceBlob: file });
    });

  const doEnhance = () =>
    run('Enhancing', async () => {
      const img = await runPixelOp<RGBAImage>({ op: 'enhance', image: current!.image, options: enhanceOpts });
      push(img, 'Enhanced (levels, denoise, clarity, sharpen)', 'local');
    });

  const doWhiteBg = () =>
    run('Cleaning background', async () => {
      const res = await runPixelOp<WhiteBackgroundResult>({ op: 'whiteBackground', image: current!.image, options: wbOpts });
      push(
        res.image,
        `${wbOpts.output === 'transparent' ? 'Transparent' : 'White'} background (${(res.backgroundFraction * 100).toFixed(0)}% replaced, ${res.specksRemoved} specks removed${
          wbOpts.shadow ? ', soft shadow' : ''
        })`,
        'local'
      );
      setNotes(res.warnings);
    });

  const doUpscale = (tierOverride?: '2k' | '4k') =>
    run(tierOverride ? `Upscaling to ${tierOverride.toUpperCase()}` : 'Resizing', async () => {
      const value = tierOverride ? { ...resolution, tier: tierOverride } : resolution;
      if (tierOverride) setResolution(value);
      const { width, height } = resolveSize(value);
      let src = current!.image;
      let label = '';
      if (upscaleMethod === 'ai') {
        if (!providerReady({ provider: 'replicate', consent: true }, ai.providers)) {
          throw new Error('AI upscaling needs the Replicate provider on your AI backend (see Settings). Use Lanczos for free local resizing.');
        }
        const needed = Math.max(width / src.width, height / src.height);
        const scale: 2 | 4 = needed > 2 ? 4 : 2;
        const enc = await encodeImage(src, { format: 'png' });
        const dataUrl = enc.blob.size < 12 * 1024 * 1024 ? await blobToDataUrl(enc.blob) : await referenceForAI(src, 3000, 'jpeg');
        const result = await aiUpscale(ai.settings, dataUrl, scale, (m) => setBusy(m));
        const { loaded } = await loadOutput(ai.settings, result.images[0].src, 'upscaled.png');
        label = `AI super-resolution (${result.model}, ×${scale}: ${src.width}×${src.height} → ${loaded.width}×${loaded.height}), then Lanczos-3 to ${width}×${height}`;
        src = loaded.image;
      }
      const { image, placement } = await renderTo(src, { width, height, strategy: fit, background: wbOpts.output === 'transparent' ? 'transparent' : '#FFFFFF' });
      if (!label) {
        label =
          placement.scale > 1.005
            ? `Classical upscale ×${placement.scale.toFixed(2)} (Lanczos-3, not AI) to ${width}×${height}`
            : `Resized to ${width}×${height} (Lanczos-3)`;
      }
      push(image, label, upscaleMethod === 'ai' ? 'ai' : 'local');
      setNotes([
        ...placement.notes,
        placement.scale > 1.005 ? 'Upscaling interpolates pixels. It does not recover photographic detail that was not captured.' : ''
      ].filter(Boolean));
    });

  const doExport = () =>
    run('Preparing export', async () => {
      const outcome = await exportWithPreset(current!.image, preset, {
        sourceWidth: original?.loaded.width,
        sourceHeight: original?.loaded.height
      });
      if (hasAi) {
        outcome.report.unshift({
          id: 'ai',
          label: 'Content origin',
          value: 'Contains AI-generated or AI-processed pixels',
          status: 'warn',
          message: 'Do not present AI-generated views as exact photographs of the item.'
        });
      }
      setExported(outcome);
    });

  const downloadFinal = () =>
    run('Encoding', async () => {
      if (exported) {
        const name = renderFileName('{sku}_{preset}', { sku: sku || 'image', name: original?.loaded.name ?? '', index: 1, preset: preset.id, ext: FORMAT_EXT[exported.encode.format] });
        downloadBlob(exported.encode.blob, hasAi ? name.replace(/(\.\w+)$/, '_AI$1') : name);
        return;
      }
      const enc = await encodeImage(current!.image, { format: 'png' });
      downloadBlob(enc.blob, `${sku || 'image'}_edited${hasAi ? '_AI' : ''}.png`);
    });

  const doAiRelight = () =>
    run('AI relighting', async () => {
      const image = await referenceForAI(current!.image);
      const res = await generate(
        ai.settings,
        { provider: choice.provider as 'gemini' | 'replicate', task: 'relight', prompt: buildRelightPrompt(), image, consent: { invisibleWatermark: choice.consent } },
        (m) => setBusy(m)
      );
      const { loaded } = await loadOutput(ai.settings, res.images[0].src, 'relit.png');
      push(loaded.image, `AI relight (${res.provider} ${res.model}) — generative, check product details`, 'ai');
    });

  const doAiBgRemoval = () =>
    run('AI background removal', async () => {
      const enc = await encodeImage(current!.image, { format: 'png' });
      const res = await removeBackground(ai.settings, await blobToDataUrl(enc.blob), (m) => setBusy(m));
      const { loaded } = await loadOutput(ai.settings, res.images[0].src, 'cutout.png');
      push(loaded.image, `AI background removal (${res.model}) — transparent cutout`, 'ai');
    });

  const doAiView = (view: ProductView) =>
    run(`Generating ${view} view`, async () => {
      const image = await referenceForAI(current!.image);
      const res = await generate(
        ai.settings,
        { provider: choice.provider as 'gemini' | 'replicate', task: 'product-view', prompt: buildProductViewPrompt(view), image, aspectRatio: '1:1', consent: { invisibleWatermark: choice.consent } },
        (m) => setBusy(m)
      );
      const { blob, loaded } = await loadOutput(ai.settings, res.images[0].src, `${view}.png`);
      setAiViews((v) => [...v, { id: crypto.randomUUID(), view, image: loaded.image, blob, provider: res.provider, model: res.model }]);
    });

  const addRefs = (files: File[]) =>
    run('Loading reference photos', async () => {
      const list: RefView[] = [];
      for (const file of files) {
        const loaded = await loadImageFile(file);
        const view = /side/i.test(file.name) ? 'side' : /45|three|quarter/i.test(file.name) ? 'three-quarter' : /front/i.test(file.name) ? 'front' : 'other';
        list.push({ id: crypto.randomUUID(), view, loaded, file });
      }
      setRefs((r) => [...r, ...list]);
    });

  const lastNotes = useMemo(() => notes.filter(Boolean), [notes]);

  if (!current || !original) {
    return (
      <div className="space-y-6">
        <Panel title={<span className="flex items-center gap-2"><Glasses className="w-4 h-4 text-[#00ff7f]" /> Eyewear Product Studio</span>}>
          <p className="text-sm text-[#ececec]/70 max-w-2xl">
            Upload a sunglasses photo. Local tools (enhance, white background, resize, export, validation) run free in your browser and only
            tone-map or clean pixels — they never redraw the frame, lenses or logo. AI tools are optional and clearly labelled.
          </p>
          <FilePicker onFiles={onUpload} label="Drop a sunglasses photo (JPG, PNG, WebP) or click to upload" />
          {busy && <p className="font-mono text-xs text-[#00ff7f]">{busy}…</p>}
          {error && <Notice tone="error">{error}</Notice>}
        </Panel>
      </div>
    );
  }

  const ratio = aspectRatioLabel(current.image.width, current.image.height);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: preview + actions */}
      <div className="xl:col-span-7 space-y-4">
        <Panel
          title="Workspace"
          right={
            <div className="flex gap-2">
              <Btn onClick={() => history.length > 1 && setHistory((h) => h.slice(0, -1))} disabled={history.length < 2 || !!busy} icon={<Undo2 className="w-3.5 h-3.5" />}>
                Undo
              </Btn>
              <Btn onClick={() => setHistory((h) => h.slice(0, 1))} disabled={history.length < 2 || !!busy} icon={<RotateCcw className="w-3.5 h-3.5" />}>
                Revert
              </Btn>
            </div>
          }
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="block">
              <span className="block font-mono text-[9px] uppercase tracking-wider text-[#ececec]/40">SKU</span>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="bg-transparent border-b border-[#ececec]/20 font-mono text-xs w-40 outline-none focus:border-[#00ff7f]" />
            </label>
            <Stat label="Original" value={`${original.loaded.width}×${original.loaded.height} · ${original.loaded.format ? FORMAT_LABEL[original.loaded.format] : '?'} · ${formatBytes(original.file.size)}`} />
            <Stat label="Current" value={`${current.image.width}×${current.image.height} · ${ratio}`} accent />
          </div>
          {history.length > 1 ? (
            <CompareView before={beforeUrl} after={afterUrl} afterLabel={hasAi ? 'Edited (contains AI)' : 'Edited'} />
          ) : (
            <div style={checkerStyle} className="border border-[#ececec]/15">
              {beforeUrl && <img src={beforeUrl} alt="Original" className="block w-full max-h-[70vh] object-contain" />}
            </div>
          )}
          {busy && <p className="font-mono text-xs text-[#00ff7f] animate-pulse">{busy}…</p>}
          {error && <Notice tone="error">{error}</Notice>}
          {lastNotes.map((n) => (
            <Notice key={n} tone="warn">
              {n}
            </Notice>
          ))}
          {hasAi && (
            <Notice tone="ai">
              This image contains AI-generated or AI-processed pixels. Small product details (logo text, hinge shape, lens tint) can change —
              compare carefully against the original before listing.
            </Notice>
          )}
          <ol className="font-mono text-[11px] text-[#ececec]/55 space-y-0.5">
            {history.map((h, i) => (
              <li key={i} className={h.kind === 'ai' ? 'text-violet-300' : ''}>
                {i + 1}. {h.label} — {h.image.width}×{h.image.height}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Primary actions">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Btn variant="ai" onClick={() => goTo('photoshoot')} icon={<UserRound className="w-3.5 h-3.5" />}>Generate AI model image</Btn>
            <Btn variant="primary" onClick={doEnhance} busy={busy === 'Enhancing'} disabled={!!busy} icon={<Sparkles className="w-3.5 h-3.5" />}>Enhance product photo</Btn>
            <Btn variant="primary" onClick={doWhiteBg} busy={busy === 'Cleaning background'} disabled={!!busy} icon={<Eraser className="w-3.5 h-3.5" />}>Create white background</Btn>
            <Btn onClick={() => doUpscale('2k')} disabled={!!busy} icon={<Maximize className="w-3.5 h-3.5" />}>Upscale to 2K</Btn>
            <Btn onClick={() => doUpscale('4k')} disabled={!!busy} icon={<Maximize className="w-3.5 h-3.5" />}>Upscale to 4K</Btn>
            <Btn onClick={() => goTo('convert')} icon={<FileType className="w-3.5 h-3.5" />}>Convert image format</Btn>
            <Btn onClick={doExport} disabled={!!busy} icon={<Wand2 className="w-3.5 h-3.5" />}>Resize for marketplace</Btn>
            <Btn onClick={doExport} disabled={!!busy} icon={<ShieldCheck className="w-3.5 h-3.5" />}>Validate image</Btn>
            <Btn variant="primary" onClick={downloadFinal} disabled={!!busy} icon={<Download className="w-3.5 h-3.5" />}>Download final image</Btn>
          </div>
          <p className="text-[11px] text-[#ececec]/45">
            Upscale buttons use the ratio and method chosen under “Resolution”. Downloads never include an app watermark, logo or text.
          </p>
        </Panel>

        <Panel title="Reference views (real photos)" right={<span className="font-mono text-[10px] text-[#ececec]/40">front / side / 45°</span>}>
          <p className="text-xs text-[#ececec]/60">
            Best accuracy: upload real photos of each angle and process them here. They stay exact photographs of the product.
          </p>
          <FilePicker onFiles={addRefs} multiple compact label="Add front / side / 45° photos" />
          {refs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {refs.map((r) => (
                <RefCard
                  key={r.id}
                  r={r}
                  onView={(view) => setRefs((list) => list.map((x) => (x.id === r.id ? { ...x, view } : x)))}
                  onUse={() => {
                    startFrom(r.loaded.image, r.file, r.loaded, `Original upload (${r.view} view)`);
                  }}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Right: settings panels */}
      <div className="xl:col-span-5 space-y-4">
        <Panel title="1 · Enhance (local, product-safe)">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#00ff7f]" checked={!!enhanceOpts.levels} onChange={(e) => setEnhanceOpts({ ...enhanceOpts, levels: e.target.checked })} />Auto levels</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#00ff7f]" checked={!!enhanceOpts.neutralize} onChange={(e) => setEnhanceOpts({ ...enhanceOpts, neutralize: e.target.checked })} />Neutralise colour cast</label>
          </div>
          <Slider label="Noise reduction" value={enhanceOpts.denoise ?? 0} min={0} max={30} onChange={(v) => setEnhanceOpts({ ...enhanceOpts, denoise: v })} />
          <Slider label="Clarity" value={enhanceOpts.clarity ?? 0} min={0} max={1} step={0.05} onChange={(v) => setEnhanceOpts({ ...enhanceOpts, clarity: v })} />
          <Slider label="Sharpen" value={enhanceOpts.sharpen ?? 0} min={0} max={2} step={0.05} onChange={(v) => setEnhanceOpts({ ...enhanceOpts, sharpen: v })} />
          <div className="grid grid-cols-3 gap-2">
            {(['brightness', 'contrast', 'saturation'] as const).map((k) => (
              <Slider key={k} label={k} value={enhanceOpts.tone?.[k] ?? 0} min={-50} max={50} onChange={(v) => setEnhanceOpts({ ...enhanceOpts, tone: { ...enhanceOpts.tone, [k]: v } })} />
            ))}
          </div>
          <Btn variant="primary" className="w-full" onClick={doEnhance} disabled={!!busy}>Apply enhancement</Btn>
        </Panel>

        <Panel title="2 · Background, dust & shadow (local)">
          <Slider label="Background tolerance" value={wbOpts.tolerance ?? 38} min={5} max={110} onChange={(v) => setWbOpts({ ...wbOpts, tolerance: v })} />
          <Slider label="Edge feather (px)" value={wbOpts.feather ?? 1} min={0} max={4} onChange={(v) => setWbOpts({ ...wbOpts, feather: v })} />
          <Slider label="Dust / speck removal" value={(wbOpts.speckMaxFraction ?? 0) * 10000} min={0} max={30} format={(v) => (v ? `${(v / 100).toFixed(2)}% max` : 'off')} onChange={(v) => setWbOpts({ ...wbOpts, speckMaxFraction: v / 10000 })} />
          <Slider label="Studio contact shadow" value={wbOpts.shadow ?? 0} min={0} max={1} step={0.05} onChange={(v) => setWbOpts({ ...wbOpts, shadow: v })} />
          <Select label="Output" value={wbOpts.output ?? 'white'} onChange={(v) => setWbOpts({ ...wbOpts, output: v })} options={[{ value: 'white', label: 'Pure white #FFFFFF' }, { value: 'transparent', label: 'Transparent (PNG / WebP)' }]} />
          <Btn variant="primary" className="w-full" onClick={doWhiteBg} disabled={!!busy}>Create white background</Btn>
          <p className="text-[11px] text-[#ececec]/45">Works on plain studio backdrops. Clear lenses enclosed by the frame are kept. For busy backgrounds use AI background removal below.</p>
        </Panel>

        <Panel title="3 · Resolution & upscaling">
          <ResolutionPicker value={resolution} onChange={setResolution} />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Fit" value={fit} onChange={setFit} options={[{ value: 'contain', label: 'Fit whole image (pad)' }, { value: 'product', label: 'Center product (pad)' }, { value: 'cover', label: 'Fill (crop background only)' }]} />
            <Select label="Upscale method" value={upscaleMethod} onChange={setUpscaleMethod} options={[{ value: 'lanczos', label: 'Lanczos-3 (free, local, not AI)' }, { value: 'ai', label: 'AI super-resolution (Real-ESRGAN)' }]} />
          </div>
          <p className="text-[11px] text-[#ececec]/50">
            Current {current.image.width}×{current.image.height} → target {resolveSize(resolution).width}×{resolveSize(resolution).height}.
            {upscaleMethod === 'lanczos' ? ' Lanczos interpolates; it cannot add real detail.' : ' AI upscaling synthesises plausible detail; it is not a recovery of the original photo.'}
          </p>
          <Btn className="w-full" onClick={() => doUpscale()} disabled={!!busy}>Resize / upscale to target</Btn>
        </Panel>

        <Panel title="4 · Marketplace export & validation">
          <Select label="Preset" value={presetId} onChange={setPresetId} options={presets.map((p) => ({ value: p.id, label: `${p.name} — ${p.width}×${p.height} ${FORMAT_LABEL[p.format]}${p.needsVerification ? ' ⚠' : ''}` }))} />
          {preset && (
            <p className="font-mono text-[11px] text-[#ececec]/50">
              {preset.width}×{preset.height} ({presetRatioLabel(preset)}) · {FORMAT_LABEL[preset.format]} q{preset.quality} · bg {preset.background} · max{' '}
              {preset.maxFileSizeKB ? formatBytes(preset.maxFileSizeKB * 1024) : '—'} · {preset.fit} fit, {preset.paddingPct}% padding
              {preset.needsVerification && <span className="text-amber-400"> · needs verification</span>}{' '}
              <button className="underline" onClick={() => goTo('presets')}>edit</button>
            </p>
          )}
          <Btn variant="primary" className="w-full" onClick={doExport} disabled={!!busy}>Resize & validate for {preset?.marketplace}</Btn>
          {exported && (
            <>
              <ValidationReport items={exported.report} />
              <Btn variant="primary" className="w-full" onClick={downloadFinal} icon={<Download className="w-3.5 h-3.5" />}>
                Download {exported.encode.width}×{exported.encode.height} {FORMAT_LABEL[exported.encode.format]} ({formatBytes(exported.encode.blob.size)})
              </Btn>
            </>
          )}
        </Panel>

        <Panel title={<span className="text-violet-200">5 · AI tools (optional, external provider)</span>}>
          <AiProviderPicker task="relight" providers={ai.providers} error={ai.error} value={choice} onChange={setChoice} goTo={goTo} />
          <Notice tone="ai">
            Generative edits can alter small product details. Prefer the local tools above when exact product accuracy matters. AI angle views
            are renderings, not photographs of the item, and are labelled as such.
          </Notice>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="ai" onClick={doAiRelight} disabled={!!busy || !providerReady(choice, ai.providers)}>AI studio relight</Btn>
            <Btn variant="ai" onClick={doAiBgRemoval} disabled={!!busy || !ai.providers.some((p) => p.id === 'replicate' && p.configured)}>AI background removal</Btn>
            <Btn variant="ai" onClick={() => doAiView('front')} disabled={!!busy || !providerReady(choice, ai.providers)}>AI front view</Btn>
            <Btn variant="ai" onClick={() => doAiView('side')} disabled={!!busy || !providerReady(choice, ai.providers)}>AI side view</Btn>
            <Btn variant="ai" onClick={() => doAiView('three-quarter')} disabled={!!busy || !providerReady(choice, ai.providers)}>AI 45° view</Btn>
          </div>
          {aiViews.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {aiViews.map((v) => (
                <AiViewCard
                  key={v.id}
                  v={v}
                  onUse={() =>
                    startFrom(v.image, v.blob, { image: v.image, width: v.image.width, height: v.image.height, format: null, size: v.blob.size, name: `${v.view}.png` }, `AI-generated ${v.view} view (${v.model})`, 'ai')
                  }
                  onDownload={() => downloadBlob(v.blob, `${sku || 'image'}_${v.view}_AI-generated-view.${v.blob.type.includes('jpeg') ? 'jpg' : 'png'}`)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

const RefCard: React.FC<{ r: RefView; onView: (v: RefView['view']) => void; onUse: () => void }> = ({ r, onView, onUse }) => {
  const url = useBlobUrl(r.file);
  return (
    <div className="border border-[#ececec]/15 p-1.5 space-y-1">
      {url && <img src={url} alt={r.view} className="w-full aspect-square object-contain bg-white" />}
      <select value={r.view} onChange={(e) => onView(e.target.value as RefView['view'])} className="w-full bg-[#0c0c0e] text-[10px] font-mono border border-[#ececec]/15">
        <option value="front">Front</option>
        <option value="side">Side</option>
        <option value="three-quarter">45°</option>
        <option value="other">Other</option>
      </select>
      <button onClick={onUse} className="w-full font-mono text-[10px] text-[#00ff7f] border border-[#00ff7f]/30 py-0.5">Edit this photo</button>
    </div>
  );
};

const AiViewCard: React.FC<{ v: AiView; onUse: () => void; onDownload: () => void }> = ({ v, onUse, onDownload }) => {
  const url = useBlobUrl(v.blob);
  return (
    <div className="border border-violet-400/30 p-1.5 space-y-1">
      <div className="relative">
        {url && <img src={url} alt={`AI ${v.view} view`} className="w-full aspect-square object-contain bg-white" />}
        <span className="absolute top-1 left-1 bg-violet-600 text-white text-[9px] font-mono px-1">AI-GENERATED VIEW</span>
      </div>
      <p className="font-mono text-[10px] text-[#ececec]/50">
        {v.view} · {v.image.width}×{v.image.height} · {v.provider}
      </p>
      <div className="grid grid-cols-2 gap-1">
        <button onClick={onUse} className="font-mono text-[10px] border border-[#ececec]/20 py-0.5">Edit</button>
        <button onClick={onDownload} className="font-mono text-[10px] border border-[#ececec]/20 py-0.5">Download</button>
      </div>
    </div>
  );
};

export type { WorkImage };
