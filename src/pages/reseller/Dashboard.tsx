import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Package, ShoppingCart, Search, TrendingUp, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'
import type { Product } from '@/types'

export function ResellerDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      if (data) setProducts(data)
    } catch (err) {
      console.error('Error fetching reseller products:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkOrder = () => {
    alert('Bulk ordering system will open a checkout modal here.')
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Wholesale Portal</h1>
          <p className="text-sm text-surface-500 mt-1">Access bulk pricing tiers and place large inventory orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search catalog..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-64 transition-all"
            />
          </div>
          <button className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Cart (0)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-5 border-l-4 border-l-brand-500">
          <h3 className="text-sm font-bold text-surface-500 uppercase tracking-wider mb-1">Your Pricing Tier</h3>
          <p className="text-2xl font-extrabold text-surface-900 flex items-center gap-2">
            Platinum <span className="px-2 py-0.5 rounded text-[10px] bg-brand-100 text-brand-700">-15%</span>
          </p>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-surface-500 uppercase tracking-wider mb-1">Monthly Spend</h3>
          <p className="text-2xl font-extrabold text-surface-900">{formatCurrency(4500000)}</p>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-surface-500 uppercase tracking-wider mb-1">Pending Orders</h3>
          <p className="text-2xl font-extrabold text-surface-900">2 <span className="text-sm font-medium text-surface-400 font-normal ml-1">shipments</span></p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-surface-900 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-brand-600" /> B2B Product Catalog
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="glass-card h-64 animate-pulse bg-surface-100/50" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No products available</h3>
          <p className="text-surface-500 max-w-md">Our catalog is currently being updated. Please check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence>
            {filteredProducts.map((product, i) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5 flex flex-col hover:border-brand-300 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-500/10"
              >
                <div className="w-full h-32 bg-surface-50 rounded-xl mb-4 flex items-center justify-center border border-surface-100">
                  <Package className="w-12 h-12 text-surface-300" />
                </div>
                
                <h3 className="font-bold text-surface-900 mb-1 leading-tight">{product.name}</h3>
                <p className="text-xs text-surface-500 line-clamp-2 mb-4 flex-1">{product.description}</p>
                
                <div className="bg-brand-50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[10px] font-bold text-brand-600 uppercase">Wholesale Rate</span>
                    <span className="text-lg font-extrabold text-brand-700">{formatCurrency(product.wholesale_price)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-surface-500 line-through">{formatCurrency(product.retail_price)}</span>
                    <span className="font-semibold text-success-600">You save {Math.round((1 - (product.wholesale_price / product.retail_price)) * 100)}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input type="number" min={10} defaultValue={10} className="input text-center w-full !py-2" />
                  </div>
                  <button onClick={handleBulkOrder} className="btn-primary py-2 px-4 whitespace-nowrap">
                    Add
                  </button>
                </div>
                <p className="text-[10px] text-center text-surface-400 mt-2">Minimum order quantity: 10</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <MobileDashboardNav />
    </div>
  )
}
