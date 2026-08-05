import React, { useState } from 'react';
import { X, Github, Copy, Check, Globe, Code, ShieldCheck, Heart } from 'lucide-react';

interface GitHubShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubShareModal: React.FC<GitHubShareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const embedCode = `<iframe src="${window.location.origin}" width="100%" height="700" frameborder="0" allow="clipboard-write"></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-[#1A1A1C] border border-[#2D2D30] rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8 text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2D2D30] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#252528] border border-[#35353A] text-zinc-100">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">
                Public GitHub & Open Source Details
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Client-side web application ready for public GitHub deployment & hosting.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-[#252528] hover:bg-[#323236] text-zinc-400 hover:text-zinc-200 transition border border-[#35353A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Cards */}
        <div className="space-y-4">
          <div className="bg-[#0A0A0B]/70 border border-[#2D2D30] p-4 rounded-2xl space-y-2">
            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              100% Client-Side Canvas Engine
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              All image decoding, resizing, format conversion (WebP, JPG, PNG, AVIF), color adjustments, and ZIP archiving are executed entirely within the user's browser canvas. Zero server bandwidth or backend dependencies required.
            </p>
          </div>

          {/* Key Features */}
          <div className="bg-[#0A0A0B]/70 border border-[#2D2D30] p-4 rounded-2xl space-y-2">
            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              Supported Platforms & Presets
            </h3>
            <ul className="text-xs text-zinc-300 space-y-1 font-mono">
              <li>✓ Indian Marketplaces: Flipkart, Myntra, Nykaa, Ajio, Blinkit, Instamart, Zepto</li>
              <li>✓ Global Marketplaces: Amazon, Shopify, Etsy, eBay, Walmart, Tata CLiQ, Meesho</li>
              <li>✓ Single & Bulk Folder Drag-and-Drop Image Uploads</li>
              <li>✓ Web Performance Formats: WebP, JPEG, PNG, AVIF</li>
              <li>✓ Interactive Before/After Split Comparison Slider</li>
              <li>✓ Batch ZIP Export with JSZip</li>
            </ul>
          </div>

          {/* Embed Code Snippet */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Code className="w-4 h-4 text-indigo-400" />
              Embed HTML Code
            </label>
            <div className="relative bg-[#0A0A0B] border border-[#2D2D30] rounded-2xl p-3 font-mono text-xs text-indigo-300 break-all pr-12">
              {embedCode}
              <button
                onClick={handleCopy}
                className="absolute right-2 top-2 p-1.5 rounded-xl bg-[#252528] hover:bg-[#323236] text-zinc-300 transition border border-[#35353A]"
                title="Copy Embed Code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
            <span>React 19 + Vite + TypeScript + Tailwind v4</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition hover:scale-105"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
