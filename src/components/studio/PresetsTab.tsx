import React, { useRef, useState } from 'react';
import { Copy, Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { TabProps } from './types';
import { usePresets } from '../../lib/browser/presetStore';
import { downloadBlob } from '../../lib/browser/imageIO';
import type { MarketplacePreset } from '../../lib/marketplacePresets';
import { presetRatioLabel, validatePresetDefinition } from '../../lib/marketplacePresets';
import { EXPORT_FORMATS, FORMAT_LABEL } from '../../lib/format';
import { RATIOS, heightForWidth } from '../../lib/dimensions';
import { Btn, Label, Notice, NumberField, Panel, Select, inputCls } from './ui';

/** Editable marketplace presets. Nothing here is treated as a permanent marketplace fact. */
export const PresetsTab: React.FC<TabProps> = () => {
  const [presets, setPresets, reset] = usePresets();
  const [openId, setOpenId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const patch = (id: string, p: Partial<MarketplacePreset>) => setPresets(presets.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const add = (base?: MarketplacePreset) => {
    const id = `custom-${Date.now().toString(36)}`;
    const next: MarketplacePreset = base
      ? { ...base, id, name: `${base.name} (copy)`, builtIn: false }
      : {
          id, marketplace: 'Custom', name: 'New preset', imageType: 'product', width: 2000, height: 2000, background: '#FFFFFF',
          format: 'jpeg', quality: 90, maxFileSizeKB: 5120, fit: 'product', paddingPct: 6, allowUpscale: true,
          requireWhiteBackground: true, minProductFillPct: 80, minLongSidePx: 1000, needsVerification: true, notes: ''
        };
    setPresets([...presets, next]);
    setOpenId(id);
  };

  const importJson = async (file: File) => {
    try {
      const list = JSON.parse(await file.text());
      if (!Array.isArray(list)) throw new Error('Expected a JSON array of presets');
      const bad = list.flatMap((p: MarketplacePreset) => validatePresetDefinition(p).map((e) => `${p.name || p.id}: ${e}`));
      if (bad.length) throw new Error(bad.slice(0, 5).join(' · '));
      setPresets(list);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <Panel title="Marketplace presets">
        <Notice tone="warn">
          Marketplace image rules change. These presets are editable starting points — anything marked ⚠ needs verification against the
          marketplace's latest seller guidelines before you rely on it. Edits are saved in this browser.
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => add()} icon={<Plus className="w-3.5 h-3.5" />}>New preset</Btn>
          <Btn onClick={() => downloadBlob(new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' }), 'marketplace-presets.json')} icon={<Download className="w-3.5 h-3.5" />}>Export JSON</Btn>
          <Btn onClick={() => fileRef.current?.click()} icon={<Upload className="w-3.5 h-3.5" />}>Import JSON</Btn>
          <Btn variant="danger" onClick={reset} icon={<RotateCcw className="w-3.5 h-3.5" />}>Reset to defaults</Btn>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
        {importError && <Notice tone="error">{importError}</Notice>}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {presets.map((p) => {
          const errors = validatePresetDefinition(p);
          const open = openId === p.id;
          return (
            <section key={p.id} className={`bg-[#151518] border ${errors.length ? 'border-red-400/50' : 'border-[#ececec]/15'}`}>
              <button className="w-full flex justify-between items-start gap-2 p-3 text-left" onClick={() => setOpenId(open ? null : p.id)}>
                <div>
                  <div className="text-sm font-semibold">
                    {p.name} {p.needsVerification && <span className="text-amber-400 text-xs" title="Needs verification">⚠ verify</span>}
                  </div>
                  <div className="font-mono text-[11px] text-[#ececec]/50">
                    {p.marketplace} · {p.width}×{p.height} ({presetRatioLabel(p)}) · {FORMAT_LABEL[p.format]} q{p.quality} · {p.background} ·{' '}
                    {p.maxFileSizeKB ? `≤${p.maxFileSizeKB} KB` : 'no size limit'}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[#ececec]/40">{open ? 'close' : 'edit'}</span>
              </button>
              {open && (
                <div className="border-t border-[#ececec]/10 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block"><Label>Name</Label><input className={inputCls} value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} /></label>
                    <label className="block"><Label>Marketplace</Label><input className={inputCls} value={p.marketplace} onChange={(e) => patch(p.id, { marketplace: e.target.value })} /></label>
                    <NumberField label="Width" suffix="px" value={p.width} onChange={(v) => patch(p.id, { width: Math.round(v) })} />
                    <NumberField label="Height" suffix="px" value={p.height} onChange={(v) => patch(p.id, { height: Math.round(v) })} />
                  </div>
                  <div>
                    <Label>Set aspect ratio from width</Label>
                    <div className="flex flex-wrap gap-1">
                      {RATIOS.map((r) => (
                        <button key={r.id} className="px-2 py-1 border border-[#ececec]/20 font-mono text-[10px]" onClick={() => patch(p.id, { height: heightForWidth(p.width, r.w, r.h) })}>
                          {r.id}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select label="Format" value={p.format} onChange={(v) => patch(p.id, { format: v })} options={EXPORT_FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} />
                    <NumberField label="Quality" suffix="1-100" value={p.quality} min={1} max={100} onChange={(v) => patch(p.id, { quality: v })} />
                    <label className="block">
                      <Label>Background</Label>
                      <div className="flex gap-1">
                        <input type="color" value={p.background === 'transparent' ? '#ffffff' : p.background} onChange={(e) => patch(p.id, { background: e.target.value.toUpperCase() })} className="h-8 w-10 bg-transparent" />
                        <input className={inputCls} value={p.background} onChange={(e) => patch(p.id, { background: e.target.value })} />
                      </div>
                    </label>
                    <label className="block">
                      <Label>Max file size (KB, empty = none)</Label>
                      <input type="number" className={inputCls} value={p.maxFileSizeKB ?? ''} onChange={(e) => patch(p.id, { maxFileSizeKB: e.target.value ? Number(e.target.value) : null })} />
                    </label>
                    <Select label="Crop / fit rule" value={p.fit} onChange={(v) => patch(p.id, { fit: v })} options={[{ value: 'product', label: 'Center product + padding' }, { value: 'contain', label: 'Fit whole image (pad)' }, { value: 'cover', label: 'Fill (crop background only)' }]} />
                    <NumberField label="Padding" suffix="% of short side" value={p.paddingPct} min={0} max={45} onChange={(v) => patch(p.id, { paddingPct: v })} />
                    <label className="block">
                      <Label>Min product coverage % (empty = none)</Label>
                      <input type="number" className={inputCls} value={p.minProductFillPct ?? ''} onChange={(e) => patch(p.id, { minProductFillPct: e.target.value ? Number(e.target.value) : null })} />
                    </label>
                    <label className="block">
                      <Label>Min source long side px</Label>
                      <input type="number" className={inputCls} value={p.minLongSidePx ?? ''} onChange={(e) => patch(p.id, { minLongSidePx: e.target.value ? Number(e.target.value) : null })} />
                    </label>
                    <Select label="Image type" value={p.imageType} onChange={(v) => patch(p.id, { imageType: v })} options={[{ value: 'product', label: 'Product' }, { value: 'model', label: 'Model' }, { value: 'any', label: 'Any' }]} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[#00ff7f]" checked={p.requireWhiteBackground} onChange={(e) => patch(p.id, { requireWhiteBackground: e.target.checked })} />Require white background</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[#00ff7f]" checked={p.allowUpscale} onChange={(e) => patch(p.id, { allowUpscale: e.target.checked })} />Allow upscaling</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[#00ff7f]" checked={p.needsVerification} onChange={(e) => patch(p.id, { needsVerification: e.target.checked })} />Needs verification</label>
                  </div>
                  <label className="block"><Label>Notes</Label><textarea rows={2} className={inputCls} value={p.notes} onChange={(e) => patch(p.id, { notes: e.target.value })} /></label>
                  {errors.map((e) => <p key={e} className="text-[11px] text-red-300">{e}</p>)}
                  <div className="flex gap-2">
                    <Btn onClick={() => add(p)} icon={<Copy className="w-3.5 h-3.5" />}>Duplicate</Btn>
                    <Btn variant="danger" onClick={() => setPresets(presets.filter((x) => x.id !== p.id))} disabled={presets.length < 2} icon={<Trash2 className="w-3.5 h-3.5" />}>Delete</Btn>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
