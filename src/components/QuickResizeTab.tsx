import React, { useState, useEffect, useCallback } from 'react';
import { DropZone } from './DropZone';
import { ControlPanel } from './ControlPanel';
import { SingleImageEditor } from './SingleImageEditor';
import { BulkQueueTable } from './BulkQueueTable';
import { MarketplaceGuideModal } from './MarketplaceGuideModal';
import type { ImageFileItem, Preset, ResizeOptions, SampleImage } from '../types';
import { processImage, loadImage, getExtensionForFormat } from '../utils/imageProcessor';
import { Image as ImageIcon, Layers, Sliders, BookOpen } from 'lucide-react';

/** The original ResizerHub single/bulk resizer, kept as the "Quick Resize" tab. */
export function QuickResizeTab() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [items, setItems] = useState<ImageFileItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modals state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Global default resize configuration (Defaults to Shopify Product 2048x2048 WebP)
  const [options, setOptions] = useState<ResizeOptions>({
    width: 2048,
    height: 2048,
    lockAspectRatio: true,
    fitMode: 'contain',
    scalePercent: 100,
    format: 'image/webp',
    quality: 0.85,
    stripMetadata: true,
    adjustments: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      rotate: 0,
      flipH: false,
      flipV: false,
      backgroundColor: '#FFFFFF'
    }
  });

  const activeItem = items.find((i) => i.id === activeItemId) || items[0] || null;

  // Process a single image item with current options
  const processSingleItem = useCallback(
    async (item: ImageFileItem, customOptions?: ResizeOptions): Promise<ImageFileItem> => {
      const opts = customOptions || options;
      try {
        const result = await processImage(item.file, opts);
        return {
          ...item,
          processedUrl: result.url,
          processedBlob: result.blob,
          processedWidth: result.width,
          processedHeight: result.height,
          processedSize: result.size,
          processedType: result.format,
          isProcessing: false
        };
      } catch (err: any) {
        console.error('Processing error:', err);
        return {
          ...item,
          error: err.message || 'Failed to process image',
          isProcessing: false
        };
      }
    },
    [options]
  );

  // Re-process active item or all items when options change
  useEffect(() => {
    if (items.length === 0) return;

    let isMounted = true;
    setIsProcessing(true);

    const runProcessing = async () => {
      if (mode === 'single' && activeItem) {
        const updated = await processSingleItem(activeItem);
        if (isMounted) {
          setItems((prev) =>
            prev.map((i) => (i.id === updated.id ? updated : i))
          );
          setIsProcessing(false);
        }
      } else {
        // Bulk mode re-process all
        const updatedList = await Promise.all(
          items.map((item) => processSingleItem(item))
        );
        if (isMounted) {
          setItems(updatedList);
          setIsProcessing(false);
        }
      }
    };

    const timer = setTimeout(runProcessing, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [options, activeItemId, mode]);

  // Handle uploaded files
  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);

    const newItems: ImageFileItem[] = [];

    for (const file of files) {
      try {
        const img = await loadImage(file);
        const item: ImageFileItem = {
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          originalWidth: img.naturalWidth || img.width,
          originalHeight: img.naturalHeight || img.height,
          originalSize: file.size,
          originalType: file.type,
          previewUrl: URL.createObjectURL(file),
          aspectRatio: (img.naturalWidth || img.width) / (img.naturalHeight || img.height)
        };

        const processed = await processSingleItem(item);
        newItems.push(processed);
      } catch (err) {
        console.error('Error loading image file:', err);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      if (!activeItemId) {
        setActiveItemId(newItems[0].id);
      }
      if (files.length > 1 && mode === 'single') {
        setMode('bulk');
      }
    }

    setIsProcessing(false);
  };

  // Handle sample image click
  const handleSampleSelected = async (sample: SampleImage) => {
    setIsProcessing(true);
    try {
      const response = await fetch(sample.url);
      const blob = await response.blob();
      const file = new File([blob], sample.name, { type: blob.type || 'image/jpeg' });
      await handleFilesSelected([file]);
    } catch (err) {
      console.error('Failed to load sample image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove single item from queue
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeItemId === id) {
      const remaining = items.filter((i) => i.id !== id);
      setActiveItemId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Clear all items
  const handleClearAll = () => {
    items.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      if (i.processedUrl) URL.revokeObjectURL(i.processedUrl);
    });
    setItems([]);
    setActiveItemId(null);
  };

  // Download active item
  const handleDownloadActive = () => {
    if (!activeItem || !activeItem.processedUrl) return;
    const ext = activeItem.processedType
      ? getExtensionForFormat(activeItem.processedType)
      : 'jpg';
    const cleanName =
      activeItem.name.substring(0, activeItem.name.lastIndexOf('.')) || activeItem.name;
    const fileName = `${cleanName}-optimized.${ext}`;

    const link = document.createElement('a');
    link.href = activeItem.processedUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Select Preset from Modal
  const handleSelectPresetFromGuide = (preset: Preset) => {
    setOptions({
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

  // Calculate total saved bytes across all items
  const totalOriginal = items.reduce((acc, i) => acc + i.originalSize, 0);
  const totalProcessed = items.reduce((acc, i) => acc + (i.processedSize || i.originalSize), 0);
  const totalSavedBytes = Math.max(0, totalOriginal - totalProcessed);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center bg-[#151518] p-1 border border-[#ececec]/15">
          {([
            { id: 'single', label: 'Single editor', icon: <Sliders className="w-3.5 h-3.5" /> },
            { id: 'bulk', label: 'Bulk queue', icon: <Layers className="w-3.5 h-3.5" /> }
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase ${
                mode === m.id ? 'bg-[#00ff7f] text-black' : 'text-[#ececec]/60 hover:text-[#ececec]'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          {totalSavedBytes > 0 && <span className="text-[#00ff7f]">{(totalSavedBytes / 1048576).toFixed(1)} MB saved</span>}
          <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#ececec]/20 hover:bg-[#222226]">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Quick preset specs
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Upload Drop Zone if no images OR as compact dropzone header */}
        {items.length === 0 ? (
          <DropZone
            onFilesSelected={handleFilesSelected}
            onSampleSelected={handleSampleSelected}
          />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151518] border border-[#ececec]/15 p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f]">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-mono font-bold text-[#ececec] uppercase tracking-wider">
                  {items.length} {items.length === 1 ? 'Asset' : 'Assets'} Active in Workspace
                </h2>
                <p className="font-mono text-[11px] text-[#ececec]/50 mt-0.5">
                  Select marketplace presets or customize canvas geometry below.
                </p>
              </div>
            </div>

            <DropZone
              onFilesSelected={handleFilesSelected}
              onSampleSelected={handleSampleSelected}
              isCompact
            />
          </div>
        )}

        {/* Main Bento Work Area: Control Panel + Single Editor or Bulk Queue */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Control Panel Bento Panel (4 cols on lg screens) */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-24">
              <ControlPanel
                options={options}
                onChange={setOptions}
                originalWidth={activeItem?.originalWidth}
                originalHeight={activeItem?.originalHeight}
                hasMultipleImages={items.length > 1}
                onApplyToAll={() => {
                  // Re-triggers batch process
                  setOptions({ ...options });
                }}
              />
            </div>

            {/* Right Display Bento Panel (7 or 8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              {mode === 'single' && activeItem ? (
                <SingleImageEditor
                  item={activeItem}
                  onProcess={() => processSingleItem(activeItem)}
                  onDownload={handleDownloadActive}
                  isProcessing={isProcessing}
                />
              ) : (
                <BulkQueueTable
                  items={items}
                  onRemoveItem={handleRemoveItem}
                  onClearAll={handleClearAll}
                  onProcessAll={() => setOptions({ ...options })}
                  onSelectActiveItem={(item) => {
                    setActiveItemId(item.id);
                    setMode('single');
                  }}
                  isProcessingBatch={isProcessing}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <MarketplaceGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onSelectPreset={handleSelectPresetFromGuide}
      />
    </div>
  );
}
