import React from 'react';
import { FileType, Glasses, Layers, Server, ShieldCheck, Sliders, SlidersHorizontal, UserRound } from 'lucide-react';
import type { TabId } from './studio/types';

export const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'studio', label: 'Eyewear Studio', icon: <Glasses className="w-3.5 h-3.5" /> },
  { id: 'photoshoot', label: 'AI Photoshoot', icon: <UserRound className="w-3.5 h-3.5" /> },
  { id: 'convert', label: 'Converter', icon: <FileType className="w-3.5 h-3.5" /> },
  { id: 'batch', label: 'Batch SKUs', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'validate', label: 'Validate', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { id: 'presets', label: 'Presets', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  { id: 'resize', label: 'Quick Resize', icon: <Sliders className="w-3.5 h-3.5" /> },
  { id: 'settings', label: 'AI Backend', icon: <Server className="w-3.5 h-3.5" /> }
];

export const Header: React.FC<{ tab: TabId; onTab: (t: TabId) => void }> = ({ tab, onTab }) => (
  <header className="sticky top-0 z-30 bg-[#0c0c0e]/95 backdrop-blur-md border-b-2 border-[#ececec]/10 text-[#ececec]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-syne text-2xl sm:text-3xl font-extrabold tracking-tighter leading-none">
          RESIZER<span className="text-[#00ff7f]">HUB</span>
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#00ff7f] border border-[#00ff7f]/40 px-2 py-0.5">
          Eyewear AI Studio
        </span>
        <span className="font-mono text-[11px] text-[#ececec]/45 hidden md:inline">
          Watermark-free product photos, model shoots & marketplace exports
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto mt-3 -mb-0.5" aria-label="Tools">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 whitespace-nowrap font-mono text-[11px] font-bold uppercase border-b-2 transition ${
              tab === t.id ? 'border-[#00ff7f] text-[#00ff7f]' : 'border-transparent text-[#ececec]/55 hover:text-[#ececec]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  </header>
);
