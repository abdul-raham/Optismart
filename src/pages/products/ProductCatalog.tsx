import { useEffect, useState } from 'react'
import { ExternalLink, Package, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'
import { getProductImage } from '@/lib/productImages'

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')

      if (error) throw error
      setProducts((data ?? []) as Product[])
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-surface-900">Product Catalog</h1>
          <p className="mt-1 text-sm text-surface-500">OptiSmart camera products available for sales and reseller orders.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input h-10 w-full pl-9 sm:w-72" placeholder="Search cameras..." />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="glass-card h-72 animate-pulse bg-surface-100/60" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-surface-300" />
          <p className="mt-3 text-sm font-bold text-surface-500">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product, index) => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="glass-card overflow-hidden p-3 md:p-4">
              <div className="rounded-[16px] md:rounded-[22px] bg-[#f7fbfd] p-3 md:p-5">
                <img src={getProductImage(product.name, product.image_url)} alt={product.name} className="h-24 md:h-48 w-full object-contain" />
              </div>
              <div className="p-1 pt-3 md:p-2 md:pt-4">
                <h2 className="text-sm md:text-lg font-black text-surface-900 line-clamp-1">{product.name}</h2>
                <p className="mt-1 md:mt-2 line-clamp-2 text-xs md:text-sm leading-5 md:leading-6 text-surface-500">{product.description}</p>
                <div className="mt-3 md:mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div className="rounded-xl md:rounded-2xl bg-brand-50 p-2 md:p-3">
                    <p className="text-[9px] md:text-[10px] font-black uppercase text-brand-600">Retail</p>
                    <p className="mt-0.5 md:mt-1 font-black text-xs md:text-base text-surface-900">{formatCurrency(product.retail_price)}</p>
                  </div>
                  <div className="hidden md:block rounded-2xl bg-surface-50 p-3">
                    <p className="text-[10px] font-black uppercase text-surface-500">Wholesale</p>
                    <p className="mt-1 font-black text-surface-900">{formatCurrency(product.wholesale_price)}</p>
                  </div>
                </div>
                <div className="mt-3 md:mt-4 flex flex-col md:flex-row md:items-center justify-between border-t border-surface-100 pt-3 md:pt-4 gap-2">
                  <span className={product.stock_quantity <= product.min_stock_level ? 'badge-red text-[9px] md:text-xs' : 'badge-green text-[9px] md:text-xs'}>
                    {product.stock_quantity} in stock
                  </span>
                  {product.source_url && (
                    <a href={product.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-black text-brand-600 hover:text-brand-700">
                      Store <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
