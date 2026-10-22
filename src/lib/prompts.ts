// Prompt builders for reference-image-conditioned generation (model photoshoots,
// AI product angles, relighting). The uploaded sunglasses photo is always sent as
// the reference image; the text asks the model to keep the product unchanged.
// Generative models can still alter small details: the UI says so before generating.

export type ShotType =
  | 'front'
  | 'three-quarter'
  | 'profile'
  | 'closeup'
  | 'lifestyle'
  | 'campaign'
  | 'studio'
  | 'ecommerce';

export const SHOT_TYPES: { id: ShotType; label: string; text: string }[] = [
  { id: 'front', label: 'Front-facing model shot', text: 'front-facing head-and-shoulders portrait, face looking straight into the camera' },
  { id: 'three-quarter', label: '45° face angle', text: 'three-quarter view portrait with the face turned 45 degrees from the camera' },
  { id: 'profile', label: 'Side profile', text: 'clean side-profile portrait showing the full temple arm from hinge to ear' },
  { id: 'closeup', label: 'Close-up of sunglasses', text: 'tight close-up of the eyes and sunglasses, frame filling most of the image' },
  { id: 'lifestyle', label: 'Lifestyle / outdoor', text: 'natural outdoor lifestyle photograph, candid moment, shallow depth of field' },
  { id: 'campaign', label: 'Premium fashion campaign', text: 'premium fashion campaign editorial photograph, magazine quality' },
  { id: 'studio', label: 'Studio photoshoot', text: 'professional studio portrait with a seamless backdrop' },
  { id: 'ecommerce', label: 'Marketplace listing photo', text: 'clean e-commerce catalog model photo, plain light-grey or white seamless background, centered, even lighting' }
];

export type Preservation = 'strict' | 'balanced' | 'creative';

export const PRESERVATION_LEVELS: { id: Preservation; label: string; help: string }[] = [
  { id: 'strict', label: 'Strict product preservation', help: 'Maximum emphasis on keeping frame, lenses and logo identical. Less creative freedom.' },
  { id: 'balanced', label: 'Balanced', help: 'Keeps the product design while allowing natural lighting and reflections.' },
  { id: 'creative', label: 'Creative', help: 'More freedom for mood and styling. Highest risk of product changes.' }
];

export interface PhotoshootOptions {
  gender: 'female' | 'male';
  ageRange: string;
  appearance: string;
  shot: ShotType;
  pose: string;
  outfit: string;
  lighting: string;
  background: string;
  preservation: Preservation;
  extra?: string;
}

export const DEFAULT_PHOTOSHOOT: PhotoshootOptions = {
  gender: 'female',
  ageRange: '25-35',
  appearance: 'Indian',
  shot: 'front',
  pose: 'relaxed, confident posture, chin slightly raised',
  outfit: 'minimal neutral-toned smart casual outfit',
  lighting: 'soft diffused key light with gentle fill',
  background: 'plain light-grey seamless studio background',
  preservation: 'strict'
};

const PRODUCT_LOCK: Record<Preservation, string> = {
  strict:
    'The sunglasses in the reference image are the exact product being sold. Reproduce them EXACTLY: identical frame shape and geometry, frame thickness and proportions, frame colour and finish, lens shape, lens tint and transparency, hinges, temple arms, nose pads, and every logo, brand name or printed marking in the same position. Do not redesign, restyle, recolour, simplify or add any element to the sunglasses.',
  balanced:
    'Keep the sunglasses from the reference image faithful to the original design: same frame shape, colours, lens tint, temples and logo placement. Natural lighting and reflections are allowed.',
  creative:
    'Use the sunglasses from the reference image as the featured product, keeping their overall design, colours and lens tint recognisable.'
};

const QUALITY_RULES =
  'Photorealistic, high resolution, natural skin texture with visible pores (no plastic or airbrushed skin), anatomically correct face with exactly two eyes, two ears and one nose. The sunglasses sit correctly on the nose bridge and both temple arms rest over the ears, symmetrical lenses, correct scale relative to the face, sharp in-focus frame and legible logo, realistic lens reflections, no floating or duplicated eyewear. No text, captions, watermarks, logos other than the product\'s own, borders or badges.';

export function buildPhotoshootPrompt(o: PhotoshootOptions): string {
  const shot = SHOT_TYPES.find((s) => s.id === o.shot) ?? SHOT_TYPES[0];
  const person = `an adult ${o.gender === 'female' ? 'woman' : 'man'}${o.ageRange ? ` aged ${o.ageRange}` : ''}${
    o.appearance ? `, ${o.appearance} appearance` : ''
  }`;
  return [
    `Create a ${shot.text} of ${person} wearing the sunglasses shown in the reference image.`,
    PRODUCT_LOCK[o.preservation],
    o.pose ? `Pose: ${o.pose}.` : '',
    o.outfit ? `Outfit: ${o.outfit}.` : '',
    o.lighting ? `Lighting: ${o.lighting}.` : '',
    o.background ? `Background: ${o.background}.` : '',
    QUALITY_RULES,
    o.extra?.trim() ? `Additional direction: ${o.extra.trim()}` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

export type ProductView = 'front' | 'side' | 'three-quarter';

export function buildProductViewPrompt(view: ProductView): string {
  const viewText: Record<ProductView, string> = {
    front: 'a straight front view',
    side: 'a clean side view showing the full temple arm',
    'three-quarter': 'a 45-degree three-quarter view'
  };
  return [
    `Render the exact sunglasses from the reference image as ${viewText[view]} product photograph on a pure white (#FFFFFF) background with soft studio lighting and a subtle natural contact shadow.`,
    PRODUCT_LOCK.strict,
    'Where a part of the product is not visible in the reference, keep it plain and consistent with the visible design rather than inventing new details.',
    'No props, no text, no watermark, no border.'
  ].join(' ');
}

export function buildRelightPrompt(): string {
  return [
    'Re-light this product photograph as a professional e-commerce studio shot: pure white (#FFFFFF) seamless background, soft even studio lighting, a subtle natural contact shadow beneath the product, clean highlights on the frame.',
    PRODUCT_LOCK.strict,
    'Keep the same camera angle and framing. No text, no watermark, no border.'
  ].join(' ');
}
