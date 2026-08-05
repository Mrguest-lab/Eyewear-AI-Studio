import React from 'react';
import { Layers, BookOpen, Github, Sparkles, Sliders } from 'lucide-react';

interface HeaderProps {
  mode: 'single' | 'bulk';
  onModeChange: (mode: 'single' | 'bulk') => void;
  onOpenGuide: () => void;
  onOpenGithub: () => void;
  totalProcessedCount: number;
  totalSavedBytes: number;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  onOpenGuide,
  onOpenGithub,
  totalSavedBytes
}) => {
  const formatSavedMB = (totalSavedBytes / (1024 * 1024)).toFixed(1);

  return (
    <header className="sticky top-0 z-30 bg-[#0c0c0e]/95 backdrop-blur-md border-b-2 border-[#ececec]/10 text-[#ececec] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-0">
          {/* Brand */}
          <div className="brand">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#ececec]/40 block mb-1">
              v2.4.0 System Core
            </span>
            <div className="flex items-baseline space-x-2">
              <h1 className="font-syne text-2xl sm:text-3xl font-extrabold tracking-tighter leading-none text-[#ececec]">
                RESIZER<span className="text-[#00ff7f]">HUB</span>
              </h1>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#00ff7f] border border-[#00ff7f]/40 px-2 py-0.5 rounded-none hidden sm:inline-block">
                MARKETPLACES READY
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#ececec]/50 mt-1 hidden sm:block">
              E-Commerce Catalog & Quick Commerce Image Optimizer
            </p>
          </div>

          {/* Mode Switcher & Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center bg-[#151518] p-1 border border-[#ececec]/15">
              <button
                onClick={() => onModeChange('single')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                  mode === 'single'
                    ? 'bg-[#00ff7f] text-black shadow-sm'
                    : 'text-[#ececec]/60 hover:text-[#ececec] hover:bg-[#222226]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Single Editor</span>
              </button>
              <button
                onClick={() => onModeChange('bulk')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                  mode === 'bulk'
                    ? 'bg-[#00ff7f] text-black shadow-sm'
                    : 'text-[#ececec]/60 hover:text-[#ececec] hover:bg-[#222226]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bulk Queue</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {totalSavedBytes > 0 && (
                <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-xs font-mono text-[#00ff7f]">
                  <Sparkles className="w-3.5 h-3.5 text-[#00ff7f] animate-pulse" />
                  <span>{formatSavedMB} MB Saved</span>
                </div>
              )}

              <button
                onClick={onOpenGuide}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#151518] hover:bg-[#222226] text-[#ececec] text-xs font-mono transition border border-[#ececec]/20"
                title="View E-Commerce Marketplace Guidelines"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Marketplace Specs</span>
              </button>

              <button
                onClick={onOpenGithub}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#151518] hover:bg-[#222226] text-[#ececec] text-xs font-mono transition border border-[#ececec]/20"
                title="Open Source / GitHub Public Details"
              >
                <Github className="w-3.5 h-3.5 text-[#ececec]" />
                <span className="hidden sm:inline">GitHub Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
