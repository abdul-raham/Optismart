import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Package, Plus, Search, Edit2, Trash2, X, RefreshCw, ExternalLink, Upload, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'
import { CardGridSkeleton } from '@/components/shared/Skeletons'
import { optismartCatalogProducts } from '@/data/optismartProducts'
import { getProductImage } from '@/lib/productImages'
import { optimizeImage, uploadProductImage } from '@/utils/imageUpload'

import { useAuthStore } from '@/stores/authStore'

export function AdminProducts() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [activeTab, setActiveTab] = useState<'products' | 'promos'>('products')
  const [promoPackages, setPromoPackages] = useState<any[]>([
    {
      id: 'promo_ptz_bulb',
      title: 'Buy PTZ Camera + Get Smart Bulb FREE',
      description: 'Outdoor PTZ Security Camera bundled with 1 Free Smart Bulb',
      bonus_item_name: 'Smart Bulb 12W',
      promo_price: 45000,
      cost_price: 25000,
      is_active: true,
    },
    {
      id: 'promo_solar_kit',
      title: 'Solar PTZ 4G + Free Heavy-Duty Bracket',
      description: 'Solar powered 4G PTZ Camera bundled with Free Mounting Bracket',
      bonus_item_name: 'Heavy Duty Pole Bracket',
      promo_price: 75000,
      cost_price: 45000,
      is_active: true,
    },
  ])
  const [editingPromo, setEditingPromo] = useState<any | null>(null)
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false)
  const [promoForm, setPromoForm] = useState({
    title: '',
    description: '',
    bonus_item_name: '',
    promo_price: 0,
    cost_price: 0,
    is_active: true,
  })

  const [form, setForm] = useState({
    name: '',
    description: '',
    retail_price: 0,
    wholesale_price: 0,
    cost_price: 0,
    stock_quantity: 0,
    min_stock_level: 5,
    source_url: '',
    image_url: '',
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
      if (data) setProducts(data)
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      // Optimize image before upload
      const optimized = await optimizeImage(file)
      // Upload and get URL
      const url = await uploadProductImage(optimized)
      
      setForm(prev => ({ ...prev, image_url: url }))
    } catch (err) {
      console.error('Image upload failed:', err)
      alert('Failed to upload image. Make sure the storage bucket is set up.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('products')
          .update({ ...form })
          .eq('id', editingId)
          .select()
          .single()

        if (error) throw error
        if (data) {
          setProducts(products.map(p => p.id === editingId ? data : p))
          closeModal()
        }
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([{ ...form, is_active: true }])
          .select()
          .single()

        if (error) throw error
        if (data) {
          setProducts([data, ...products])
          closeModal()
        }
      }
    } catch (err) {
      console.error('Error saving product:', err)
      alert('Failed to save product')
    } finally {
      setSubmitting(false)
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
    setForm({ name: '', description: '', retail_price: 0, wholesale_price: 0, cost_price: 0, stock_quantity: 0, min_stock_level: 5, source_url: '', image_url: '' })
  }

  const toggleProductStatus = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id)
      setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p))
    } catch (err) {
      console.error('Failed to toggle status:', err)
    }
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      setProducts(products.filter(p => p.id !== id))
    } catch (err) {
      console.error('Failed to delete product:', err)
      alert('Failed to delete product. It might be linked to existing orders.')
    }
  }

  const syncOptismartCatalog = async () => {
    setSyncing(true)
    try {
      const { data: existing } = await supabase.from('products').select('name')
      const existingNames = new Set((existing || []).map(p => p.name))

      const newProducts = optismartCatalogProducts
        .filter(p => !existingNames.has(p.name))
        .map(({ specs: _specs, ...product }) => ({
          ...product,
          is_active: true,
        }))

      if (newProducts.length > 0) {
        const { error } = await supabase.from('products').insert(newProducts)
        if (error) throw error
      }

      // Also update existing products to ensure their image_url, specs, and source_url are correct
      for (const p of optismartCatalogProducts) {
        if (existingNames.has(p.name)) {
          await supabase.from('products').update({
            image_url: p.image_url,
            source_url: p.source_url
          }).eq('name', p.name)
        }
      }
      
      await fetchProducts()
    } catch (err) {
      console.error('Failed to sync OptiSmart catalog:', err)
      alert('Failed to sync OptiSmart catalog. Check Supabase schema and permissions.')
    } finally {
      setSyncing(false)
    }
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Product & Promo Catalog</h1>
          <p className="text-sm text-surface-500 mt-1">Manage cameras, acquisition costs, and promo bundle packages.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-64 transition-all"
            />
          </div>
          {activeTab === 'products' ? (
            <button onClick={() => { setEditingId(null); setForm({ name: '', description: '', retail_price: 0, wholesale_price: 0, cost_price: 0, stock_quantity: 0, min_stock_level: 5, source_url: '', image_url: '' }); setIsModalOpen(true); }} className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          ) : (
            <button onClick={() => { setEditingPromo(null); setPromoForm({ title: '', description: '', bonus_item_name: '', promo_price: 0, cost_price: 0, is_active: true }); setIsPromoModalOpen(true); }} className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Promo Package
            </button>
          )}
          <button onClick={syncOptismartCatalog} disabled={syncing} className="btn-outline h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync OptiSmart
          </button>
        </div>
      </div>

      {/* Header Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-200 pb-3">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'products' ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          }`}
        >
          📦 Camera Catalog ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('promos')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'promos' ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          }`}
        >
          🎁 Promo Packages ({promoPackages.length})
        </button>
      </div>

      {activeTab === 'products' ? (
        loading ? (
          <CardGridSkeleton count={6} />
        ) : filteredProducts.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No products in catalog</h3>
          <p className="text-surface-500 max-w-md">Sync the OptiSmart website catalog into Supabase so DSAs and resellers can sell real products.</p>
          <button onClick={syncOptismartCatalog} disabled={syncing} className="btn-primary mt-6">
            {syncing ? 'Syncing...' : 'Sync OptiSmart Catalog'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredProducts.map(product => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-card p-5 relative overflow-hidden transition-all ${!product.is_active ? 'opacity-60 grayscale-[0.5]' : 'hover:border-brand-200'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-50 to-cyan-50 flex items-center justify-center text-brand-600 border border-brand-100 overflow-hidden">
                    <img src={getProductImage(product.name, product.image_url)} alt={product.name} className="h-full w-full object-contain" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleProductStatus(product.id, product.is_active)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors ${
                        product.is_active ? 'bg-success-50 text-success-700 hover:bg-success-100' : 'bg-surface-200 text-surface-600 hover:bg-surface-300'
                      }`}
                    >
                      {product.is_active ? 'Active' : 'Draft'}
                    </button>
                    <button 
                      onClick={() => {
                        setEditingId(product.id)
                        setForm({
                          name: product.name,
                          description: product.description || '',
                          retail_price: product.retail_price,
                          wholesale_price: product.wholesale_price,
                          cost_price: product.cost_price || 0,
                          stock_quantity: product.stock_quantity,
                          min_stock_level: product.min_stock_level,
                          source_url: product.source_url || '',
                          image_url: product.image_url || ''
                        })
                        setIsModalOpen(true)
                      }}
                      className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                      title="Edit Product"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product.id, product.name)}
                      className="p-1.5 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-surface-900 mb-1">{product.name}</h3>
                <p className="text-xs text-surface-500 line-clamp-2 mb-4 h-8">{product.description}</p>
                {product.source_url && (
                  <a href={product.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 mb-4">
                    Website product page <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-danger-50 p-2 rounded-lg border border-danger-100">
                    <span className="text-[10px] uppercase font-bold text-danger-400 block mb-0.5">Cost</span>
                    <span className="text-sm font-bold text-danger-700">{formatCurrency(product.cost_price || 0)}</span>
                  </div>
                  <div className="bg-surface-50 p-2 rounded-lg border border-surface-100">
                    <span className="text-[10px] uppercase font-bold text-surface-400 block mb-0.5">Retail Price</span>
                    <span className="text-sm font-bold text-brand-700">{formatCurrency(product.retail_price)}</span>
                  </div>
                  <div className="bg-surface-50 p-2 rounded-lg border border-surface-100">
                    <span className="text-[10px] uppercase font-bold text-surface-400 block mb-0.5">Wholesale</span>
                    <span className="text-sm font-bold text-surface-700">{formatCurrency(product.wholesale_price)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${product.stock_quantity <= product.min_stock_level ? 'bg-danger-500 animate-pulse' : 'bg-success-500'}`} />
                    <span className={`text-xs font-semibold ${product.stock_quantity <= product.min_stock_level ? 'text-danger-600' : 'text-surface-600'}`}>
                      {product.stock_quantity} in stock
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )) : (
        /* PROMO PACKAGES TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {promoPackages.map(promo => (
            <div key={promo.id} className="glass-card p-5 border border-brand-100/80 bg-gradient-to-br from-white to-brand-50/20 relative overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-100 text-brand-700">
                  🎁 Promo Package
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingPromo(promo)
                      setPromoForm({
                        title: promo.title,
                        description: promo.description || '',
                        bonus_item_name: promo.bonus_item_name || '',
                        promo_price: promo.promo_price || 0,
                        cost_price: promo.cost_price || 0,
                        is_active: promo.is_active,
                      })
                      setIsPromoModalOpen(true)
                    }}
                    className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                    title="Edit Promo Package"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPromoPackages(prev => prev.filter(p => p.id !== promo.id))}
                    className="p-1.5 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
                    title="Delete Promo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-surface-900 text-base mb-1">{promo.title}</h3>
              <p className="text-xs text-surface-600 mb-4 leading-relaxed">{promo.description}</p>

              <div className="p-3 bg-white rounded-xl border border-surface-100 space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-surface-500 font-semibold">Included Free Gift:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">✨ {promo.bonus_item_name}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-surface-100">
                  <span className="text-surface-500 font-semibold">Promo Package Price:</span>
                  <span className="font-extrabold text-brand-700 text-sm">{formatCurrency(promo.promo_price)}</span>
                </div>
                {isSuperAdmin && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-surface-100">
                    <span className="text-surface-400 font-medium">Acquisition Cost:</span>
                    <span className="font-bold text-surface-600">{formatCurrency(promo.cost_price)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {createPortal(
        <AnimatePresence>
          {isPromoModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
                onClick={() => setIsPromoModalOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-md relative z-10 rounded-2xl shadow-card-xl overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
                  <h2 className="text-lg font-bold text-surface-900">
                    {editingPromo ? 'Edit Promo Package' : 'Create Promo Package'}
                  </h2>
                  <button onClick={() => setIsPromoModalOpen(false)} className="text-surface-400 hover:text-surface-900">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault()
                    if (editingPromo) {
                      setPromoPackages(prev =>
                        prev.map(p => (p.id === editingPromo.id ? { ...p, ...promoForm } : p))
                      )
                    } else {
                      setPromoPackages(prev => [
                        ...prev,
                        { id: `promo_${Date.now()}`, ...promoForm },
                      ])
                    }
                    setIsPromoModalOpen(false)
                  }}
                  className="p-6 space-y-4"
                >
                  <div>
                    <label className="label">Promo Title *</label>
                    <input
                      required
                      type="text"
                      className="input"
                      placeholder="e.g. Buy PTZ Camera + Free Smart Bulb"
                      value={promoForm.title}
                      onChange={e => setPromoForm({ ...promoForm, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Description</label>
                    <textarea
                      rows={2}
                      className="input resize-none"
                      placeholder="Describe what is in this promotional bundle..."
                      value={promoForm.description}
                      onChange={e => setPromoForm({ ...promoForm, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Included Free Gift / Bonus Item *</label>
                    <input
                      required
                      type="text"
                      className="input font-semibold text-emerald-700"
                      placeholder="e.g. Smart Bulb 12W or Solar Bracket"
                      value={promoForm.bonus_item_name}
                      onChange={e => setPromoForm({ ...promoForm, bonus_item_name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Promo Retail Price (₦) *</label>
                      <input
                        required
                        type="number"
                        min={0}
                        className="input font-bold text-brand-700"
                        value={promoForm.promo_price}
                        onChange={e => setPromoForm({ ...promoForm, promo_price: Number(e.target.value) })}
                      />
                    </div>
                    {isSuperAdmin && (
                      <div>
                        <label className="label">Acquisition Cost (₦) *</label>
                        <input
                          required
                          type="number"
                          min={0}
                          className="input font-bold text-surface-700"
                          value={promoForm.cost_price}
                          onChange={e => setPromoForm({ ...promoForm, cost_price: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-surface-100 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsPromoModalOpen(false)} className="btn-outline">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      {editingPromo ? 'Save Changes' : 'Create Package'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* PRODUCT MODAL — always-mounted portal, AnimatePresence inside */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
                onClick={() => !submitting && closeModal()}
              />
              <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full sm:max-w-lg relative z-10 flex flex-col rounded-t-2xl sm:rounded-2xl shadow-card-xl max-h-[90dvh]"
              >
                {/* Sticky header with X always visible */}
                <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50/50 shrink-0 rounded-t-2xl sm:rounded-t-2xl">
                  <h2 className="text-lg font-bold text-surface-900">{editingId ? 'Edit Product' : 'Add Product'}</h2>
                  <button onClick={() => !submitting && closeModal()} className="text-surface-400 hover:text-surface-900 transition-colors p-2 rounded-md hover:bg-surface-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable form body */}
                <form onSubmit={handleSaveProduct} className="flex flex-col flex-1 min-h-0">
                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                      <label className="label">Product Name *</label>
                      <input required type="text" className="input" placeholder="e.g. 4-Channel CCTV Kit" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>

                    <div>
                      <label className="label">Description</label>
                      <textarea rows={2} className="input resize-none" placeholder="Features, contents, specs..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                    </div>

                    <div>
                      <label className="label">Website Source URL</label>
                      <input type="url" className="input" placeholder="https://optismart.com.ng/..." value={form.source_url} onChange={e => setForm({...form, source_url: e.target.value})} />
                    </div>

                    <div>
                      <label className="label">Product Image</label>
                      <div className="flex gap-2 items-center">
                        <input type="text" className="input flex-1" placeholder="URL or upload an image..." value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} />
                        
                        <div className="relative shrink-0">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                          />
                          <button type="button" disabled={isUploading} className="btn-outline px-4 flex items-center gap-2 h-[42px]">
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload'}</span>
                          </button>
                        </div>
                      </div>
                      {form.image_url && (
                        <div className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden border border-surface-200 bg-surface-50">
                          <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Retail Price (₦) *</label>
                        <input required type="number" min={0} className="input" value={form.retail_price} onChange={e => setForm({...form, retail_price: Number(e.target.value)})} />
                      </div>
                      <div>
                        <label className="label">Wholesale Price (₦) *</label>
                        <input required type="number" min={0} className="input" value={form.wholesale_price} onChange={e => setForm({...form, wholesale_price: Number(e.target.value)})} />
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div>
                        <label className="label">Company Cost Price (₦) *</label>
                        <input required type="number" min={0} className="input font-semibold text-brand-700" value={form.cost_price} onChange={e => setForm({...form, cost_price: Number(e.target.value)})} />
                        <p className="mt-1 text-xs text-surface-400">Superadmin-only acquisition cost used for profit/loss calculation.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Stock Quantity *</label>
                        <input required type="number" min={0} className="input" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: Number(e.target.value)})} />
                      </div>
                      <div>
                        <label className="label">Low Stock Alert *</label>
                        <input required type="number" min={0} className="input" value={form.min_stock_level} onChange={e => setForm({...form, min_stock_level: Number(e.target.value)})} />
                      </div>
                    </div>
                  </div>

                  {/* Sticky footer buttons */}
                  <div className="px-5 py-4 flex items-center justify-end gap-3 border-t border-surface-100 bg-white shrink-0">
                    <button type="button" onClick={() => closeModal()} disabled={submitting} className="btn-outline">Cancel</button>
                    <button type="submit" disabled={submitting} className="btn-primary w-32 flex items-center justify-center">
                      {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editingId ? 'Save Changes' : 'Save Product')}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.getElementById('modal-root') || document.body
      )}
    </div>
  )
}
