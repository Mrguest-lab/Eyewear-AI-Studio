import type { RGBAImage } from '../../lib/resample';

export type TabId = 'studio' | 'photoshoot' | 'resize' | 'convert' | 'batch' | 'validate' | 'presets' | 'settings';

/** The image currently shared between tabs (e.g. Studio -> Photoshoot -> Studio). */
export interface WorkImage {
  image: RGBAImage;
  name: string;
  sku: string;
  /** 'ai' marks generative output that must not be presented as an exact product photo. */
  origin: 'upload' | 'edited' | 'ai';
  note?: string;
  /** Untouched file from the user or provider, if any. */
  sourceBlob?: Blob;
}

export interface TabProps {
  work: WorkImage | null;
  setWork: (w: WorkImage | null) => void;
  goTo: (tab: TabId) => void;
}
