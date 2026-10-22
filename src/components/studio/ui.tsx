// Shared UI primitives for the studio tabs (matches the app's dark mono style).

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Upload, XCircle } from 'lucide-react';
import type { ValidationItem } from '../../lib/marketplacePresets';
import { summarizeReport } from '../../lib/marketplacePresets';
import type { RGBAImage } from '../../lib/resample';
import { rasterToCanvas } from '../../lib/browser/imageIO';

export const Panel: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  right,
  children,
  className = ''
}) => (
  <section className={`bg-[#151518] border border-[#ececec]/15 p-4 sm:p-5 space-y-4 ${className}`}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-3">
        {title && <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#ececec]/70">{title}</h3>}
        {right}
      </div>
    )}
    {children}
  </section>
);

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'ai';

export const Btn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: React.ReactNode; busy?: boolean }
> = ({ variant = 'ghost', icon, busy, children, className = '', disabled, ...rest }) => {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-[#00ff7f] text-black border-[#00ff7f] hover:bg-[#33ff99]',
    ghost: 'bg-[#0c0c0e] text-[#ececec] border-[#ececec]/20 hover:border-[#ececec]/50',
    danger: 'bg-[#0c0c0e] text-red-300 border-red-400/40 hover:border-red-400',
    ai: 'bg-[#1b1430] text-violet-200 border-violet-400/40 hover:border-violet-300'
  };
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 border font-mono text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {busy ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  );
};

export const Label: React.FC<{ children: React.ReactNode; hint?: React.ReactNode }> = ({ children, hint }) => (
  <span className="block font-mono text-[10px] uppercase tracking-wider text-[#ececec]/50 mb-1">
    {children}
    {hint && <span className="normal-case tracking-normal text-[#ececec]/35 ml-1">{hint}</span>}
  </span>
);

export const inputCls =
  'w-full bg-[#0c0c0e] border border-[#ececec]/20 px-2.5 py-2 text-xs font-mono text-[#ececec] focus:border-[#00ff7f] outline-none';

export const NumberField: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix
}) => (
  <label className="block">
    <Label>{label}{suffix ? ` (${suffix})` : ''}</Label>
    <input type="number" className={inputCls} value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

export const Slider: React.FC<{ label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string }> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format
}) => (
  <label className="block">
    <div className="flex justify-between">
      <Label>{label}</Label>
      <span className="font-mono text-[10px] text-[#00ff7f]">{format ? format(value) : value}</span>
    </div>
    <input type="range" className="w-full accent-[#00ff7f]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

export function Select<T extends string>({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export const Notice: React.FC<{ tone?: 'info' | 'warn' | 'error' | 'ai'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const cls = {
    info: 'border-sky-400/30 bg-sky-400/5 text-sky-100/90',
    warn: 'border-amber-400/40 bg-amber-400/5 text-amber-100/90',
    error: 'border-red-400/50 bg-red-400/10 text-red-100',
    ai: 'border-violet-400/40 bg-violet-400/5 text-violet-100/90'
  }[tone];
  return <div className={`border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</div>;
};

export const StatusIcon: React.FC<{ status: ValidationItem['status'] }> = ({ status }) => {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-[#00ff7f] shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Info className="w-4 h-4 text-sky-300 shrink-0" />;
};

export const ValidationReport: React.FC<{ items: ValidationItem[]; title?: string }> = ({ items, title = 'Validation report' }) => {
  const s = summarizeReport(items);
  return (
    <div className="border border-[#ececec]/15">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#0c0c0e] border-b border-[#ececec]/10">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#ececec]/60">{title}</span>
        <span className="font-mono text-[10px]">
          <span className="text-[#00ff7f]">{s.passes} pass</span> · <span className="text-amber-400">{s.warns} warn</span> ·{' '}
          <span className="text-red-400">{s.fails} fail</span>
        </span>
      </div>
      <ul className="divide-y divide-[#ececec]/5">
        {items.map((it, i) => (
          <li key={it.id + i} className="flex gap-2 px-3 py-2 text-xs">
            <StatusIcon status={it.status} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap justify-between gap-x-3">
                <span className="text-[#ececec]/60">{it.label}</span>
                <span className="font-mono text-[#ececec] text-right">{it.value}</span>
              </div>
              {it.message && <p className="text-[11px] text-[#ececec]/45 mt-0.5">{it.message}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="px-3 py-2 text-[10px] text-[#ececec]/40 border-t border-[#ececec]/10">
        Automated checks are heuristics. Passing them does not guarantee marketplace approval.
      </p>
    </div>
  );
};

/** Object URL for a raster image (JPEG preview if opaque, PNG if it has transparency). */
export function useRasterUrl(img: RGBAImage | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!img) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let made: string | null = null;
    let alpha = false;
    for (let i = 3; i < img.data.length; i += 4 * 97) if (img.data[i] < 255) { alpha = true; break; }
    const canvas = rasterToCanvas(img);
    canvas.toBlob(
      (b) => {
        canvas.width = canvas.height = 0;
        if (!b || cancelled) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      },
      alpha ? 'image/png' : 'image/jpeg',
      0.92
    );
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [img]);
  return url;
}

export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Checkerboard behind images so transparency is visible. */
export const checkerStyle: React.CSSProperties = {
  backgroundColor: '#1d1d21',
  backgroundImage:
    'linear-gradient(45deg,#2a2a2e 25%,transparent 25%),linear-gradient(-45deg,#2a2a2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2e 75%),linear-gradient(-45deg,transparent 75%,#2a2a2e 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0'
};

/** Before/after comparison slider for two image URLs. */
export const CompareView: React.FC<{ before: string | null; after: string | null; beforeLabel?: string; afterLabel?: string }> = ({
  before,
  after,
  beforeLabel = 'Original',
  afterLabel = 'Edited'
}) => {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  if (!before && !after) return null;
  return (
    <div
      ref={ref}
      className="relative w-full select-none overflow-hidden border border-[#ececec]/15 touch-none"
      style={checkerStyle}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      {after && <img src={after} alt={afterLabel} className="block w-full h-auto max-h-[70vh] object-contain" draggable={false} />}
      {before && (
        <img
          src={before}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false}
        />
      )}
      {before && after && (
        <>
          <div className="absolute top-0 bottom-0 w-0.5 bg-[#00ff7f] pointer-events-none" style={{ left: `${pos}%` }} />
          <span className="absolute top-2 left-2 font-mono text-[10px] bg-black/70 px-1.5 py-0.5">{beforeLabel}</span>
          <span className="absolute top-2 right-2 font-mono text-[10px] bg-black/70 px-1.5 py-0.5 text-[#00ff7f]">{afterLabel}</span>
          <input
            aria-label="Compare position"
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/2 accent-[#00ff7f]"
          />
        </>
      )}
    </div>
  );
};

export const FilePicker: React.FC<{ onFiles: (files: File[]) => void; multiple?: boolean; label?: string; compact?: boolean }> = ({
  onFiles,
  multiple = false,
  label = 'Drop sunglasses photos or click to upload',
  compact
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const accept = (list: FileList | null) => {
    const files = Array.from(list || []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(f.name));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        accept(e.dataTransfer.files);
      }}
      className={`cursor-pointer border border-dashed text-center transition ${compact ? 'p-3' : 'p-8'} ${
        over ? 'border-[#00ff7f] bg-[#00ff7f]/10' : 'border-[#ececec]/25 hover:border-[#ececec]/50 bg-[#0c0c0e]'
      }`}
    >
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="flex items-center justify-center gap-2 font-mono text-xs text-[#ececec]/70">
        <Upload className="w-4 h-4 text-[#00ff7f]" />
        {label}
      </div>
    </div>
  );
};

export const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({ label, value, accent }) => (
  <div>
    <span className="block font-mono text-[9px] uppercase tracking-wider text-[#ececec]/40">{label}</span>
    <span className={`font-mono text-xs font-bold ${accent ? 'text-[#00ff7f]' : 'text-[#ececec]'}`}>{value}</span>
  </div>
);

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
