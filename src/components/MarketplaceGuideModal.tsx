import React from 'react';
import { X, Check, ShoppingBag, Store, Sparkles, Tag, Package, ExternalLink, ShieldCheck } from 'lucide-react';
import { MARKETPLACE_PRESETS } from '../data/presets';
import { Preset } from '../types';

interface MarketplaceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: Preset) => void;
}

export const MarketplaceGuideModal: React.FC<MarketplaceGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-[#151518] border border-[#ececec]/20 max-w-4xl w-full p-6 space-y-6 shadow-2xl my-8 text-[#ececec]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ececec]/10 pb-4">
          <div className="flex items-center space-x-3 font-mono">
            <div className="p-2 bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase text-[#ececec]">
                E-Commerce & Quick Commerce Image Specifications
              </h2>
              <p className="text-[11px] text-[#ececec]/50 mt-0.5">
                Flipkart, Nykaa, Myntra, Ajio, Blinkit, Instamart, Zepto, Amazon, Shopify & Marketplace Guidelines.
              </p>
              <p className="text-[11px] text-amber-300/90 mt-1">
                Quick reference values only — not verified current requirements. Check each marketplace's latest seller guidelines; editable
                rules live in the Presets tab.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-[#0c0c0e] hover:bg-[#222226] text-[#ececec] transition border border-[#ececec]/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Marketplace Reference Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1 font-mono">
          {MARKETPLACE_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="bg-[#0c0c0e] border border-[#ececec]/15 hover:border-[#00ff7f] p-4 space-y-3 flex flex-col justify-between transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#ececec] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#00ff7f]" />
                    {preset.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f] font-bold">
                    {preset.recommendedWidth}x{preset.recommendedHeight} px
                  </span>
                </div>

                <p className="text-[11px] text-[#ececec]/60 mb-2">{preset.description}</p>

                <ul className="space-y-1 text-[10px] text-[#ececec]/80 bg-[#151518] p-2.5 border border-[#ececec]/10">
                  {preset.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#00ff7f] font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => {
                  onSelectPreset(preset);
                  onClose();
                }}
                className="w-full mt-3 py-2 px-3 bg-[#00ff7f] hover:bg-[#00e672] text-black font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply {preset.platform} Specs</span>
              </button>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="bg-[#0c0c0e] border border-[#ececec]/15 p-3 text-xs text-[#ececec]/60 flex items-center justify-between font-mono">
          <p className="text-[10px] uppercase">
            100% Client-Side Engine. Private processing in your browser.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#151518] hover:bg-[#222226] text-[#ececec] text-xs uppercase border border-[#ececec]/20 transition"
          >
            Close Specs
          </button>
        </div>
      </div>
    </div>
  );
};
