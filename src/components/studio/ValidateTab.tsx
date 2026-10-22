import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { TabProps } from './types';
import { loadImageFile } from '../../lib/browser/imageIO';
import { analyze } from '../../lib/browser/pipeline';
import { usePresets } from '../../lib/browser/presetStore';
import type { ValidationItem } from '../../lib/marketplacePresets';
import { buildValidationReport } from '../../lib/marketplacePresets';
import { FORMAT_LABEL } from '../../lib/format';
import { FilePicker, Notice, Panel, Select, ValidationReport, errorMessage, useBlobUrl } from './ui';

interface Checked {
  id: string;
  file: File;
  report?: ValidationItem[];
  error?: string;
}

/** Quality control for finished files exactly as they will be uploaded (no re-encoding). */
export const ValidateTab: React.FC<TabProps> = () => {
  const [presets] = usePresets();
  const [presetId, setPresetId] = useState('none');
  const [items, setItems] = useState<Checked[]>([]);
  const [busy, setBusy] = useState(false);
  const preset = presets.find((p) => p.id === presetId) ?? null;

  const check = async (files: File[], presetOverride = preset) => {
    setBusy(true);
    const out: Checked[] = [];
    for (const file of files) {
      try {
        const loaded = await loadImageFile(file);
        const quality = await analyze(loaded.image);
        const report = buildValidationReport(
          { width: loaded.width, height: loaded.height, format: loaded.format, fileSize: file.size, quality },
          presetOverride
        );
        if (presetOverride?.minLongSidePx && Math.max(loaded.width, loaded.height) < presetOverride.minLongSidePx) {
          report.unshift({
            id: 'small',
            label: 'Image size',
            value: `${Math.max(loaded.width, loaded.height)}px longer side`,
            status: 'fail',
            message: `Too small for this preset (needs ≥ ${presetOverride.minLongSidePx}px).`
          });
        }
        out.push({ id: crypto.randomUUID(), file, report });
      } catch (err) {
        out.push({ id: crypto.randomUUID(), file, error: errorMessage(err) });
      }
    }
    setItems((list) => [...out, ...list]);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Panel title={<span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#00ff7f]" /> Image quality & marketplace validation</span>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Check against preset"
            value={presetId}
            onChange={setPresetId}
            options={[{ value: 'none', label: 'No preset (quality checks only)' }, ...presets.map((p) => ({ value: p.id, label: `${p.name} (${p.width}×${p.height} ${FORMAT_LABEL[p.format]})` }))]}
          />
          <Notice tone="info">
            Checks the file exactly as it will be uploaded: real format from file bytes, dimensions, aspect ratio, file size, transparency,
            background uniformity, sharpness, product coverage and edge cropping. Heuristics cannot guarantee approval.
          </Notice>
        </div>
        <FilePicker multiple onFiles={(f) => check(f)} label="Drop finished images to validate" />
        {busy && <p className="font-mono text-xs text-[#00ff7f] animate-pulse">Analysing…</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.map((it) => (
          <CheckedCard key={it.id} it={it} />
        ))}
      </div>
    </div>
  );
};

const CheckedCard: React.FC<{ it: Checked }> = ({ it }) => {
  const url = useBlobUrl(it.file);
  return (
    <Panel title={<span className="normal-case break-all">{it.file.name}</span>}>
      {url && <img src={url} alt={it.file.name} className="w-full max-h-64 object-contain bg-[#0c0c0e]" />}
      {it.error ? <Notice tone="error">{it.error}</Notice> : it.report && <ValidationReport items={it.report} />}
    </Panel>
  );
};
