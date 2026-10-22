import React, { useEffect, useState } from 'react';
import { ArrowRight, Download, FileArchive, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import type { TabProps } from './types';
import { canEncode, downloadBlob, encodeImage, loadImageFile } from '../../lib/browser/imageIO';
import type { LoadedImage } from '../../lib/browser/imageIO';
import type { ImageFormat } from '../../lib/format';
import { EXPORT_FORMATS, FORMAT_EXT, FORMAT_LABEL, formatBytes, isLossy, supportsAlpha } from '../../lib/format';
import { renderFileName, skuFromFileName, uniqueNames } from '../../lib/naming';
import { hasTransparency } from '../../lib/analysis';
import { Btn, FilePicker, Label, Notice, Panel, Slider, errorMessage, inputCls } from './ui';

interface Row {
  id: string;
  file: File;
  loaded?: LoadedImage;
  alpha?: boolean;
  status: 'loading' | 'ready' | 'converting' | 'done' | 'error';
  error?: string;
  out?: { blob: Blob; name: string; format: ImageFormat; width: number; height: number; flattened: boolean };
}

export const ConverterTab: React.FC<TabProps> = ({ work }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [format, setFormat] = useState<ImageFormat>('jpeg');
  const [quality, setQuality] = useState(90);
  const [bg, setBg] = useState('#FFFFFF');
  const [template, setTemplate] = useState('{name}');
  const [support, setSupport] = useState<Partial<Record<ImageFormat, boolean>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all(EXPORT_FORMATS.map(async (f) => [f, await canEncode(f)] as const)).then((list) => setSupport(Object.fromEntries(list)));
  }, []);

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addFiles = async (files: File[]) => {
    const fresh: Row[] = files.map((file) => ({ id: crypto.randomUUID(), file, status: 'loading' }));
    setRows((rs) => [...rs, ...fresh]);
    for (const row of fresh) {
      try {
        const loaded = await loadImageFile(row.file);
        update(row.id, { loaded, alpha: hasTransparency(loaded.image).any, status: 'ready' });
      } catch (err) {
        update(row.id, { status: 'error', error: errorMessage(err) });
      }
    }
  };

  const addWork = async () => {
    if (!work) return;
    const png = await encodeImage(work.image, { format: 'png' });
    await addFiles([new File([png.blob], `${work.sku || 'studio'}_edited.png`, { type: 'image/png' })]);
  };

  const convertAll = async () => {
    setBusy(true);
    const ready = rows.filter((r) => r.loaded);
    const names = uniqueNames(
      ready.map((r, i) => renderFileName(template, { sku: skuFromFileName(r.file.name), name: r.file.name, index: i + 1, ext: FORMAT_EXT[format] }))
    );
    for (let i = 0; i < ready.length; i++) {
      const r = ready[i];
      update(r.id, { status: 'converting', error: undefined });
      try {
        const res = await encodeImage(r.loaded!.image, { format, quality, flattenColor: bg });
        update(r.id, { status: 'done', out: { blob: res.blob, name: names[i], format: res.format, width: res.width, height: res.height, flattened: res.flattened } });
      } catch (err) {
        update(r.id, { status: 'error', error: errorMessage(err) });
      }
    }
    setBusy(false);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const r of rows) if (r.out) zip.file(r.out.name, r.out.blob);
    downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `converted-${FORMAT_EXT[format]}-${Date.now()}.zip`);
  };

  const done = rows.filter((r) => r.out);
  const totalIn = done.reduce((a, r) => a + r.file.size, 0);
  const totalOut = done.reduce((a, r) => a + (r.out?.blob.size ?? 0), 0);

  return (
    <div className="space-y-4">
      <Panel title="JPG · PNG · WebP converter (runs in your browser)">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Output format</Label>
            <div className="grid grid-cols-3 gap-1">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f}
                  disabled={support[f] === false}
                  onClick={() => setFormat(f)}
                  className={`py-2 font-mono text-xs font-bold border disabled:opacity-30 ${format === f ? 'bg-[#00ff7f] text-black border-[#00ff7f]' : 'border-[#ececec]/20'}`}
                  title={support[f] === false ? 'Not supported by this browser' : ''}
                >
                  {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>
            {support.webp === false && <p className="text-[10px] text-amber-300 mt-1">This browser cannot encode WebP. Use Chrome, Edge or Firefox.</p>}
          </div>
          <div>{isLossy(format) ? <Slider label="Quality" value={quality} min={40} max={100} onChange={setQuality} /> : <p className="text-[11px] text-[#ececec]/50 mt-4">PNG is lossless (no quality setting).</p>}</div>
          <label className="block">
            <Label hint={supportsAlpha(format) ? '(transparency is preserved)' : '(JPG has no transparency)'}>Fill for transparent areas</Label>
            <div className="flex gap-2">
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value.toUpperCase())} disabled={supportsAlpha(format)} className="h-8 w-10 bg-transparent" />
              <input className={inputCls} value={bg} onChange={(e) => setBg(e.target.value)} disabled={supportsAlpha(format)} />
            </div>
          </label>
          <label className="block">
            <Label hint="{name} {sku} {index} {index2}">Rename pattern</Label>
            <input className={inputCls} value={template} onChange={(e) => setTemplate(e.target.value)} />
          </label>
        </div>
        <FilePicker multiple onFiles={addFiles} label="Drop JPG / PNG / WebP files or click to add (batch supported)" />
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={convertAll} busy={busy} disabled={!rows.some((r) => r.loaded)}>
            Convert {rows.filter((r) => r.loaded).length} to {FORMAT_LABEL[format]}
          </Btn>
          <Btn onClick={downloadZip} disabled={!done.length} icon={<FileArchive className="w-3.5 h-3.5" />}>Download all as ZIP</Btn>
          {work && <Btn onClick={addWork}>Add current Studio image</Btn>}
          <Btn variant="danger" onClick={() => setRows([])} disabled={!rows.length} icon={<Trash2 className="w-3.5 h-3.5" />}>Clear</Btn>
        </div>
        {done.length > 0 && (
          <p className="font-mono text-xs text-[#ececec]/60">
            {done.length} converted · {formatBytes(totalIn)} → {formatBytes(totalOut)}
            {totalOut < totalIn ? ` (${Math.round((1 - totalOut / totalIn) * 100)}% smaller)` : ` (${Math.round((totalOut / totalIn - 1) * 100)}% larger)`}
          </p>
        )}
        <Notice tone="info">
          Output files are genuinely re-encoded: each result's format is read back from the file bytes, never just renamed. Re-encoding
          converts to sRGB and drops EXIF/metadata. Your original files are not changed.
        </Notice>
      </Panel>

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-[#ececec]/15 bg-[#151518]">
          <table className="w-full text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-[#ececec]/50 bg-[#0c0c0e]">
              <tr>
                <th className="text-left p-2">Input</th>
                <th className="p-2"></th>
                <th className="text-left p-2">Output</th>
                <th className="text-right p-2">Savings</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ececec]/5 font-mono">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 align-top">
                    <div className="text-[#ececec] break-all">{r.file.name}</div>
                    {r.loaded && (
                      <div className="text-[#ececec]/50">
                        {r.loaded.width}×{r.loaded.height} · {r.loaded.format ? FORMAT_LABEL[r.loaded.format] : r.file.type || '?'} · {formatBytes(r.file.size)}
                        {r.alpha ? ' · has transparency' : ''}
                      </div>
                    )}
                    {r.status === 'loading' && <div className="text-[#ececec]/40">reading…</div>}
                  </td>
                  <td className="p-2 align-top"><ArrowRight className="w-3.5 h-3.5 text-[#ececec]/30" /></td>
                  <td className="p-2 align-top">
                    {r.out ? (
                      <>
                        <div className="text-[#00ff7f] break-all">{r.out.name}</div>
                        <div className="text-[#ececec]/50">
                          {r.out.width}×{r.out.height} · {FORMAT_LABEL[r.out.format]} (verified) · {formatBytes(r.out.blob.size)}
                          {r.out.flattened ? ` · transparency → ${bg}` : ''}
                        </div>
                      </>
                    ) : r.status === 'error' ? (
                      <span className="text-red-300">{r.error}</span>
                    ) : r.status === 'converting' ? (
                      <span className="text-[#00ff7f]">converting…</span>
                    ) : (
                      <span className="text-[#ececec]/30">—</span>
                    )}
                  </td>
                  <td className="p-2 align-top text-right">
                    {r.out && (
                      <span className={r.out.blob.size <= r.file.size ? 'text-[#00ff7f]' : 'text-amber-300'}>
                        {r.out.blob.size <= r.file.size ? '−' : '+'}
                        {Math.abs(Math.round((1 - r.out.blob.size / r.file.size) * 100))}%
                      </span>
                    )}
                  </td>
                  <td className="p-2 align-top text-right whitespace-nowrap">
                    {r.out && (
                      <button className="p-1 border border-[#ececec]/20 mr-1" title="Download" onClick={() => downloadBlob(r.out!.blob, r.out!.name)}>
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button className="p-1 border border-[#ececec]/20" title="Remove" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
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
