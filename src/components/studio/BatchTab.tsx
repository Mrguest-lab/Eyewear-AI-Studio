import React, { useState } from 'react';
import { CheckCircle2, FileArchive, Play, Trash2, XCircle } from 'lucide-react';
import JSZip from 'jszip';
import type { TabProps } from './types';
import { downloadBlob, loadImageFile, runPixelOp } from '../../lib/browser/imageIO';
import { exportWithPreset } from '../../lib/browser/pipeline';
import { usePresets } from '../../lib/browser/presetStore';
import type { RGBAImage } from '../../lib/resample';
import type { WhiteBackgroundResult } from '../../lib/enhance';
import { ENHANCE_DEFAULTS } from '../../lib/enhance';
import type { ImageFormat } from '../../lib/format';
import { FORMAT_EXT, FORMAT_LABEL, formatBytes } from '../../lib/format';
import { renderFileName, skuFromFileName, uniqueNames } from '../../lib/naming';
import { summarizeReport } from '../../lib/marketplacePresets';
import { Btn, FilePicker, Label, Notice, Panel, Slider, errorMessage, inputCls } from './ui';

interface Output {
  presetId: string;
  name: string;
  blob?: Blob;
  width?: number;
  height?: number;
  fails?: number;
  warns?: number;
  error?: string;
}

interface Row {
  id: string;
  file: File;
  sku: string;
  index: number;
  info?: string;
  status: 'queued' | 'running' | 'done' | 'error';
  error?: string;
  outputs: Output[];
}

export const BatchTab: React.FC<TabProps> = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [presets] = usePresets();
  const [selected, setSelected] = useState<string[]>(['amazon-main']);
  const [doEnhance, setDoEnhance] = useState(true);
  const [doClean, setDoClean] = useState(true);
  const [tolerance, setTolerance] = useState(38);
  const [formatOverride, setFormatOverride] = useState<'' | ImageFormat>('');
  const [template, setTemplate] = useState('{sku}_{preset}_{index}');
  const [folders, setFolders] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');

  const addFiles = (files: File[]) => {
    setRows((rs) => {
      const counts = new Map<string, number>();
      rs.forEach((r) => counts.set(r.sku, Math.max(counts.get(r.sku) ?? 0, r.index)));
      return [
        ...rs,
        ...files.map((file) => {
          const sku = skuFromFileName(file.name);
          const index = (counts.get(sku) ?? 0) + 1;
          counts.set(sku, index);
          return { id: crypto.randomUUID(), file, sku, index, status: 'queued' as const, outputs: [] };
        })
      ];
    });
  };

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const runBatch = async () => {
    setRunning(true);
    const chosen = presets.filter((p) => selected.includes(p.id));
    const list = rows;
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      setProgress(`${i + 1} / ${list.length}: ${row.file.name}`);
      update(row.id, { status: 'running', error: undefined, outputs: [] });
      try {
        const loaded = await loadImageFile(row.file);
        let img: RGBAImage = loaded.image;
        const steps: string[] = [];
        if (doEnhance) {
          img = await runPixelOp<RGBAImage>({ op: 'enhance', image: img, options: ENHANCE_DEFAULTS });
          steps.push('enhanced');
        }
        if (doClean) {
          const res = await runPixelOp<WhiteBackgroundResult>({ op: 'whiteBackground', image: img, options: { tolerance, feather: 1, shadow: 0.4 } });
          img = res.image;
          steps.push(`bg cleaned${res.warnings.length ? ' (busy background — check)' : ''}`);
        }
        const outputs: Output[] = [];
        for (const preset of chosen) {
          const p = formatOverride ? { ...preset, format: formatOverride, background: formatOverride === 'jpeg' && preset.background === 'transparent' ? '#FFFFFF' : preset.background } : preset;
          try {
            const outcome = await exportWithPreset(img, p, { sourceWidth: loaded.width, sourceHeight: loaded.height });
            const s = summarizeReport(outcome.report);
            outputs.push({
              presetId: p.id,
              name: renderFileName(template, { sku: row.sku, name: row.file.name, index: row.index, preset: p.id, width: p.width, height: p.height, ext: FORMAT_EXT[outcome.encode.format] }),
              blob: outcome.encode.blob,
              width: outcome.encode.width,
              height: outcome.encode.height,
              fails: s.fails,
              warns: s.warns
            });
          } catch (err) {
            outputs.push({ presetId: p.id, name: '', error: errorMessage(err) });
          }
        }
        update(row.id, {
          status: outputs.every((o) => o.error) ? 'error' : 'done',
          info: `${loaded.width}×${loaded.height} ${loaded.format ? FORMAT_LABEL[loaded.format] : ''} ${formatBytes(row.file.size)}${steps.length ? ' · ' + steps.join(', ') : ''}`,
          outputs
        });
      } catch (err) {
        update(row.id, { status: 'error', error: errorMessage(err) });
      }
    }
    setProgress('');
    setRunning(false);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const entries = rows.flatMap((r) => r.outputs.filter((o) => o.blob).map((o) => ({ sku: r.sku, o })));
    const names = uniqueNames(entries.map(({ sku, o }) => (folders ? `${sku}/${o.name}` : o.name)));
    entries.forEach(({ o }, i) => zip.file(names[i], o.blob!));
    downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `eyewear-batch-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const outputsCount = rows.reduce((a, r) => a + r.outputs.filter((o) => o.blob).length, 0);

  return (
    <div className="space-y-4">
      <Panel title="Batch SKU processing">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Steps (local, free)</Label>
            <label className="flex gap-2 text-xs items-center"><input type="checkbox" className="accent-[#00ff7f]" checked={doEnhance} onChange={(e) => setDoEnhance(e.target.checked)} />Enhance (levels, denoise, sharpen)</label>
            <label className="flex gap-2 text-xs items-center"><input type="checkbox" className="accent-[#00ff7f]" checked={doClean} onChange={(e) => setDoClean(e.target.checked)} />White background + dust cleanup</label>
            {doClean && <Slider label="Background tolerance" value={tolerance} min={5} max={110} onChange={setTolerance} />}
            <label className="block">
              <Label>Format</Label>
              <select className={inputCls} value={formatOverride} onChange={(e) => setFormatOverride(e.target.value as '' | ImageFormat)}>
                <option value="">Use each preset's format</option>
                <option value="jpeg">Force JPG</option>
                <option value="png">Force PNG</option>
                <option value="webp">Force WebP</option>
              </select>
            </label>
          </div>
          <div>
            <Label>Marketplace presets (resize + validate)</Label>
            <div className="max-h-48 overflow-y-auto border border-[#ececec]/15 p-2 space-y-1">
              {presets.map((p) => (
                <label key={p.id} className="flex gap-2 text-xs items-center">
                  <input
                    type="checkbox"
                    className="accent-[#00ff7f]"
                    checked={selected.includes(p.id)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                  />
                  <span>{p.name}</span>
                  <span className="font-mono text-[10px] text-[#ececec]/40">{p.width}×{p.height}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block">
              <Label hint="{sku} {preset} {index} {index2} {w} {h} {name}">File name pattern</Label>
              <input className={inputCls} value={template} onChange={(e) => setTemplate(e.target.value)} />
            </label>
            <label className="flex gap-2 text-xs items-center"><input type="checkbox" className="accent-[#00ff7f]" checked={folders} onChange={(e) => setFolders(e.target.checked)} />One folder per SKU in the ZIP</label>
            <Notice tone="info">Originals are never overwritten. SKUs are read from file names — edit them in the table before running.</Notice>
          </div>
        </div>
        <FilePicker multiple onFiles={addFiles} label="Drop many SKU photos (e.g. VK-2190-C1_1.jpg, VK-2190-C1_2.jpg)" />
        <div className="flex flex-wrap gap-2 items-center">
          <Btn variant="primary" onClick={runBatch} busy={running} disabled={!rows.length || !selected.length} icon={<Play className="w-3.5 h-3.5" />}>
            Process {rows.length} image{rows.length === 1 ? '' : 's'} × {selected.length} preset{selected.length === 1 ? '' : 's'}
          </Btn>
          <Btn onClick={downloadZip} disabled={!outputsCount || running} icon={<FileArchive className="w-3.5 h-3.5" />}>Download {outputsCount} as ZIP</Btn>
          <Btn variant="danger" onClick={() => setRows([])} disabled={running || !rows.length} icon={<Trash2 className="w-3.5 h-3.5" />}>Clear</Btn>
          {progress && <span className="font-mono text-xs text-[#00ff7f]">{progress}</span>}
        </div>
      </Panel>

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-[#ececec]/15 bg-[#151518]">
          <table className="w-full text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-[#ececec]/50 bg-[#0c0c0e]">
              <tr>
                <th className="text-left p-2">File</th>
                <th className="text-left p-2">SKU</th>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Status / outputs</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ececec]/5 font-mono">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 align-top break-all">
                    {r.file.name}
                    {r.info && <div className="text-[10px] text-[#ececec]/40">{r.info}</div>}
                  </td>
                  <td className="p-2 align-top">
                    <input className={`${inputCls} w-40`} value={r.sku} disabled={running} onChange={(e) => update(r.id, { sku: e.target.value })} />
                  </td>
                  <td className="p-2 align-top">
                    <input type="number" min={1} className={`${inputCls} w-14`} value={r.index} disabled={running} onChange={(e) => update(r.id, { index: Number(e.target.value) || 1 })} />
                  </td>
                  <td className="p-2 align-top space-y-1">
                    {r.status === 'queued' && <span className="text-[#ececec]/40">queued</span>}
                    {r.status === 'running' && <span className="text-[#00ff7f]">processing…</span>}
                    {r.error && <span className="text-red-300">{r.error}</span>}
                    {r.outputs.map((o) => (
                      <div key={o.presetId} className="flex items-center gap-1.5">
                        {o.error ? <XCircle className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle2 className={`w-3.5 h-3.5 ${o.fails ? 'text-amber-400' : 'text-[#00ff7f]'}`} />}
                        {o.error ? (
                          <span className="text-red-300">{o.presetId}: {o.error}</span>
                        ) : (
                          <button className="underline decoration-dotted text-left" onClick={() => downloadBlob(o.blob!, o.name)}>
                            {o.name} · {o.width}×{o.height} · {formatBytes(o.blob!.size)}
                            {o.fails ? ` · ${o.fails} rule violation${o.fails > 1 ? 's' : ''}` : ''}
                          </button>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="p-2 align-top">
                    <button className="p-1 border border-[#ececec]/20" disabled={running} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
