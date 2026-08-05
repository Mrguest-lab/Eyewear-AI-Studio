import React, { useState, useRef } from 'react';
import { Download, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { ImageFileItem } from '../types';
import { formatBytes, getExtensionForFormat } from '../utils/imageProcessor';

interface SingleImageEditorProps {
  item: ImageFileItem;
  onProcess: () => void;
  onDownload: () => void;
  isProcessing?: boolean;
}

export const SingleImageEditor: React.FC<SingleImageEditorProps> = ({
  item,
  onProcess,
  onDownload,
  isProcessing = false
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  // Calculate savings
  const origSize = item.originalSize;
  const procSize = item.processedSize || origSize;
  const bytesSaved = Math.max(0, origSize - procSize);
  const percentSaved =
    origSize > 0 ? Math.round((bytesSaved / origSize) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 1. Comparison & Processing Stats Bar */}
      <div className="bg-[#151518] border border-[#ececec]/15 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
          <div>
            <span className="text-[#ececec]/40 block text-[9px] uppercase tracking-wider">
              Original [01]
            </span>
            <span className="font-bold text-[#ececec]">
              {item.originalWidth}x{item.originalHeight} px
            </span>
            <span className="text-[#ececec]/50 ml-1">({formatBytes(origSize)})</span>
          </div>

          <ArrowRight className="w-4 h-4 text-[#ececec]/30 hidden sm:block" />

          <div>
            <span className="text-[#ececec]/40 block text-[9px] uppercase tracking-wider">
              Output [02]
            </span>
            <span className="font-bold text-[#00ff7f]">
              {item.processedWidth || item.originalWidth}x
              {item.processedHeight || item.originalHeight} px
            </span>
            <span className="text-[#00ff7f] font-bold ml-1">
              ({formatBytes(procSize)})
            </span>
          </div>

          {percentSaved > 0 && (
            <div className="px-2 py-0.5 bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f] font-mono text-[10px] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#00ff7f]" />
              <span>{percentSaved}% SMALLER</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={onProcess}
            disabled={isProcessing}
            className="px-3 py-2 bg-[#0c0c0e] hover:bg-[#222226] text-[#ececec] text-xs uppercase border border-[#ececec]/20 transition flex items-center gap-1.5 disabled:opacity-50"
            title="Re-process Image"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Update Preview</span>
          </button>

          <button
            onClick={onDownload}
            disabled={isProcessing || !item.processedUrl}
            className="px-5 py-2 bg-[#00ff7f] hover:bg-[#00e672] text-black text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download Final</span>
          </button>
        </div>
      </div>

      {/* 2. Before / After Interactive Split Canvas Slider */}
      <div className="relative bg-[#0c0c0e] border border-[#ececec]/25 min-h-[400px] flex items-center justify-center overflow-hidden shadow-2xl group select-none bg-[radial-gradient(rgba(236,236,236,0.1)_1px,transparent_1px)] [background-size:32px_32px]">
        {isProcessing && (
          <div className="absolute inset-0 bg-[#0c0c0e]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-3 font-mono">
            <RefreshCw className="w-8 h-8 text-[#00ff7f] animate-spin" />
            <p className="text-xs font-bold text-[#ececec]">Rendering pixel output...</p>
          </div>
        )}

        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="relative w-full h-[500px] sm:h-[580px] overflow-hidden cursor-ew-resize flex items-center justify-center"
        >
          {/* Processed (After) Image - Full width underneath */}
          <img
            src={item.processedUrl || item.previewUrl}
            alt="Processed Output"
            className="absolute max-w-full max-h-full object-contain pointer-events-none p-4"
          />

          {/* Original (Before) Image - Clipped on top */}
          <div
            className="absolute top-0 left-0 bottom-0 overflow-hidden flex items-center justify-center border-r border-[#00ff7f] shadow-2xl"
            style={{ width: `${sliderPosition}%` }}
          >
            <img
              src={item.previewUrl}
              alt="Original"
              className="max-w-none h-full object-contain pointer-events-none p-4"
              style={{
                width: containerRef.current
                  ? `${containerRef.current.clientWidth}px`
                  : '100%'
              }}
            />
          </div>

          {/* Divider Drag Line & Handle */}
          <div
            className="absolute top-0 bottom-0 w-[1px] bg-[#00ff7f] pointer-events-none z-10"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 bg-black border border-[#00ff7f] text-[#00ff7f] font-mono text-[10px] font-bold flex items-center justify-center pointer-events-auto cursor-ew-resize hover:scale-105 transition-transform">
              SCAN
            </div>
          </div>

          {/* Badges Overlay */}
          <div className="absolute top-4 left-4 px-2.5 py-1 bg-black/80 border border-[#ececec]/20 font-mono text-[10px] text-[#ececec] pointer-events-none uppercase">
            Before [01]
          </div>
          <div className="absolute top-4 right-4 px-2.5 py-1 bg-black/80 border border-[#00ff7f]/40 font-mono text-[10px] text-[#00ff7f] pointer-events-none uppercase">
            After [02]
          </div>
        </div>
      </div>

      {/* Slider Hint */}
      <p className="text-center font-mono text-[10px] text-[#ececec]/50 uppercase tracking-widest">
        Compare pixel output density by sliding the center handle
      </p>
    </div>
  );
};
