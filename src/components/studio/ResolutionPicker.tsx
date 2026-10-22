import React from 'react';
import type { RatioId, ResolutionTier } from '../../lib/dimensions';
import { RATIOS, TIERS, getTargetSize, validateCustomSize } from '../../lib/dimensions';
import { aspectRatioLabel } from '../../lib/format';
import { NumberField } from './ui';

export interface ResolutionValue {
  tier: ResolutionTier | 'custom';
  ratio: RatioId;
  customWidth: number;
  customHeight: number;
}

export const DEFAULT_RESOLUTION: ResolutionValue = { tier: '2k', ratio: '1:1', customWidth: 2000, customHeight: 2000 };

export function resolveSize(v: ResolutionValue): { width: number; height: number } {
  if (v.tier === 'custom') return { width: Math.round(v.customWidth), height: Math.round(v.customHeight) };
  return getTargetSize(v.tier, v.ratio);
}

/** Output size selector that always shows the exact pixel dimensions and real aspect ratio. */
export const ResolutionPicker: React.FC<{ value: ResolutionValue; onChange: (v: ResolutionValue) => void }> = ({ value, onChange }) => {
  const size = resolveSize(value);
  const errors = value.tier === 'custom' ? validateCustomSize(size.width, size.height) : [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1">
        {[...TIERS, { id: 'custom' as const, label: 'Custom' }].map((t) => (
          <button
            key={t.id}
            onClick={() => onChange({ ...value, tier: t.id })}
            className={`py-1.5 font-mono text-[11px] font-bold border ${
              value.tier === t.id ? 'bg-[#00ff7f] text-black border-[#00ff7f]' : 'border-[#ececec]/20 text-[#ececec]/70 hover:border-[#ececec]/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {value.tier !== 'custom' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {RATIOS.map((r) => {
            const s = getTargetSize(value.tier as ResolutionTier, r.id);
            return (
              <button
                key={r.id}
                onClick={() => onChange({ ...value, ratio: r.id })}
                className={`flex justify-between px-2 py-1.5 border text-left font-mono text-[11px] ${
                  value.ratio === r.id ? 'border-[#00ff7f] text-[#00ff7f] bg-[#00ff7f]/5' : 'border-[#ececec]/15 text-[#ececec]/70 hover:border-[#ececec]/40'
                }`}
              >
                <span>{r.label}</span>
                <span>
                  {s.width}×{s.height}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width" suffix="px" value={value.customWidth} min={16} max={16384} onChange={(v) => onChange({ ...value, customWidth: v })} />
          <NumberField label="Height" suffix="px" value={value.customHeight} min={16} max={16384} onChange={(v) => onChange({ ...value, customHeight: v })} />
        </div>
      )}
      <p className="font-mono text-[11px] text-[#ececec]/60">
        Output: <span className="text-[#ececec]">{size.width} × {size.height} px</span> · ratio {aspectRatioLabel(size.width, size.height)} ·{' '}
        {((size.width * size.height) / 1e6).toFixed(1)} MP
      </p>
      {errors.map((e) => (
        <p key={e} className="text-[11px] text-red-300">
          {e}
        </p>
      ))}
    </div>
  );
};
