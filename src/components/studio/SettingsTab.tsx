import React, { useState } from 'react';
import { RefreshCw, Server } from 'lucide-react';
import type { TabProps } from './types';
import { useAi } from './useAi';
import { Btn, Label, Notice, Panel, inputCls } from './ui';

export const SettingsTab: React.FC<TabProps> = () => {
  const ai = useAi();
  const [url, setUrl] = useState(ai.settings.backendUrl);
  const [token, setToken] = useState(ai.settings.accessToken);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <Panel title={<span className="flex items-center gap-2"><Server className="w-4 h-4 text-[#00ff7f]" /> AI backend</span>}>
        <p className="text-xs text-[#ececec]/60">
          AI generation, AI upscaling and AI background removal run through your own small server (the <code>server/</code> folder in this
          repo). API keys live only on that server. GitHub Pages hosts this frontend and cannot keep secrets.
        </p>
        <label className="block">
          <Label hint="empty = same origin">Gateway URL</Label>
          <input className={inputCls} placeholder="https://your-gateway.onrender.com" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
        </label>
        <label className="block">
          <Label hint="only if the server sets ACCESS_TOKEN">App passcode</Label>
          <input className={inputCls} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        </label>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={() => ai.setSettings({ backendUrl: url, accessToken: token })}>Save & test</Btn>
          <Btn onClick={() => ai.refresh()} busy={ai.loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>Re-check</Btn>
        </div>
        {ai.error ? (
          <Notice tone="warn">{ai.error}</Notice>
        ) : (
          ai.providers.length > 0 && <Notice tone="info">Connected. {ai.providers.filter((p) => p.configured).length} provider(s) configured on the server.</Notice>
        )}
        <p className="text-[11px] text-[#ececec]/45">
          The passcode is stored in this browser only. It is not a provider API key — never paste Gemini or Replicate keys here.
        </p>
      </Panel>

      <Panel title="Providers & disclosures">
        {ai.providers.length === 0 && <p className="text-xs text-[#ececec]/50">Connect a backend to see its providers.</p>}
        {ai.providers.map((p) => (
          <div key={p.id} className="border border-[#ececec]/15 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold">{p.name}</span>
              <span className={`font-mono text-[10px] ${p.configured ? 'text-[#00ff7f]' : 'text-[#ececec]/40'}`}>{p.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}</span>
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
          <li><b>External AI (optional, paid per use):</b> AI model photoshoots, AI relighting, AI angle views (Gemini or FLUX Kontext), AI super-resolution (Real-ESRGAN), AI background removal. Images are sent to the chosen provider.</li>
          <li><b>Watermarks:</b> this app never adds a watermark, logo, text, border or badge. Gemini outputs carry Google's invisible SynthID watermark; the app asks for consent and does not try to remove it.</li>
          <li><b>Hardware:</b> local processing uses your CPU/RAM. 4K exports need ~150–250 MB RAM per image; iPhone/iPad Safari cannot create canvases above ~16.7 MP (e.g. 4096×5120). Self-hosting Real-ESRGAN instead of Replicate needs an NVIDIA GPU with ≥ 4 GB VRAM.</li>
        </ul>
      </Panel>
    </div>
  );
};
