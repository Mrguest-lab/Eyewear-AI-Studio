import React, { useState } from 'react';
import {
  Download,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  RefreshCw,
  FolderDown
} from 'lucide-react';
import JSZip from 'jszip';
import { ImageFileItem } from '../types';
import { formatBytes, getExtensionForFormat } from '../utils/imageProcessor';

interface BulkQueueTableProps {
  items: ImageFileItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onProcessAll: () => void;
  onSelectActiveItem: (item: ImageFileItem) => void;
  isProcessingBatch?: boolean;
}

export const BulkQueueTable: React.FC<BulkQueueTableProps> = ({
  items,
  onRemoveItem,
  onClearAll,
  onProcessAll,
  onSelectActiveItem,
  isProcessingBatch = false
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Toggle single item selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Select / Deselect All
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  // Calculate totals
  const totalOriginalBytes = items.reduce((acc, i) => acc + i.originalSize, 0);
  const totalProcessedBytes = items.reduce(
    (acc, i) => acc + (i.processedSize || i.originalSize),
    0
  );
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalProcessedBytes);
  const overallPercentSaved =
    totalOriginalBytes > 0
      ? Math.round((totalSavedBytes / totalOriginalBytes) * 100)
      : 0;

  // Bulk ZIP Download Handler
  const handleDownloadZip = async () => {
    if (items.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder('optimized-images');

      for (const item of items) {
        if (item.processedBlob) {
          const ext = item.processedType
            ? getExtensionForFormat(item.processedType)
            : 'jpg';
          const cleanName =
            item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
          const fileName = `${cleanName}-optimized.${ext}`;
          folder?.file(fileName, item.processedBlob);
        }
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipContent);

      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `resizer-optimized-bundle-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error('ZIP export error:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Download individual file
  const handleDownloadSingle = (item: ImageFileItem) => {
    if (!item.processedUrl) return;
    const ext = item.processedType
      ? getExtensionForFormat(item.processedType)
      : 'jpg';
    const cleanName =
      item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
    const fileName = `${cleanName}-optimized.${ext}`;

    const link = document.createElement('a');
    link.href = item.processedUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#151518] border border-[#ececec]/15 p-5 space-y-5 shadow-2xl">
      {/* Queue Header & Total Savings Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#ececec]/10">
        <div className="flex items-center space-x-3 font-mono">
          <div className="p-2 bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#ececec] uppercase">
              Bulk Queue ({items.length} Files)
            </h3>
            <p className="text-[10px] text-[#ececec]/50 mt-0.5">
              Original: {formatBytes(totalOriginalBytes)} → Optimized: {formatBytes(totalProcessedBytes)}
            </p>
          </div>
        </div>

        {totalSavedBytes > 0 && (
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f] text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#00ff7f]" />
            <span>Saved {formatBytes(totalSavedBytes)} ({overallPercentSaved}% smaller)</span>
          </div>
        )}

        {/* Global Batch Action Buttons */}
        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={onProcessAll}
            disabled={isProcessingBatch}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#0c0c0e] hover:bg-[#222226] text-[#ececec] text-xs uppercase border border-[#ececec]/20 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessingBatch ? 'animate-spin' : ''}`} />
            <span>Re-process All</span>
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping || items.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-[#00ff7f] hover:bg-[#00e672] text-black text-xs font-bold uppercase tracking-wider transition disabled:opacity-50"
          >
            <FolderDown className="w-4 h-4" />
            <span>{isZipping ? 'Zipping...' : 'Download Bundle (ZIP)'}</span>
          </button>

          <button
            onClick={onClearAll}
            className="p-2 bg-[#0c0c0e] hover:bg-rose-500/20 text-[#ececec]/60 hover:text-rose-400 border border-[#ececec]/20 transition"
            title="Clear Queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Select All / Batch Control Row */}
      <div className="flex items-center justify-between font-mono text-xs text-[#ececec]/60">
        <button
          onClick={toggleSelectAll}
          className="flex items-center space-x-2 hover:text-[#ececec] transition"
        >
          {selectedIds.size === items.length && items.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-[#00ff7f]" />
          ) : (
            <Square className="w-4 h-4 text-[#ececec]/40" />
          )}
          <span>
            Select All ({selectedIds.size}/{items.length})
          </span>
        </button>

        {selectedIds.size > 0 && (
          <button
            onClick={() => {
              selectedIds.forEach((id) => onRemoveItem(id));
              setSelectedIds(new Set());
            }}
            className="text-rose-400 hover:underline font-bold"
          >
            Remove Selected ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Queue Items List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {items.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const origSize = item.originalSize;
          const procSize = item.processedSize || origSize;
          const bytesSaved = Math.max(0, origSize - procSize);
          const percentSaved =
            origSize > 0 ? Math.round((bytesSaved / origSize) * 100) : 0;

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 border transition-all ${
                isSelected
                  ? 'bg-[#00ff7f]/10 border-[#00ff7f]'
                  : 'bg-[#0c0c0e] border-[#ececec]/10 hover:border-[#ececec]/30'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <button
                  onClick={() => toggleSelect(item.id)}
                  className="text-[#ececec]/40 hover:text-[#00ff7f]"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#00ff7f]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>

                <img
                  src={item.processedUrl || item.previewUrl}
                  alt={item.name}
                  className="w-12 h-12 object-cover bg-black border border-[#ececec]/15 flex-shrink-0 cursor-pointer"
                  onClick={() => onSelectActiveItem(item)}
                />

                <div className="min-w-0 flex-1 cursor-pointer font-mono" onClick={() => onSelectActiveItem(item)}>
                  <p className="text-xs font-bold text-[#ececec] truncate hover:text-[#00ff7f]">
                    {item.name}
                  </p>
                  <div className="flex items-center space-x-3 text-[10px] text-[#ececec]/50 mt-0.5">
                    <span>
                      {item.processedWidth || item.originalWidth}x
                      {item.processedHeight || item.originalHeight} px
                    </span>
                    <span>•</span>
                    <span className="text-[#00ff7f] font-bold">
                      {formatBytes(procSize)}
                    </span>
                    {percentSaved > 0 && (
                      <span className="text-[#00ff7f] font-bold">
                        (-{percentSaved}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 ml-3">
                <button
                  onClick={() => handleDownloadSingle(item)}
                  disabled={!item.processedUrl}
                  className="p-2 bg-[#151518] hover:bg-[#00ff7f] hover:text-black text-[#ececec] transition border border-[#ececec]/20"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-2 bg-[#151518] hover:bg-rose-500/20 text-[#ececec]/50 hover:text-rose-400 transition border border-[#ececec]/20"
                  title="Remove from Queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
