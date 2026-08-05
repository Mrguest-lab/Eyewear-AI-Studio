import { Preset, SampleImage } from '../types';

export const MARKETPLACE_PRESETS: Preset[] = [
  // Major Indian & Global E-Commerce Marketplaces
  {
    id: 'flipkart-main',
    category: 'ecommerce',
    name: 'Flipkart Product Listing',
    platform: 'Flipkart',
    iconName: 'ShoppingBag',
    description: '1100 x 1100 px (or 2000x2000 px), pure white background (#FFFFFF), zoom enabled',
    recommendedWidth: 1100,
    recommendedHeight: 1100,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 10,
    tips: [
      'Pure white background (#FFFFFF) strictly required for primary search listing.',
      'Minimum resolution 1100 x 1100 px required to activate hover zoom feature.',
      'Product must occupy 80% to 85% of total canvas area.',
      'JPEG format preferred without borders or promotional text.'
    ]
  },
  {
    id: 'myntra-catalog',
    category: 'ecommerce',
    name: 'Myntra Fashion Catalog',
    platform: 'Myntra',
    iconName: 'Shirt',
    description: '1080 x 1440 px (3:4 aspect ratio), crisp studio lighting & clean backdrop',
    recommendedWidth: 1080,
    recommendedHeight: 1440,
    aspectRatioLabel: '3:4 Vertical',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.92,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 5,
    tips: [
      '3:4 vertical ratio specifically required for high-fashion catalog grids.',
      'Clean off-white or pure white background with subtle natural shadow.',
      'Max file size 5MB in JPEG or high quality WebP format.',
      'Product centered with ample margins around shoulders and hem.'
    ]
  },
  {
    id: 'nykaa-beauty',
    category: 'ecommerce',
    name: 'Nykaa Beauty & Cosmetics',
    platform: 'Nykaa',
    iconName: 'Sparkles',
    description: '1080 x 1350 px (4:5 ratio) or 1000x1000 px, pure white background (#FFFFFF)',
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    aspectRatioLabel: '4:5 Vertical',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 8,
    tips: [
      'Pure white backdrop (#FFFFFF) with high detail focus on bottles & packaging.',
      '4:5 vertical display ratio provides maximum visibility on mobile devices.',
      'Ensure high color fidelity for lipstick shades, foundation, and skincare.'
    ]
  },
  {
    id: 'ajio-fashion',
    category: 'ecommerce',
    name: 'Ajio Apparel Listing',
    platform: 'Ajio',
    iconName: 'Tag',
    description: '1080 x 1350 px (4:5 ratio), white background padding for apparel grid',
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    aspectRatioLabel: '4:5 Vertical',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 8,
    tips: [
      'High-resolution 4:5 portrait ratio for apparel and lifestyle products.',
      'White background (#FFFFFF) required for official brand cataloging.',
      'No watermarks, price tags, or text overlays allowed on primary image.'
    ]
  },
  {
    id: 'blinkit-grocery',
    category: 'ecommerce',
    name: 'Blinkit Quick Commerce',
    platform: 'Blinkit',
    iconName: 'Zap',
    description: '1000 x 1000 px square, ultra-compressed WebP/PNG for instant mobile loading',
    recommendedWidth: 1000,
    recommendedHeight: 1000,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/webp',
    defaultQuality: 0.85,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 3,
    tips: [
      '1:1 square canvas optimized for quick commerce 10-minute delivery app grids.',
      'Pure white (#FFFFFF) background or transparent PNG for clean card rendering.',
      'Ensure front-of-pack text, weight, and volume details are clearly visible.'
    ]
  },
  {
    id: 'swiggy-instamart',
    category: 'ecommerce',
    name: 'Swiggy Instamart Catalog',
    platform: 'Instamart',
    iconName: 'Package',
    description: '1000 x 1000 px square, clean white background, high clarity pack view',
    recommendedWidth: 1000,
    recommendedHeight: 1000,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/webp',
    defaultQuality: 0.85,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 2,
    tips: [
      'Square 1000 x 1000 px photo with product filling 85% of frame.',
      'WebP format strongly recommended for ultra-fast mobile feed loading.',
      'Pure white background (#FFFFFF) with zero color tints or background distractions.'
    ]
  },
  {
    id: 'zepto-catalog',
    category: 'ecommerce',
    name: 'Zepto Quick Grocery',
    platform: 'Zepto',
    iconName: 'Zap',
    description: '1000 x 1000 px square, crisp lighting, pure white backdrop',
    recommendedWidth: 1000,
    recommendedHeight: 1000,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/webp',
    defaultQuality: 0.85,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 3,
    tips: [
      '1000x1000 square image optimized for 10-minute grocery discovery.',
      'Pure white canvas padding with sharp focus on packaging branding.',
      'Maintain vivid product saturation and high contrast.'
    ]
  },
  {
    id: 'tata-cliq',
    category: 'ecommerce',
    name: 'Tata CLiQ Luxury & Fashion',
    platform: 'Tata CLiQ',
    iconName: 'ShoppingBag',
    description: '1000 x 1250 px (4:5 ratio), elegant white/neutral backdrop',
    recommendedWidth: 1000,
    recommendedHeight: 1250,
    aspectRatioLabel: '4:5 Vertical',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 8,
    tips: [
      '1000 x 1250 px aspect ratio ideal for luxury goods and electronics.',
      'Pure white background (#FFFFFF) with balanced studio shadows.',
      'JPEG format under 8MB for high-definition zoom support.'
    ]
  },
  {
    id: 'meesho-listing',
    category: 'ecommerce',
    name: 'Meesho Reseller Listing',
    platform: 'Meesho',
    iconName: 'Store',
    description: '1000 x 1000 px square, clean product isolation on white background',
    recommendedWidth: 1000,
    recommendedHeight: 1000,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.88,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 5,
    tips: [
      '1:1 square aspect ratio for optimal social reseller sharing.',
      'Clear white background with single product focus.',
      'High contrast lighting so product details stand out in catalog thumbnails.'
    ]
  },

  // Global E-Commerce Marketplaces
  {
    id: 'amazon-main',
    category: 'ecommerce',
    name: 'Amazon Main Listing',
    platform: 'Amazon',
    iconName: 'ShoppingBag',
    description: '2000 x 2000 px, pure white background (#FFFFFF), zoom enabled',
    recommendedWidth: 2000,
    recommendedHeight: 2000,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 10,
    tips: [
      'Main image must have a pure white background (#FFFFFF).',
      'Product must fill 85% or more of the image frame.',
      'Minimum 1000px required for hover zoom function (2000px recommended for retina display).',
      'Format should be JPEG or PNG without borders or watermark text.'
    ]
  },
  {
    id: 'shopify-product',
    category: 'ecommerce',
    name: 'Shopify Product Photo',
    platform: 'Shopify',
    iconName: 'Store',
    description: '2048 x 2048 px square, optimized WebP/JPG for lightning fast page loads',
    recommendedWidth: 2048,
    recommendedHeight: 2048,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/webp',
    defaultQuality: 0.85,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 20,
    tips: [
      '2048 x 2048 px gives a perfect balance between high-res zoom and fast mobile loading.',
      'WebP format reduces file size by ~30% with no loss in visual quality.',
      'Maintain consistent square aspect ratio across all store products for clean grid alignment.'
    ]
  },
  {
    id: 'etsy-listing',
    category: 'ecommerce',
    name: 'Etsy Item Listing',
    platform: 'Etsy',
    iconName: 'Sparkles',
    description: '2000 x 1500 px (4:3 aspect ratio), vibrant colors and crisp details',
    recommendedWidth: 2000,
    recommendedHeight: 1500,
    aspectRatioLabel: '4:3 Horizontal',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 10,
    tips: [
      'Etsy recommends 2000px on the shortest side for maximum clarity.',
      'First image in listing should be horizontal (4:3 ratio).',
      'Use sRGB color space for best appearance across devices.'
    ]
  },
  {
    id: 'ebay-listing',
    category: 'ecommerce',
    name: 'eBay Product Gallery',
    platform: 'eBay',
    iconName: 'Tag',
    description: '1600 x 1600 px, clean background, 500px minimum zoom threshold',
    recommendedWidth: 1600,
    recommendedHeight: 1600,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.85,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 12,
    tips: [
      'Minimum image size is 500px, but 1600px enables full eBay image magnification.',
      'No added borders, text, or artwork allowed on primary image.',
      'Clean neutral or white background helps listing rank higher.'
    ]
  },
  {
    id: 'walmart-item',
    category: 'ecommerce',
    name: 'Walmart Marketplace',
    platform: 'Walmart',
    iconName: 'Package',
    description: '2000 x 2000 px square with white background padding',
    recommendedWidth: 2000,
    recommendedHeight: 2000,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'contain',
    defaultBgColor: '#FFFFFF',
    maxSizeMB: 5,
    tips: [
      'Seamless white background required for main product card.',
      'Product must occupy 80%+ of total image area.',
      'JPEG format preferred for catalog processing.'
    ]
  },

  // Social Media
  {
    id: 'instagram-square',
    category: 'social',
    name: 'Instagram Feed Square',
    platform: 'Instagram',
    iconName: 'Instagram',
    description: '1080 x 1080 px high density square post',
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.92,
    defaultFitMode: 'cover',
    defaultBgColor: '#000000',
    tips: ['1080 x 1080 px ensures sharp post display in feed and profile grid.']
  },
  {
    id: 'instagram-portrait',
    category: 'social',
    name: 'Instagram Feed Portrait',
    platform: 'Instagram',
    iconName: 'Instagram',
    description: '1080 x 1350 px (4:5 ratio) for maximum screen real estate',
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    aspectRatioLabel: '4:5 Portrait',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.92,
    defaultFitMode: 'cover',
    defaultBgColor: '#000000',
    tips: ['4:5 aspect ratio takes up more screen space in mobile feeds for higher engagement.']
  },
  {
    id: 'instagram-story',
    category: 'social',
    name: 'Instagram Story / Reel',
    platform: 'Instagram',
    iconName: 'Smartphone',
    description: '1080 x 1920 px vertical fullscreen display (9:16)',
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    aspectRatioLabel: '9:16 Vertical',
    recommendedFormat: 'image/jpeg',
    defaultQuality: 0.9,
    defaultFitMode: 'cover',
    defaultBgColor: '#18181b',
    tips: ['Full 9:16 vertical canvas. Use blur backdrop option if image has different aspect ratio.']
  },

  // Web Performance & Icons
  {
    id: 'web-hero',
    category: 'web',
    name: 'Web Hero Banner',
    platform: 'Website',
    iconName: 'Globe',
    description: '1920 x 1080 px Full HD banner, compressed WebP',
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    aspectRatioLabel: '16:9 Widescreen',
    recommendedFormat: 'image/webp',
    defaultQuality: 0.82,
    defaultFitMode: 'cover',
    defaultBgColor: '#FFFFFF',
    tips: ['WebP format keeps 1080p hero banners under 200KB for instant page load speeds.']
  },
  {
    id: 'favicon-bundle',
    category: 'web',
    name: 'App / Website Favicon',
    platform: 'Website',
    iconName: 'Layout',
    description: '512 x 512 px master square for crisp browser icons & web apps',
    recommendedWidth: 512,
    recommendedHeight: 512,
    aspectRatioLabel: '1:1 Square',
    recommendedFormat: 'image/png',
    defaultQuality: 1.0,
    defaultFitMode: 'contain',
    defaultBgColor: 'transparent',
    tips: ['PNG with transparent background. Can be downscaled easily to 32x32 or 16x16.']
  }
];

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-watch',
    name: 'Luxury Watch Product.jpg',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1200&auto=format&fit=crop',
    category: 'E-commerce Product',
    width: 1200,
    height: 800
  },
  {
    id: 'sample-sneakers',
    name: 'Running Shoes Catalog.jpg',
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop',
    category: 'E-commerce Product',
    width: 1200,
    height: 800
  },
  {
    id: 'sample-headphones',
    name: 'Wireless Headphones.jpg',
    url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1200&auto=format&fit=crop',
    category: 'Tech Hardware',
    width: 1200,
    height: 800
  },
  {
    id: 'sample-landscape',
    name: 'Mountain Landscape.jpg',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop',
    category: 'High-Res Photo',
    width: 1600,
    height: 1067
  }
];
