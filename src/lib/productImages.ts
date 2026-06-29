export const productImageFallbacks: Record<string, string> = {
  'smart indoor cctv camera': '/products/wifi_indoor_3mp.jpg',
  '4g solar ptz camera': '/products/solar_ptz_ext.jpg',
  'dual lens bulb cctv camera': '/products/bulb_dual_lens.jpg',
  '4g bulb indoor cctv camera': '/products/bulb_4g_indoor.jpg',
  'indoor 4g dual lens cctv camera': '/products/desktop_4g_dual.jpg',
  'mini cctv camera': '/products/wifi_indoor_3mp.jpg',
}

export function getProductImage(name: string, imageUrl?: string | null) {
  if (imageUrl && !imageUrl.endsWith('.svg')) return imageUrl
  
  const lowerName = name.toLowerCase()
  if (lowerName.includes('solar') || lowerName.includes('ptz')) return '/products/solar_ptz_ext.jpg'
  if (lowerName.includes('dual') && lowerName.includes('bulb')) return '/products/bulb_dual_lens.jpg'
  if (lowerName.includes('bulb')) return '/products/bulb_4g_indoor.jpg'
  if (lowerName.includes('desktop') || (lowerName.includes('dual') && lowerName.includes('4g'))) return '/products/desktop_4g_dual.jpg'
  if (lowerName.includes('indoor') || lowerName.includes('mini')) return '/products/wifi_indoor_3mp.jpg'
  
  const shortName = name.split(' ').slice(0,2).join(' ')
  return productImageFallbacks[lowerName] || imageUrl || '/products/wifi_indoor_3mp.jpg'
}
