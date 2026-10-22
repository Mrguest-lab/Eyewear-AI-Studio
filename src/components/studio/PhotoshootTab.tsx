import React, { useState } from 'react';
import { Download, Maximize, Send, UserRound } from 'lucide-react';
import type { TabProps } from './types';
import type { RGBAImage } from '../../lib/resample';
import { downloadBlob, encodeImage, loadImageFile, referenceForAI } from '../../lib/browser/imageIO';
import type { LoadedImage } from '../../lib/browser/imageIO';
import { generate, loadOutput } from '../../lib/browser/aiClient';
import { renderTo } from '../../lib/browser/pipeline';
import { DEFAULT_PHOTOSHOOT, PRESERVATION_LEVELS, SHOT_TYPES, buildPhotoshootPrompt } from '../../lib/prompts';
import type { PhotoshootOptions } from '../../lib/prompts';
import { aspectRatioLabel, formatBytes, sniffFormat, FORMAT_LABEL } from '../../lib/format';
import { getTargetSize } from '../../lib/dimensions';
import type { RatioId } from '../../lib/dimensions';
import { skuFromFileName } from '../../lib/naming';
import { Btn, FilePicker, Notice, Panel, Select, errorMessage, inputCls, Label, useBlobUrl, useRasterUrl } from './ui';
import { useAi } from './useAi';
import { AiProviderPicker, providerReady } from './AiProviderPicker';
import type { ProviderChoice } from './AiProviderPicker';

interface ShootResult {
  id: string;
  shot: string;
  provider: string;
  model: string;
  /** Untouched provider file */
  blob: Blob;
  image: RGBAImage;
  nativeFormat: string;
  upscaled?: { image: RGBAImage; label: string };
}

const RATIO_OPTIONS: { value: RatioId; label: string }[] = [
  { value: '4:5', label: '4:5 portrait' },
  { value: '3:4', label: '3:4 portrait' },
  { value: '1:1', label: '1:1 square' },
  { value: '9:16', label: '9:16 vertical' },
  { value: '16:9', label: '16:9 landscape' }
];

export const PhotoshootTab: React.FC<TabProps> = ({ work, setWork, goTo }) => {
  const [product, setProduct] = useState<{ image: RGBAImage; name: string; sku: string; blob?: Blob } | null>(null);
  const [opts, setOpts] = useState<PhotoshootOptions>(DEFAULT_PHOTOSHOOT);
  const [ratio, setRatio] = useState<RatioId>('4:5');
  const [variations, setVariations] = useState(1);
  const [nativeSize, setNativeSize] = useState<'1K' | '2K' | '4K'>('2K');
  const [choice, setChoice] = useState<ProviderChoice>({ provider: '', consent: false });
  const [results, setResults] = useState<ShootResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ai = useAi();

  const source = product ?? (work ? { image: work.image, name: work.name, sku: work.sku, blob: work.sourceBlob } : null);
  const sourceUrl = useRasterUrl(source?.image ?? null);
  const prompt = buildPhotoshootPrompt(opts);
  const selected = ai.providers.find((p) => p.id === choice.provider);
  const supportsNative = !!selected && /Native 1K/.test(selected.maxOutput);

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
    run('Loading', async () => {
      const l: LoadedImage = await loadImageFile(files[0]);
      setProduct({ image: l.image, name: files[0].name, sku: skuFromFileName(files[0].name), blob: files[0] });
    });

  const doGenerate = () =>
    run('Generating', async () => {
      if (!source) return;
      const image = await referenceForAI(source.image);
      for (let i = 0; i < variations; i++) {
        setBusy(`Generating ${i + 1}/${variations}`);
        const res = await generate(
          ai.settings,
          {
            provider: choice.provider as 'gemini' | 'replicate',
            task: 'photoshoot',
            prompt,
            image,
            aspectRatio: ratio,
            imageSize: supportsNative ? nativeSize : undefined,
            outputFormat: 'png',
            consent: { invisibleWatermark: choice.consent }
          },
          (m) => setBusy(m)
        );
        for (const out of res.images) {
          const { blob, loaded } = await loadOutput(ai.settings, out.src, 'model.png');
          const fmt = sniffFormat(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
          setResults((r) => [
            {
              id: crypto.randomUUID(),
              shot: SHOT_TYPES.find((s) => s.id === opts.shot)?.label ?? opts.shot,
              provider: res.provider,
              model: res.model,
              blob,
              image: loaded.image,
              nativeFormat: fmt ? FORMAT_LABEL[fmt] : blob.type
            },
            ...r
          ]);
        }
      }
    });

  const upscaleResult = (r: ShootResult, tier: '2k' | '4k') =>
    run(`Upscaling to ${tier.toUpperCase()}`, async () => {
      const { width, height } = getTargetSize(tier, ratio);
      const { image, placement } = await renderTo(r.image, { width, height, strategy: 'cover', background: '#FFFFFF' });
      const label =
        placement.scale > 1.005
          ? `${width}×${height} — classical upscale ×${placement.scale.toFixed(2)} (Lanczos-3) from native ${r.image.width}×${r.image.height}. For AI super-resolution send it to the Studio.`
          : `${width}×${height} — resampled from native ${r.image.width}×${r.image.height}`;
      setResults((list) => list.map((x) => (x.id === r.id ? { ...x, upscaled: { image, label } } : x)));
    });

  const set = <K extends keyof PhotoshootOptions>(k: K, v: PhotoshootOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-5 space-y-4">
        <Panel title={<span className="flex items-center gap-2"><UserRound className="w-4 h-4 text-violet-300" /> AI model photoshoot</span>}>
          {source ? (
            <div className="flex gap-3 items-center">
              {sourceUrl && <img src={sourceUrl} alt="product" className="w-24 h-24 object-contain bg-white border border-[#ececec]/15" />}
              <div className="text-xs space-y-1">
                <p className="font-mono">{source.sku || source.name}</p>
                <p className="text-[#ececec]/50">{source.image.width}×{source.image.height} reference</p>
                <button className="underline text-[11px] text-[#ececec]/60" onClick={() => setProduct(null)}>
                  {product ? 'Use studio image' : ''}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#ececec]/60">Upload a clear product photo of the sunglasses (front view on a plain background works best).</p>
          )}
          <FilePicker onFiles={onUpload} compact label="Upload a sunglasses reference photo" />
          <Notice tone="ai">
            Reference-image conditioning: your product photo is sent with the prompt and the model is instructed to keep the frame, lenses,
            temples and logo identical. Generative models can still alter small details (logo lettering, hinge shape, lens tint) — always
            compare each result with the real product before listing.
          </Notice>
        </Panel>

        <Panel title="Shoot settings">
          <div className="grid grid-cols-2 gap-2">
            <Select label="Model" value={opts.gender} onChange={(v) => set('gender', v)} options={[{ value: 'female', label: 'Adult female' }, { value: 'male', label: 'Adult male' }]} />
            <label className="block"><Label>Age range</Label><input className={inputCls} value={opts.ageRange} onChange={(e) => set('ageRange', e.target.value)} /></label>
            <label className="block col-span-2"><Label>Appearance</Label><input className={inputCls} value={opts.appearance} onChange={(e) => set('appearance', e.target.value)} placeholder="e.g. Indian, South Asian, European" /></label>
          </div>
          <Select label="Shot type" value={opts.shot} onChange={(v) => set('shot', v)} options={SHOT_TYPES.map((s) => ({ value: s.id, label: s.label }))} />
          {([
            ['pose', 'Pose', ['relaxed, confident posture, chin slightly raised', 'walking towards camera', 'hand lightly touching the temple arm', 'looking over the shoulder']],
            ['outfit', 'Outfit', ['minimal neutral-toned smart casual outfit', 'white linen shirt', 'black leather jacket', 'summer resort wear']],
            ['lighting', 'Lighting', ['soft diffused key light with gentle fill', 'golden hour sunlight', 'bright midday sun with crisp shadows', 'dramatic high-contrast studio light']],
            ['background', 'Background', ['plain light-grey seamless studio background', 'pure white seamless background', 'beach promenade, softly blurred', 'modern city street, softly blurred']]
          ] as const).map(([key, label, suggestions]) => (
            <label key={key} className="block">
              <Label>{label}</Label>
              <input list={`sugg-${key}`} className={inputCls} value={opts[key]} onChange={(e) => set(key, e.target.value)} />
              <datalist id={`sugg-${key}`}>
                {suggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </label>
          ))}
          <Select label="Product preservation" value={opts.preservation} onChange={(v) => set('preservation', v)} options={PRESERVATION_LEVELS.map((p) => ({ value: p.id, label: p.label }))} />
          <p className="text-[11px] text-[#ececec]/45">{PRESERVATION_LEVELS.find((p) => p.id === opts.preservation)?.help}</p>
          <div className="grid grid-cols-2 gap-2">
            <Select label="Aspect ratio" value={ratio} onChange={setRatio} options={RATIO_OPTIONS} />
            <Select label="Variations" value={String(variations) as '1'} onChange={(v) => setVariations(Number(v))} options={['1', '2', '3', '4'].map((v) => ({ value: v as '1', label: v }))} />
          </div>
          {supportsNative && (
            <Select label="Native output size" value={nativeSize} onChange={setNativeSize} options={[{ value: '1K', label: '1K' }, { value: '2K', label: '2K (native)' }, { value: '4K', label: '4K (native)' }]} />
          )}
          <label className="block">
            <Label>Extra direction (optional)</Label>
            <textarea className={inputCls} rows={2} value={opts.extra ?? ''} onChange={(e) => set('extra', e.target.value)} />
          </label>
          <details className="text-[11px] text-[#ececec]/50">
            <summary className="cursor-pointer font-mono">Prompt sent to the provider</summary>
            <p className="mt-1 whitespace-pre-wrap">{prompt}</p>
          </details>
        </Panel>

        <Panel title="Provider">
          <AiProviderPicker task="photoshoot" providers={ai.providers} error={ai.error} value={choice} onChange={setChoice} goTo={goTo} />
          <Btn
            variant="ai"
            className="w-full"
            onClick={doGenerate}
            busy={!!busy && busy.startsWith('Generat')}
            disabled={!source || !!busy || !providerReady(choice, ai.providers)}
            icon={<UserRound className="w-3.5 h-3.5" />}
          >
            Generate AI model image
          </Btn>
          {busy && <p className="font-mono text-xs text-violet-300 animate-pulse">{busy}…</p>}
          {error && <Notice tone="error">{error}</Notice>}
        </Panel>
      </div>

      <div className="xl:col-span-7 space-y-4">
        {results.length === 0 ? (
          <Panel title="Results">
            <p className="text-xs text-[#ececec]/50">Generated images appear here with their native resolution, provider and model.</p>
          </Panel>
        ) : (
          results.map((r) => (
            <ResultCard
              key={r.id}
              r={r}
              busy={!!busy}
              onUpscale={(t) => upscaleResult(r, t)}
              onSend={() => {
                setWork({ image: r.upscaled?.image ?? r.image, name: `${source?.sku || 'model'}_model.png`, sku: source?.sku || 'model', origin: 'ai', note: `${r.provider} ${r.model}`, sourceBlob: r.blob });
                goTo('studio');
              }}
              onDownloadOriginal={() => downloadBlob(r.blob, `${source?.sku || 'model'}_${r.shot.replace(/\W+/g, '-')}_AI-model.${r.blob.type.includes('jpeg') ? 'jpg' : 'png'}`)}
              onDownloadUpscaled={() =>
                run('Encoding', async () => {
                  if (!r.upscaled) return;
                  const enc = await encodeImage(r.upscaled.image, { format: 'jpeg', quality: 92 });
                  downloadBlob(enc.blob, `${source?.sku || 'model'}_AI-model_${r.upscaled.image.width}x${r.upscaled.image.height}.jpg`);
                })
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

const ResultCard: React.FC<{
  r: ShootResult;
  busy: boolean;
  onUpscale: (t: '2k' | '4k') => void;
  onSend: () => void;
  onDownloadOriginal: () => void;
  onDownloadUpscaled: () => void;
}> = ({ r, busy, onUpscale, onSend, onDownloadOriginal, onDownloadUpscaled }) => {
  const url = useBlobUrl(r.blob);
  const upUrl = useRasterUrl(r.upscaled?.image ?? null);
  return (
    <Panel
      title={<span className="text-violet-200">{r.shot}</span>}
      right={<span className="bg-violet-600 text-white text-[9px] font-mono px-1.5 py-0.5">AI-GENERATED</span>}
    >
      <img src={upUrl ?? url ?? ''} alt={r.shot} className="w-full max-h-[70vh] object-contain bg-[#0c0c0e]" />
      <div className="font-mono text-[11px] text-[#ececec]/60 space-y-0.5">
        <p>
          Native output: {r.image.width}×{r.image.height} ({aspectRatioLabel(r.image.width, r.image.height)}) · {r.nativeFormat} · {formatBytes(r.blob.size)} · {r.provider} / {r.model}
        </p>
        {r.upscaled && <p className="text-[#00ff7f]">{r.upscaled.label}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={onDownloadOriginal} icon={<Download className="w-3.5 h-3.5" />}>Download provider original</Btn>
        <Btn onClick={() => onUpscale('2k')} disabled={busy} icon={<Maximize className="w-3.5 h-3.5" />}>Upscale to 2K</Btn>
        <Btn onClick={() => onUpscale('4k')} disabled={busy} icon={<Maximize className="w-3.5 h-3.5" />}>Upscale to 4K</Btn>
        {r.upscaled && (
          <Btn variant="primary" onClick={onDownloadUpscaled} icon={<Download className="w-3.5 h-3.5" />}>
            Download {r.upscaled.image.width}×{r.upscaled.image.height} JPG
          </Btn>
        )}
        <Btn onClick={onSend} icon={<Send className="w-3.5 h-3.5" />}>Edit / validate in Studio</Btn>
      </div>
      <p className="text-[10px] text-[#ececec]/40">
        “Provider original” is the unmodified file from the provider (any provider metadata/provenance kept). Edited or resized exports are
        re-encoded by the browser and do not carry file metadata.
      </p>
    </Panel>
  );
};
