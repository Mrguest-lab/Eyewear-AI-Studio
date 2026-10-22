import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Maximize2,
  Sliders,
  Palette,
  FileCode,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { MARKETPLACE_PRESETS } from '../data/presets';
import { OutputFormat, Preset, ResizeFitMode, ResizeOptions } from '../types';

interface ControlPanelProps {
  options: ResizeOptions;
  onChange: (updated: ResizeOptions) => void;
  originalWidth?: number;
  originalHeight?: number;
  onApplyToAll?: () => void;
  hasMultipleImages?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  options,
  onChange,
  originalWidth,
  originalHeight,
  onApplyToAll,
  hasMultipleImages = false
}) => {
  const [activePresetId, setActivePresetId] = useState<string>('flipkart-main');
  const [presetFilter, setPresetFilter] = useState<'all' | 'india' | 'global' | 'social'>('all');
  const [showAdjustments, setShowAdjustments] = useState<boolean>(false);

  // Apply preset handler
  const handleSelectPreset = (preset: Preset) => {
    setActivePresetId(preset.id);
    onChange({
      ...options,
      width: preset.recommendedWidth,
      height: preset.recommendedHeight,
      fitMode: preset.defaultFitMode,
      format: preset.recommendedFormat,
      quality: preset.defaultQuality,
      adjustments: {
        ...options.adjustments,
        backgroundColor: preset.defaultBgColor
      }
    });
  };

  // Dimension Handlers with Aspect Ratio lock support
  const handleWidthChange = (newWidth: number) => {
    const clampedW = Math.max(1, Math.round(newWidth));
    if (options.lockAspectRatio && originalWidth && originalHeight && originalWidth > 0) {
      const ratio = originalHeight / originalWidth;
      const newHeight = Math.max(1, Math.round(clampedW * ratio));
      onChange({ ...options, width: clampedW, height: newHeight });
    } else {
      onChange({ ...options, width: clampedW });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    const clampedH = Math.max(1, Math.round(newHeight));
    if (options.lockAspectRatio && originalWidth && originalHeight && originalWidth > 0) {
      const ratio = originalWidth / originalHeight;
      const newWidth = Math.max(1, Math.round(clampedH * ratio));
      onChange({ ...options, width: newWidth, height: clampedH });
    } else {
      onChange({ ...options, height: clampedH });
    }
  };

  const handleQuickPercent = (percent: number) => {
    if (originalWidth && originalHeight) {
      const newW = Math.round((originalWidth * percent) / 100);
      const newH = Math.round((originalHeight * percent) / 100);
      onChange({
        ...options,
        width: newW,
        height: newH,
        scalePercent: percent,
        fitMode: 'percentage'
      });
    } else {
      onChange({ ...options, scalePercent: percent, fitMode: 'percentage' });
    }
  };

  const selectedPreset = MARKETPLACE_PRESETS.find((p) => p.id === activePresetId);

  // Filter presets based on user tab selection
  const filteredPresets = MARKETPLACE_PRESETS.filter((p) => {
    if (presetFilter === 'india') {
      return ['Flipkart', 'Myntra', 'Nykaa', 'Ajio', 'Blinkit', 'Instamart', 'Zepto', 'Tata CLiQ', 'Meesho'].includes(p.platform);
    }
    if (presetFilter === 'global') {
      return ['Amazon', 'Shopify', 'Etsy', 'eBay', 'Walmart'].includes(p.platform);
    }
    if (presetFilter === 'social') {
      return p.category === 'social' || p.category === 'web';
    }
    return true; // all
  });

  return (
    <div className="bg-[#151518] border border-[#ececec]/15 rounded-none p-5 sm:p-6 space-y-6 text-[#ececec] shadow-2xl">
      {/* 1. Presets Header & Marketplace Pills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ececec]/50 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#00ff7f]" />
            Marketplace Presets
          </label>
          {selectedPreset && (
            <span className="font-mono text-[10px] tracking-wider text-[#00ff7f] bg-[#00ff7f]/10 border border-[#00ff7f]/30 px-2 py-0.5 rounded-none flex items-center gap-1">
              <Check className="w-3 h-3 text-[#00ff7f]" />
              {selectedPreset.platform} Specs
            </span>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 font-mono text-[10px]">
          {[
            { id: 'all', label: 'ALL' },
            { id: 'india', label: '🇮🇳 INDIA / QUICK COMMERCE' },
            { id: 'global', label: '🌐 GLOBAL E-COMMERCE' },
            { id: 'social', label: '📱 SOCIAL / WEB' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPresetFilter(tab.id as any)}
              className={`px-2 py-1 whitespace-nowrap border transition-all ${
                presetFilter === tab.id
                  ? 'bg-[#00ff7f] text-black font-bold border-[#00ff7f]'
                  : 'bg-[#0c0c0e] text-[#ececec]/60 border-[#ececec]/15 hover:text-[#ececec] hover:border-[#ececec]/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {filteredPresets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`relative flex flex-col p-2.5 text-left transition-all border ${
                  isActive
                    ? 'border-[#00ff7f] bg-[#00ff7f]/5'
                    : 'bg-[#0c0c0e] border-[#ececec]/10 hover:border-[#ececec]/30'
                }`}
              >
                {isActive && (
                  <span className="absolute top-1 right-1.5 font-mono text-[8px] text-[#00ff7f] tracking-widest uppercase">
                    ACTIVE
                  </span>
                )}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-bold ${
                      isActive ? 'text-[#00ff7f]' : 'text-[#ececec]'
                    }`}
                  >
                    {preset.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#ececec]/50 mt-1 font-mono">
                  <span>
                    {preset.recommendedWidth}x{preset.recommendedHeight}
                  </span>
                  <span className="text-[#ececec]/40 text-[9px]">{preset.aspectRatioLabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-[#ececec]/10" />

      {/* 2. Custom Dimensions & Fit Mode */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ececec]/50 flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-[#00ff7f]" />
            Dimensions & Strategy
          </label>

          <button
            onClick={() => onChange({ ...options, lockAspectRatio: !options.lockAspectRatio })}
            className={`flex items-center space-x-1.5 px-2 py-0.5 font-mono text-[10px] uppercase transition ${
              options.lockAspectRatio
                ? 'bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30'
                : 'bg-[#0c0c0e] text-[#ececec]/50 border border-[#ececec]/15'
            }`}
          >
            {options.lockAspectRatio ? (
              <>
                <Lock className="w-3 h-3 text-[#00ff7f]" />
                <span>Aspect Locked</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 text-[#ececec]/40" />
                <span>Unlocked</span>
              </>
            )}
          </button>
        </div>

        {/* Width & Height inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="font-mono text-[9px] text-[#ececec]/50 uppercase mb-1 block">
              Width (px)
            </span>
            <input
              type="number"
              min="1"
              max="10000"
              value={options.width}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="w-full bg-[#0c0c0e] border border-[#ececec]/25 px-3 py-2 font-mono text-xs text-[#ececec] focus:outline-none focus:border-[#00ff7f] transition"
            />
          </div>

          <div>
            <span className="font-mono text-[9px] text-[#ececec]/50 uppercase mb-1 block">
              Height (px)
            </span>
            <input
              type="number"
              min="1"
              max="10000"
              value={options.height}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="w-full bg-[#0c0c0e] border border-[#ececec]/25 px-3 py-2 font-mono text-xs text-[#ececec] focus:outline-none focus:border-[#00ff7f] transition"
            />
          </div>
        </div>

        {/* Quick Scale Buttons */}
        <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto">
          <span className="font-mono text-[9px] text-[#ececec]/40 uppercase mr-1">Scale:</span>
          {[25, 50, 75, 100, 150, 200].map((pct) => (
            <button
              key={pct}
              onClick={() => handleQuickPercent(pct)}
              className="px-2 py-0.5 bg-[#0c0c0e] border border-[#ececec]/15 hover:border-[#00ff7f] font-mono text-[10px] text-[#ececec]/80 transition"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Fit Strategy Buttons */}
        <div>
          <span className="font-mono text-[9px] text-[#ececec]/50 uppercase mb-1.5 block">
            Resize Strategy
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                id: 'contain',
                label: 'Contain (Padding)',
                desc: 'Add background canvas padding (Ideal for Marketplaces)'
              },
              { id: 'cover', label: 'Crop (Cover)', desc: 'Crop overflow to fill box' },
              { id: 'stretch', label: 'Stretch ⚠', desc: 'Distorts the product — avoid for listings' },
              { id: 'maxBounds', label: 'Max Bounds', desc: 'Downscale only if larger' }
            ].map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => onChange({ ...options, fitMode: strategy.id as ResizeFitMode })}
                className={`p-2 text-left border font-mono transition ${
                  options.fitMode === strategy.id
                    ? 'bg-[#00ff7f]/10 border-[#00ff7f] text-[#00ff7f]'
                    : 'bg-[#0c0c0e] border-[#ececec]/15 text-[#ececec]/70 hover:border-[#ececec]/30'
                }`}
                title={strategy.desc}
              >
                <p className="text-[11px] font-bold">{strategy.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Background Color selector (if Fit Mode is Contain or JPEG format) */}
        {(options.fitMode === 'contain' || options.format === 'image/jpeg') && (
          <div className="p-3 bg-[#0c0c0e] border border-[#ececec]/15 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#ececec]/70 font-bold uppercase flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[#00ff7f]" />
                Canvas Background Fill
              </span>
              <span className="font-mono text-[10px] text-[#ececec]/50">
                {options.adjustments.backgroundColor === '#FFFFFF'
                  ? 'Pure White'
                  : options.adjustments.backgroundColor}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              {[
                { name: 'White', hex: '#FFFFFF' },
                { name: 'Dark', hex: '#18181b' },
                { name: 'Transparent', hex: 'transparent' },
                { name: 'Blur', hex: 'blur' }
              ].map((bg) => (
                <button
                  key={bg.hex}
                  onClick={() =>
                    onChange({
                      ...options,
                      adjustments: { ...options.adjustments, backgroundColor: bg.hex }
                    })
                  }
                  className={`flex-1 py-1 px-1.5 font-mono text-[10px] border transition ${
                    options.adjustments.backgroundColor === bg.hex
                      ? 'border-[#00ff7f] bg-[#00ff7f]/10 text-[#00ff7f]'
                      : 'border-[#ececec]/15 bg-[#151518] text-[#ececec]/60 hover:border-[#ececec]/30'
                  }`}
                >
                  {bg.name}
                </button>
              ))}

              <input
                type="color"
                value={
                  options.adjustments.backgroundColor.startsWith('#')
                    ? options.adjustments.backgroundColor
                    : '#FFFFFF'
                }
                onChange={(e) =>
                  onChange({
                    ...options,
                    adjustments: { ...options.adjustments, backgroundColor: e.target.value }
                  })
                }
                className="w-7 h-7 cursor-pointer bg-transparent border border-[#ececec]/20"
                title="Custom Background Color"
              />
            </div>
          </div>
        )}
      </div>

      <hr className="border-[#ececec]/10" />

      {/* 3. Output Format, Quality & Max File Size */}
      <div className="space-y-4">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ececec]/50 flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5 text-[#00ff7f]" />
          Output Encoding
        </label>

        {/* Format Selector Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { format: 'image/webp', label: 'WEBP' },
            { format: 'image/jpeg', label: 'JPG' },
            { format: 'image/png', label: 'PNG' },
            { format: 'image/avif', label: 'AVIF' }
          ].map((item) => (
            <button
              key={item.format}
              onClick={() => onChange({ ...options, format: item.format as OutputFormat })}
              className={`p-2.5 font-mono text-center border transition ${
                options.format === item.format
                  ? 'bg-[#ececec] text-black font-bold border-[#ececec]'
                  : 'bg-[#0c0c0e] border-[#ececec]/15 text-[#ececec]/70 hover:border-[#ececec]/30'
              }`}
            >
              <p className="text-xs font-bold">{item.label}</p>
            </button>
          ))}
        </div>

        {/* Quality Slider */}
        {options.format !== 'image/png' && (
          <div className="space-y-2 bg-[#0c0c0e] border border-[#ececec]/15 p-3">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[#ececec]/60">QUALITY</span>
              <span className="font-bold text-[#00ff7f]">
                {Math.round(options.quality * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.01"
              value={options.quality}
              onChange={(e) => onChange({ ...options, quality: Number(e.target.value) })}
              className="w-full accent-[#00ff7f] h-1 bg-[#222226] cursor-pointer"
            />
          </div>
        )}

        {/* Max File Size Limit */}
        <div className="flex items-center justify-between bg-[#0c0c0e] border border-[#ececec]/15 p-3">
          <div>
            <p className="font-mono text-[11px] font-bold text-[#ececec]">MAX FILE SIZE TARGET</p>
            <p className="font-mono text-[9px] text-[#ececec]/40">Auto-compress under limit</p>
          </div>
          <select
            value={options.maxFileSizeBytes || 0}
            onChange={(e) =>
              onChange({ ...options, maxFileSizeBytes: Number(e.target.value) || undefined })
            }
            className="bg-[#151518] border border-[#ececec]/25 px-2 py-1 font-mono text-xs text-[#ececec] focus:outline-none focus:border-[#00ff7f]"
          >
            <option value={0}>NO LIMIT</option>
            <option value={500 * 1024}>500 KB</option>
            <option value={1000 * 1024}>1.0 MB</option>
            <option value={2000 * 1024}>2.0 MB</option>
            <option value={5000 * 1024}>5.0 MB</option>
          </select>
        </div>
      </div>

      <hr className="border-[#ececec]/10" />

      {/* 4. Collapsible Image Adjustments */}
      <div className="space-y-3">
        <button
          onClick={() => setShowAdjustments(!showAdjustments)}
          className="w-full flex items-center justify-between py-1 font-mono text-[10px] font-bold text-[#ececec]/60 uppercase tracking-widest hover:text-[#00ff7f] transition"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#00ff7f]" />
            Color & Filters
          </span>
          {showAdjustments ? (
            <ChevronUp className="w-4 h-4 text-[#ececec]/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#ececec]/40" />
          )}
        </button>

        {showAdjustments && (
          <div className="space-y-3 pt-2 border-t border-[#ececec]/10 font-mono">
            {/* Rotation & Flips */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#ececec]/50">Transform</span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() =>
                    onChange({
                      ...options,
                      adjustments: {
                        ...options.adjustments,
                        rotate: (options.adjustments.rotate + 90) % 360
                      }
                    })
                  }
                  className="px-2 py-1 bg-[#0c0c0e] border border-[#ececec]/15 hover:border-[#00ff7f] text-[#ececec] text-xs flex items-center gap-1"
                  title="Rotate 90 Degrees"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>{options.adjustments.rotate}°</span>
                </button>

                <button
                  onClick={() =>
                    onChange({
                      ...options,
                      adjustments: {
                        ...options.adjustments,
                        flipH: !options.adjustments.flipH
                      }
                    })
                  }
                  className={`p-1.5 border text-xs ${
                    options.adjustments.flipH
                      ? 'bg-[#00ff7f]/10 border-[#00ff7f] text-[#00ff7f]'
                      : 'bg-[#0c0c0e] border-[#ececec]/15 text-[#ececec]/60'
                  }`}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() =>
                    onChange({
                      ...options,
                      adjustments: {
                        ...options.adjustments,
                        flipV: !options.adjustments.flipV
                      }
                    })
                  }
                  className={`p-1.5 border text-xs ${
                    options.adjustments.flipV
                      ? 'bg-[#00ff7f]/10 border-[#00ff7f] text-[#00ff7f]'
                      : 'bg-[#0c0c0e] border-[#ececec]/15 text-[#ececec]/60'
                  }`}
                  title="Flip Vertical"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Brightness */}
            <div>
              <div className="flex justify-between text-[11px] text-[#ececec]/50 mb-1">
                <span>Brightness</span>
                <span>{options.adjustments.brightness}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={options.adjustments.brightness}
                onChange={(e) =>
                  onChange({
                    ...options,
                    adjustments: {
                      ...options.adjustments,
                      brightness: Number(e.target.value)
                    }
                  })
                }
                className="w-full accent-[#00ff7f] h-1 bg-[#222226] cursor-pointer"
              />
            </div>

            {/* Contrast */}
            <div>
              <div className="flex justify-between text-[11px] text-[#ececec]/50 mb-1">
                <span>Contrast</span>
                <span>{options.adjustments.contrast}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={options.adjustments.contrast}
                onChange={(e) =>
                  onChange({
                    ...options,
                    adjustments: {
                      ...options.adjustments,
                      contrast: Number(e.target.value)
                    }
                  })
                }
                className="w-full accent-[#00ff7f] h-1 bg-[#222226] cursor-pointer"
              />
            </div>

            {/* Saturation */}
            <div>
              <div className="flex justify-between text-[11px] text-[#ececec]/50 mb-1">
                <span>Saturation</span>
                <span>{options.adjustments.saturation}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={options.adjustments.saturation}
                onChange={(e) =>
                  onChange({
                    ...options,
                    adjustments: {
                      ...options.adjustments,
                      saturation: Number(e.target.value)
                    }
                  })
                }
                className="w-full accent-[#00ff7f] h-1 bg-[#222226] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Batch sync button if multiple images uploaded */}
      {hasMultipleImages && onApplyToAll && (
        <button
          onClick={onApplyToAll}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-[#00ff7f] text-black font-mono font-bold text-xs uppercase tracking-wider transition hover:bg-[#00e672]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Apply to Queue</span>
        </button>
      )}
    </div>
  );
};
