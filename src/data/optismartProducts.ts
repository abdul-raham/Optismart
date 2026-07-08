export interface OptismartCatalogProduct {
  name: string
  description: string
  retail_price: number
  wholesale_price: number
  stock_quantity: number
  min_stock_level: number
  image_url: string
  specs: string[]
  source_url: string
}

export const optismartCatalogProducts: OptismartCatalogProduct[] = [
  {
    name: 'Smart Indoor CCTV Camera',
    description: '3MP HD IP indoor camera with wide-angle coverage, 355-degree pan, 90-degree tilt, and remote monitoring for homes and offices.',
    retail_price: 45000,
    wholesale_price: 39000,
    stock_quantity: 30,
    min_stock_level: 8,
    image_url: '/products/wifi_indoor_3mp.jpg',
    specs: ['3MP HD', '355 pan', '90 tilt'],
    source_url: 'https://optismart.com.ng/smart-indoor-cctv-camera/',
  },
  {
    name: '4G Solar PTZ Camera',
    description: 'Solar-powered 4G PTZ surveillance camera built for round-the-clock outdoor monitoring with infrared night vision.',
    retail_price: 185000,
    wholesale_price: 165000,
    stock_quantity: 18,
    min_stock_level: 5,
    image_url: '/products/solar_ptz_ext.jpg',
    specs: ['4G LTE', 'Solar power', 'PTZ view'],
    source_url: 'https://optismart.com.ng/4g-solar-ptz-camera/',
  },
  {
    name: 'Dual Lens Bulb CCTV Camera',
    description: 'Bulb-style CCTV camera with dual-lens wide-angle coverage, HD video quality, and 360-degree indoor/outdoor monitoring.',
    retail_price: 38000,
    wholesale_price: 32000,
    stock_quantity: 40,
    min_stock_level: 10,
    image_url: '/products/bulb_dual_lens.jpg',
    specs: ['Dual lens', 'Bulb form', '360 view'],
    source_url: 'https://optismart.com.ng/product/dual-lens-bulb-cctv-camera/',
  },
  {
    name: '4G Bulb Indoor CCTV Camera',
    description: 'Indoor bulb CCTV camera with 4G connectivity, panoramic 360-degree coverage, HD video, and motion alerts for non-Wi-Fi locations.',
    retail_price: 52000,
    wholesale_price: 45000,
    stock_quantity: 24,
    min_stock_level: 8,
    image_url: '/products/bulb_4g_indoor.jpg',
    specs: ['4G ready', 'Indoor bulb', 'Motion alerts'],
    source_url: 'https://optismart.com.ng/product/4g-bulb-indoor-cctv-camera/',
  },
  {
    name: 'Indoor 4G Dual Lens CCTV Camera',
    description: 'Indoor 4G dual-lens CCTV camera with 1080p HD video quality, motion detection alerts, and infrared night vision.',
    retail_price: 75000,
    wholesale_price: 65000,
    stock_quantity: 20,
    min_stock_level: 6,
    image_url: '/products/desktop_4g_dual.jpg',
    specs: ['4G ready', 'Dual lens', 'Night vision'],
    source_url: 'https://optismart.com.ng/product/indoor-4g-dual-lenz-cctv-camera/',
  },
  {
    name: 'Mini CCTV Camera',
    description: 'Compact mini CCTV camera with a 150-degree ultra-wide-angle lens for discreet room coverage and reduced blind spots.',
    retail_price: 30000,
    wholesale_price: 25000,
    stock_quantity: 35,
    min_stock_level: 10,
    image_url: '/products/wifi_indoor_3mp.jpg',
    specs: ['Mini body', '150 wide angle', 'Discreet'],
    source_url: 'https://optismart.com.ng/mini-cctv-camera/',
  },
  {
    name: 'AI Solar Street Light Camera',
    description: 'AI-powered Solar Street Light with built-in CCTV Camera. Provides illumination and surveillance in one setup.',
    retail_price: 140000,
    wholesale_price: 130000,
    stock_quantity: 20,
    min_stock_level: 5,
    image_url: '/products/Removed B Ai Solar Street Light Camera _140K.jfif',
    specs: ['Solar Powered', 'AI Detection', 'Street Light'],
    source_url: 'https://optismart.com.ng/',
  },
  {
    name: 'Double Lens Camera',
    description: 'Dual lens security camera providing enhanced monitoring coverage and crystal clear video quality.',
    retail_price: 75000,
    wholesale_price: 65000,
    stock_quantity: 30,
    min_stock_level: 5,
    image_url: '/products/Removed BG Double Lens Camera _75K.jfif',
    specs: ['Double Lens', 'HD Video', 'Wide Angle'],
    source_url: 'https://optismart.com.ng/',
  },
  {
    name: 'Triple Lens Camera',
    description: 'Advanced Triple Lens camera for panoramic and targeted zooming surveillance without blind spots.',
    retail_price: 100000,
    wholesale_price: 85000,
    stock_quantity: 25,
    min_stock_level: 5,
    image_url: '/products/removd BG Tripple lens camera _100K.jfif',
    specs: ['Triple Lens', 'Panoramic', 'Zoom'],
    source_url: 'https://optismart.com.ng/',
  },
  {
    name: 'Four Lens Camera',
    description: 'Ultimate security solution featuring Four Lenses for multi-directional comprehensive monitoring.',
    retail_price: 150000,
    wholesale_price: 135000,
    stock_quantity: 15,
    min_stock_level: 3,
    image_url: '/products/Removed BG Four lens Camera _150K.jfif',
    specs: ['Four Lenses', 'Multi-directional', 'Premium'],
    source_url: 'https://optismart.com.ng/',
  },
]
