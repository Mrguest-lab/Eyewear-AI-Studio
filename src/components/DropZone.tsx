import React, { useRef, useState, useEffect } from 'react';
import { Upload, FolderPlus, FileImage, Clipboard, Sparkles } from 'lucide-react';
import { SAMPLE_IMAGES } from '../data/presets';
import { SampleImage } from '../types';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  onSampleSelected: (sample: SampleImage) => void;
  isCompact?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  onSampleSelected,
  isCompact = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Paste from clipboard listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        onFilesSelected(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesSelected]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files).filter((file: File) =>
        file.type.startsWith('image/')
      );
      if (fileList.length > 0) {
        onFilesSelected(fileList);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter((file: File) =>
        file.type.startsWith('image/')
      );
      if (files.length > 0) {
        onFilesSelected(files);
      }
      e.target.value = '';
    }
  };

  if (isCompact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border border-dashed p-4 text-center transition-all cursor-pointer font-mono ${
          isDragOver
            ? 'border-[#00ff7f] bg-[#00ff7f]/10'
            : 'border-[#ececec]/20 hover:border-[#ececec]/40 bg-[#151518]'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center justify-center gap-2">
          <Upload className="w-4 h-4 text-[#00ff7f]" />
          <span className="text-xs text-[#ececec]/80 uppercase tracking-wider font-bold">
            Drop extra images or click to append to workspace
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary Drop Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 cursor-pointer overflow-hidden ${
          isDragOver
            ? 'border-[#00ff7f] bg-[#00ff7f]/5 shadow-2xl'
            : 'border-[#ececec]/20 hover:border-[#ececec]/40 bg-[#151518]'
        }`}
      >
        {/* Hidden inputs for File and Folder */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore - webkitdirectory is standard for folder picker
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="max-w-xl mx-auto space-y-5">
          <div className="mx-auto w-16 h-16 border border-[#00ff7f]/40 bg-[#00ff7f]/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-[#00ff7f]" />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-syne font-extrabold uppercase tracking-tight text-[#ececec]">
              Drop Raw Asset Folders or Files
            </h2>
            <p className="font-mono text-xs text-[#ececec]/60 mt-1.5 uppercase">
              JPG, JPEG, PNG, WEBP, AVIF. 100% Client-Side High-Speed Engine.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 font-mono" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 px-5 py-3 bg-[#00ff7f] hover:bg-[#00e672] text-black font-bold text-xs uppercase tracking-wider transition"
            >
              <FileImage className="w-4 h-4" />
              <span>Select Files</span>
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center space-x-2 px-5 py-3 bg-[#0c0c0e] hover:bg-[#222226] text-[#ececec] font-bold text-xs uppercase tracking-wider border border-[#ececec]/25 transition"
            >
              <FolderPlus className="w-4 h-4 text-[#00ff7f]" />
              <span>Select Bulk Folder</span>
            </button>
          </div>

          {/* Paste notice */}
          <div className="flex items-center justify-center gap-2 font-mono text-[11px] text-[#ececec]/40 pt-1 uppercase">
            <Clipboard className="w-3.5 h-3.5 text-[#00ff7f]" />
            <span>Direct Clipboard paste active (<kbd className="px-1 py-0.5 bg-[#0c0c0e] border border-[#ececec]/20 text-[#ececec]">Ctrl+V</kbd>)</span>
          </div>
        </div>
      </div>

      {/* Instant Sample Image Row */}
      <div className="bg-[#151518] border border-[#ececec]/15 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 font-mono text-xs font-bold text-[#ececec]/70 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-[#00ff7f]" />
            <span>Test drive instant high-res assets:</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SAMPLE_IMAGES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => onSampleSelected(sample)}
              className="group relative flex items-center space-x-3 p-2 bg-[#0c0c0e] border border-[#ececec]/10 hover:border-[#00ff7f] transition text-left overflow-hidden"
            >
              <img
                src={sample.url}
                alt={sample.name}
                className="w-12 h-12 object-cover bg-black flex-shrink-0"
                crossOrigin="anonymous"
              />
              <div className="min-w-0 flex-1 font-mono">
                <p className="text-xs font-bold text-[#ececec] truncate group-hover:text-[#00ff7f] transition-colors">
                  {sample.name}
                </p>
                <p className="text-[9px] text-[#ececec]/50 uppercase truncate mt-0.5">
                  {sample.category}
                </p>
                <p className="text-[9px] text-[#00ff7f] mt-0.5">
                  {sample.width}x{sample.height}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
