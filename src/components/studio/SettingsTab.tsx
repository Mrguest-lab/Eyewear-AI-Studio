import React, { useState } from 'react';
import { KeyRound, RefreshCw, Server } from 'lucide-react';
import type { TabProps } from './types';
import { useAi } from './useAi';
import { Btn, Label, Notice, Panel, inputCls } from './ui';

export const SettingsTab: React.FC<TabProps> = () => {
  const ai = useAi();
  const [mode, setMode] = useState(ai.settings.mode);
  const [url, setUrl] = useState(ai.settings.backendUrl);
  const [token, setToken] = useState(ai.settings.accessToken);
  const [geminiKey, setGeminiKey] = useState(ai.settings.geminiKey);
  const [geminiModel, setGeminiModel] = useState(ai.settings.geminiModel);

  const save = () => ai.setSettings({ mode, backendUrl: url, accessToken: token, geminiKey: geminiKey.trim(), geminiModel: geminiModel.trim() || 'gemini-2.5-flash-image' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <Panel title="How AI features connect">
        <div className="grid grid-cols-2 gap-1">
          {([
            ['direct', 'Direct (no server)', <KeyRound key="k" className="w-3.5 h-3.5" />],
            ['server', 'AI gateway server', <Server key="s" className="w-3.5 h-3.5" />]
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex items-center justify-center gap-1.5 py-2 font-mono text-[11px] font-bold border ${
                mode === id ? 'bg-[#00ff7f] text-black border-[#00ff7f]' : 'border-[#ececec]/20 text-[#ececec]/70'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {mode === 'direct' ? (
          <>
            <p className="text-xs text-[#ececec]/60">
              Works on GitHub Pages with nothing else to host. Your Gemini key is saved only in this browser and sent only to Google
              (generativelanguage.googleapis.com). Get a key at{' '}
              <a className="underline text-[#00ff7f]" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.
            </p>
            <label className="block">
              <Label>Gemini API key</Label>
              <input className={inputCls} type="password" autoComplete="off" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza…" />
            </label>
            <label className="block">
              <Label hint="gemini-3-pro-image-preview gives native 2K/4K">Gemini image model</Label>
              <input className={inputCls} value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} />
            </label>
            <Notice tone="warn">
              Use direct mode only on your own computer. Anyone with access to this browser profile could read the key. Restrict the key to
              the Gemini API in Google Cloud and set a budget. For a team, use the gateway server instead.
            </Notice>
          </>
        ) : (
          <>
            <p className="text-xs text-[#ececec]/60">
              Run the <code>server/</code> gateway from this repo (Render, Cloud Run, or your PC). Keys live only on that server. Needed for
              Replicate (FLUX Kontext, Real-ESRGAN).
            </p>
            <label className="block">
              <Label hint="empty = same origin">Gateway URL</Label>
              <input className={inputCls} placeholder="https://your-gateway.onrender.com" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
            </label>
            <label className="block">
              <Label hint="only if the server sets ACCESS_TOKEN">App passcode</Label>
              <input className={inputCls} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            </label>
          </>
        )}
        <div className="flex gap-2">
          <Btn variant="primary" onClick={save}>Save & test</Btn>
          <Btn onClick={() => ai.refresh()} busy={ai.loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>Re-check</Btn>
        </div>
        {ai.error ? (
          <Notice tone="warn">{ai.error}</Notice>
        ) : (
          ai.providers.length > 0 && (
            <Notice tone="info">
              {ai.providers.filter((p) => p.configured).length
                ? `Ready: ${ai.providers.filter((p) => p.configured).map((p) => p.name).join(', ')}.`
                : 'Connected, but no provider key is set yet.'}
            </Notice>
          )
        )}
      </Panel>

      <Panel title="Providers & disclosures">
        {ai.providers.length === 0 && <p className="text-xs text-[#ececec]/50">Save your settings to see available providers.</p>}
        {ai.providers.map((p) => (
          <div key={p.id} className="border border-[#ececec]/15 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold">{p.name}</span>
              <span className={`font-mono text-[10px] ${p.configured ? 'text-[#00ff7f]' : 'text-[#ececec]/40'}`}>{p.configured ? 'READY' : 'NO KEY'}</span>
            </div>
            <p className="font-mono text-[11px] text-[#ececec]/50">{Object.entries(p.models).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
            <p><span className="text-[#ececec]/50">Watermark:</span> {p.watermark.details}</p>
            <p><span className="text-[#ececec]/50">Output:</span> {p.maxOutput}</p>
            <p><span className="text-[#ececec]/50">Cost / limits:</span> {p.cost}</p>
            <a className="underline text-[#00ff7f]" href={p.terms} target="_blank" rel="noreferrer">Provider terms</a>
          </div>
        ))}
      </Panel>

      <Panel title="What runs where" className="lg:col-span-2">
        <ul className="text-xs text-[#ececec]/70 space-y-1.5 list-disc pl-5">
          <li><b>Free, in your browser:</b> JPG/PNG/WebP conversion, resizing, Lanczos upscaling, cropping/padding, compression, enhancement, white-background cleanup, dust removal, shadows, validation, batch and ZIP. Nothing is uploaded.</li>
          <li><b>Free on-device AI:</b> AI upscaling (Swin2SR) and AI background removal (BiRefNet-lite) run on your own GPU/CPU. The model downloads once (21–224 MB) and is cached.</li>
          <li><b>External AI (Gemini or Replicate):</b> AI model photoshoots, AI relighting and AI angle views. Images are sent to the provider. Google bills per generated image unless your account's free quota covers it — check ai.google.dev/pricing.</li>
          <li><b>Watermarks:</b> this app never adds a watermark, logo, text, border or badge. Gemini outputs carry Google's invisible SynthID watermark; the app asks for consent and does not try to remove it.</li>
          <li><b>Hardware:</b> 4K exports need ~150–250 MB RAM per image; iPhone/iPad Safari cannot create canvases above ~16.7 MP (e.g. 4096×5120). On-device AI is fastest in Chrome/Edge with WebGPU.</li>
        </ul>
      </Panel>
    </div>
  );
};
