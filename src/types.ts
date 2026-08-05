export type ResizeFitMode = 'contain' | 'cover' | 'stretch' | 'percentage' | 'maxBounds';

export type OutputFormat = 'image/webp' | 'image/jpeg' | 'image/png' | 'image/avif';

export interface ImageAdjustments {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  blur: number; // 0 to 20
  rotate: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  backgroundColor: string; // hex code or 'transparent'
}

export interface ResizeOptions {
  width: number;
  height: number;
  lockAspectRatio: boolean;
  fitMode: ResizeFitMode;
  scalePercent: number;
  format: OutputFormat;
  quality: number; // 0.01 to 1.0
  maxFileSizeBytes?: number; // optional target max file size in bytes
  stripMetadata: boolean;
  adjustments: ImageAdjustments;
}

export interface ImageFileItem {
  id: string;
  file: File;
  name: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  originalType: string;
  previewUrl: string;
  aspectRatio: number;
  
  // Custom per-item options (or inherits global options)
  customOptions?: Partial<ResizeOptions>;
  
  // Processed Output
  processedUrl?: string;
  processedBlob?: Blob;
  processedWidth?: number;
  processedHeight?: number;
  processedSize?: number;
  processedType?: OutputFormat;
  isProcessing?: boolean;
  error?: string;
}

export interface Preset {
  id: string;
  category: 'ecommerce' | 'social' | 'web' | 'custom';
  name: string;
  platform: string;
  iconName: string;
  description: string;
  recommendedWidth: number;
  recommendedHeight: number;
  aspectRatioLabel: string;
  recommendedFormat: OutputFormat;
  defaultQuality: number;
  defaultFitMode: ResizeFitMode;
  defaultBgColor: string;
  maxSizeMB?: number;
  tips: string[];
}

export interface SampleImage {
  id: string;
  name: string;
  url: string;
  category: string;
  width: number;
  height: number;
}
