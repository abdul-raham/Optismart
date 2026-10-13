import { Fragment, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Package, Plus, Search, Edit2, Trash2, X, RefreshCw, ExternalLink, Upload, Loader2, MapPin, AlertTriangle, ArrowRightLeft, ClipboardCheck } from 'lucide-react'
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [activeTab, setActiveTab] = useState<'products' | 'promos' | 'inventory'>('products')
  const [locations, setLocations] = useState<any[]>([])
  const [inventoryList, setInventoryList] = useState<any[]>([])
  const [movementsList, setMovementsList] = useState<any[]>([])

  // Stock In Modal State
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false)
  const [stockInForm, setStockInForm] = useState({
    product_id: '',
    location_id: '',
    quantity: 20,
    notes: '',
  })

  // Stock Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [locationForm, setLocationForm] = useState({ name: '', address: '', phone: '' })
  const [transferForm, setTransferForm] = useState({
    product_id: '',
    from_location_id: '',
    to_location_id: '',
    quantity: 5,
    notes: '',
  })

  // Physical Count Audit Override State
  const [isPhysicalCountModalOpen, setIsPhysicalCountModalOpen] = useState(false)
  const [physicalCountForm, setPhysicalCountForm] = useState({
    product_id: '',
    location_id: '',
    target_quantity: 0,
    notes: '',
  })
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
    category: 'camera' as 'camera' | 'sd_card' | 'accessory',
  })
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'camera' | 'sd_card' | 'accessory'>('all')

  const openStockInForProduct = (productId: string, locationId: string = '') => {
    const defaultLocId = locationId || (locations.length > 0 ? locations[0].id : '')
    setStockInForm({
      product_id: productId,
      location_id: defaultLocId,
      quantity: 20,
      notes: 'Low stock top-up addition',
    })
    setIsStockInModalOpen(true)
  }

  useEffect(() => {
    fetchProducts()
    fetchInventoryData()
  }, [])

  useEffect(() => {
    const action = searchParams.get('action')
    const productId = searchParams.get('product_id')
    const locationId = searchParams.get('location_id')

    if (action === 'stock_in' && productId) {
      openStockInForProduct(productId, locationId || '')
      searchParams.delete('action')
      searchParams.delete('product_id')
      searchParams.delete('location_id')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, locations])

  const lowStockProducts = products.filter(p => p.stock_quantity <= (p.min_stock_level || 5))

  const fetchInventoryData = async () => {
    try {
      const [locRes, invRes, movRes] = await Promise.all([
        supabase.from('inventory_locations').select('*').order('name'),
        supabase.from('product_inventory').select('*, product:products(name, image_url), location:inventory_locations(name)'),
        supabase.from('stock_movements').select('*, product:products(name), from_loc:inventory_locations!stock_movements_from_location_id_fkey(name), to_loc:inventory_locations!stock_movements_to_location_id_fkey(name)').order('created_at', { ascending: false }).limit(100),
      ])

      if (locRes.data) setLocations(locRes.data)
      if (invRes.data) setInventoryList(invRes.data)
      if (movRes.data) setMovementsList(movRes.data)
    } catch (err) {
      console.error('Error fetching inventory data:', err)
    }
  }

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockInForm.product_id || !stockInForm.location_id || stockInForm.quantity <= 0) {
      alert('Please fill out all required stock fields')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('inventory_stock_in', {
        p_product_id: stockInForm.product_id,
        p_location_id: stockInForm.location_id,
        p_quantity: Number(stockInForm.quantity),
        p_notes: stockInForm.notes || 'Incoming stock addition',
      })
      if (error) throw error

      alert('Stock successfully added!')
      setIsStockInModalOpen(false)
      fetchInventoryData()
      fetchProducts()
    } catch (err: any) {
      console.error('Stock In failed:', err)
      alert(`Failed to add stock: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const { product_id, from_location_id, to_location_id, quantity, notes } = transferForm
    if (!product_id || !from_location_id || !to_location_id || quantity <= 0) {
      alert('Please fill out all transfer fields')
      return
    }

    if (from_location_id === to_location_id) {
      alert('From and To locations must be different')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('inventory_transfer', {
        p_product_id: product_id,
        p_from_location_id: from_location_id,
        p_to_location_id: to_location_id,
        p_quantity: Number(quantity),
        p_notes: notes || 'Inter-branch stock transfer',
      })
      if (error) throw error

      alert('Stock transfer completed successfully!')
      setIsTransferModalOpen(false)
      fetchInventoryData()
      fetchProducts()
    } catch (err: any) {
      console.error('Stock Transfer failed:', err)
      alert(`Transfer failed: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetPhysicalCount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!physicalCountForm.product_id || !physicalCountForm.location_id || physicalCountForm.target_quantity < 0) {
      alert('Please fill out all physical count fields')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('inventory_set_physical_count', {
        p_product_id: physicalCountForm.product_id,
        p_location_id: physicalCountForm.location_id,
        p_target_quantity: Number(physicalCountForm.target_quantity),
        p_notes: physicalCountForm.notes || 'Physical Stock Audit Count Override'
      })

      if (error) throw error

      alert('Physical stock count set successfully!')
      setIsPhysicalCountModalOpen(false)
      fetchInventoryData()
      fetchProducts()
    } catch (err: any) {
      console.error('Physical Count update failed:', err)
      alert(`Failed to update physical count: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('inventory_create_location', {
        p_name: locationForm.name,
        p_address: locationForm.address || null,
        p_phone: locationForm.phone || null,
      })
      if (error) throw error
      setLocationForm({ name: '', address: '', phone: '' })
      setIsLocationModalOpen(false)
      await fetchInventoryData()
    } catch (err: any) {
      alert(`Failed to create location: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

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
    setForm({ name: '', description: '', retail_price: 0, wholesale_price: 0, cost_price: 0, stock_quantity: 0, min_stock_level: 5, source_url: '', image_url: '', category: 'camera' })
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

  const CATEGORY_LABEL = { camera: 'Cameras', sd_card: 'SD cards', accessory: 'Accessories' } as const
  const categoryOf = (p: Product) => p.category || 'camera'
  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => categoryFilter === 'all' || categoryOf(p) === categoryFilter)
    .sort((a, b) => ['camera', 'sd_card', 'accessory'].indexOf(categoryOf(a)) - ['camera', 'sd_card', 'accessory'].indexOf(categoryOf(b)) || a.name.localeCompare(b.name))

  const stockAt = (productId: string, locationId: string) =>
    Number(inventoryList.find(i => i.product_id === productId && i.location_id === locationId)?.quantity || 0)
  const totalStock = (productId: string) => locations.reduce((sum, loc) => sum + stockAt(productId, loc.id), 0)
  const branchesHolding = (productId: string) => locations.filter(loc => stockAt(productId, loc.id) > 0).length
  const isLow = (p: Product) => totalStock(p.id) <= (p.min_stock_level || 5)
  const totalUnits = products.reduce((sum, p) => sum + totalStock(p.id), 0)
  const stockValue = products.reduce((sum, p) => sum + totalStock(p.id) * Number(p.cost_price || 0), 0)
  const lowCount = products.filter(p => p.is_active && isLow(p)).length
  const branchTotals = locations
    .map(loc => ({ ...loc, units: inventoryList.filter(i => i.location_id === loc.id).reduce((s, i) => s + (i.quantity || 0), 0) }))
    .sort((a, b) => b.units - a.units)
  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setForm({
      name: product.name, description: product.description || '', retail_price: product.retail_price,
      wholesale_price: product.wholesale_price, cost_price: product.cost_price || 0, stock_quantity: product.stock_quantity,
      min_stock_level: product.min_stock_level, source_url: product.source_url || '', image_url: product.image_url || '',
      category: product.category || 'camera',
    })
    setIsModalOpen(true)
  }
  const margin = (p: Product) => {
    const retail = Number(p.retail_price || 0), cost = Number(p.cost_price || 0)
    return retail > 0 && cost > 0 ? (retail - cost) / retail : null
  }
  const TABS = [
    { id: 'products' as const, label: 'Products', count: products.length },
    { id: 'inventory' as const, label: 'Branch stock', count: locations.length },
    { id: 'promos' as const, label: 'Promo packages', count: promoPackages.length },
  ]
  // Frozen table chrome: header row sticks to the top, the first column sticks to the left.
  const thBase = 'sticky top-0 z-20 bg-surface-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-surface-500 whitespace-nowrap border-b border-surface-200'
  const corner = 'sticky left-0 top-0 z-30 bg-surface-50 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-surface-500 border-b border-r border-surface-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
  const firstCol = 'sticky left-0 z-10 bg-white group-hover:bg-surface-50 px-4 py-3 border-r border-surface-100 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'

  return (
    <div className="space-y-5 relative">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">Catalogue &amp; stock</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-surface-900">Products &amp; Inventory</h1>
          <p className="mt-1 text-sm text-surface-500">Prices, costs and live stock across every branch.</p>
        </div>
        <button onClick={syncOptismartCatalog} disabled={syncing}
          className="btn-outline h-9 self-start rounded-xl border-surface-200 px-3.5 text-xs font-bold sm:self-auto flex items-center gap-2 hover:bg-surface-50">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-brand-600' : 'text-surface-400'}`} />
          {syncing ? 'Syncing…' : 'Sync website catalogue'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Products', value: products.filter(p => p.is_active).length, sub: `${products.length - products.filter(p => p.is_active).length} draft` },
          { label: 'Units in stock', value: totalUnits.toLocaleString(), sub: `across ${locations.length} branches` },
          { label: 'Low stock', value: lowCount, sub: lowCount ? 'need topping up' : 'all healthy', warn: lowCount > 0 },
          { label: 'Stock value (cost)', value: formatCurrency(stockValue), sub: 'units × cost price' },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.warn ? 'border-amber-200 bg-amber-50/70' : 'border-surface-200 bg-white'}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500">{k.label}</p>
            <p className={`mt-1 text-xl font-black tracking-tight ${k.warn ? 'text-amber-800' : 'text-surface-900'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-surface-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar: tabs, search, actions */}
      <div className="flex flex-col gap-3 rounded-2xl border border-surface-200 bg-white p-2.5 lg:flex-row lg:items-center">
        <div className="flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-surface-100 p-1 hide-scrollbar">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${activeTab === t.id ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-800'}`}>
              {t.label}
              <span className={`rounded-full px-1.5 text-[10px] ${activeTab === t.id ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-600'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={activeTab === 'promos' ? 'Filter promo packages…' : 'Search products…'}
            className="w-full rounded-xl border border-surface-200 bg-surface-50/60 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'products' && (
            <button onClick={() => { setEditingId(null); setForm({ name: '', description: '', retail_price: 0, wholesale_price: 0, cost_price: 0, stock_quantity: 0, min_stock_level: 5, source_url: '', image_url: '', category: 'camera' }); setIsModalOpen(true) }}
              className="btn-primary flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold">
              <Plus className="h-4 w-4" /> Add product
            </button>
          )}
          {activeTab === 'promos' && (
            <button onClick={() => { setEditingPromo(null); setPromoForm({ title: '', description: '', bonus_item_name: '', promo_price: 0, cost_price: 0, is_active: true }); setIsPromoModalOpen(true) }}
              className="btn-primary flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold">
              <Plus className="h-4 w-4" /> New promo package
            </button>
          )}
          {activeTab === 'inventory' && (
            <>
              <button onClick={() => setIsStockInModalOpen(true)} className="btn-primary flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">
                <Plus className="h-3.5 w-3.5" /> Stock in
              </button>
              <button onClick={() => setIsTransferModalOpen(true)} className="btn-outline flex h-9 items-center gap-1.5 rounded-xl border-surface-200 px-3 text-xs font-bold">
                <ArrowRightLeft className="h-3.5 w-3.5 text-brand-600" /> Transfer
              </button>
              <button onClick={() => {
                setPhysicalCountForm({ product_id: products[0]?.id || '', location_id: locations[0]?.id || '', target_quantity: 0, notes: 'Physical Stock Count Audit' })
                setIsPhysicalCountModalOpen(true)
              }} className="btn-outline flex h-9 items-center gap-1.5 rounded-xl border-surface-200 px-3 text-xs font-bold">
                <ClipboardCheck className="h-3.5 w-3.5 text-amber-600" /> Count
              </button>
              <button onClick={() => setIsLocationModalOpen(true)} className="btn-outline flex h-9 items-center gap-1.5 rounded-xl border-surface-200 px-3 text-xs font-bold">
                <MapPin className="h-3.5 w-3.5 text-surface-500" /> Add branch
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab !== 'promos' && (
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'camera', 'sd_card', 'accessory'] as const).map(c => {
            const n = c === 'all' ? products.length : products.filter(p => categoryOf(p) === c).length
            if (c !== 'all' && n === 0) return null
            return (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${categoryFilter === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'}`}>
                {c === 'all' ? 'All' : CATEGORY_LABEL[c]} <span className="text-surface-400">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Low stock */}
      {lowStockProducts.length > 0 && activeTab !== 'promos' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500 text-white"><AlertTriangle className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-950">{lowStockProducts.length} product{lowStockProducts.length > 1 ? 's are' : ' is'} low on stock</p>
              <p className="truncate text-xs text-amber-800">{lowStockProducts.map(p => `${p.name} (${p.stock_quantity})`).join(' · ')}</p>
            </div>
          </div>
          <button onClick={() => openStockInForProduct(lowStockProducts[0].id)} className="btn-primary flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white hover:bg-amber-700">
            <Plus className="h-3.5 w-3.5" /> Top up
          </button>
        </div>
      )}

      {activeTab === 'products' ? (
        loading ? <CardGridSkeleton count={6} /> : filteredProducts.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-surface-100"><Package className="h-8 w-8 text-surface-400" /></div>
            <h3 className="mb-2 text-lg font-bold text-surface-900">{search ? 'No products match your search' : 'No products in the catalogue'}</h3>
            <p className="max-w-md text-surface-500">{search ? 'Try another name.' : 'Sync the OptiSmart website catalogue so DSAs and resellers can sell real products.'}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className={corner}>Product</th>
                    <th className={thBase}>Status</th>
                    <th className={`${thBase} text-right`}>Retail</th>
                    <th className={`${thBase} text-right`}>Wholesale</th>
                    <th className={`${thBase} text-right`}>Cost</th>
                    <th className={`${thBase} text-right`}>Margin</th>
                    <th className={`${thBase} text-right`}>In stock</th>
                    <th className={thBase}>Branches</th>
                    <th className={`${thBase} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const total = totalStock(p.id), m = margin(p), low = isLow(p)
                    return (
                      <tr key={p.id} className={`group transition-colors hover:bg-surface-50 ${!p.is_active ? 'opacity-60' : ''}`}>
                        <td className={firstCol}>
                          <div className="flex min-w-[220px] max-w-[300px] items-center gap-3">
                            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-surface-100 bg-white">
                              <img src={getProductImage(p.name, p.image_url)} alt="" className="h-full w-full object-contain" loading="lazy" />
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate font-bold text-surface-900">{p.name}</span>
                                {categoryOf(p) !== 'camera' && <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">{CATEGORY_LABEL[categoryOf(p)]}</span>}
                              </span>
                              {p.source_url
                                ? <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline">Website page <ExternalLink className="h-3 w-3" /></a>
                                : <span className="block truncate text-[11px] text-surface-400">{p.description || '—'}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-surface-100 px-4 py-3">
                          <button onClick={() => toggleProductStatus(p.id, p.is_active)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${p.is_active ? 'bg-success-50 text-success-700 hover:bg-success-100' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
                            title={p.is_active ? 'Click to hide from sellers' : 'Click to make it sellable'}>
                            {p.is_active ? 'Active' : 'Draft'}
                          </button>
                        </td>
                        <td className="whitespace-nowrap border-b border-surface-100 px-4 py-3 text-right font-bold text-surface-900">{formatCurrency(p.retail_price)}</td>
                        <td className="whitespace-nowrap border-b border-surface-100 px-4 py-3 text-right text-surface-700">{formatCurrency(p.wholesale_price)}</td>
                        <td className="whitespace-nowrap border-b border-surface-100 px-4 py-3 text-right text-surface-500">{formatCurrency(p.cost_price || 0)}</td>
                        <td className={`whitespace-nowrap border-b border-surface-100 px-4 py-3 text-right font-semibold ${m == null ? 'text-surface-400' : m < 0.15 ? 'text-danger-600' : 'text-success-700'}`}>
                          {m == null ? '—' : `${Math.round(m * 100)}%`}
                        </td>
                        <td className="whitespace-nowrap border-b border-surface-100 px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold ${low ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-surface-100 text-surface-800'}`}>
                            {low && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}{total}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b border-surface-100 px-4 py-3 text-xs text-surface-600">
                          {branchesHolding(p.id)} of {locations.length}
                        </td>
                        <td className="whitespace-nowrap border-b border-surface-100 px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openStockInForProduct(p.id)} className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${low ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'text-surface-500 hover:bg-surface-100 hover:text-surface-800'}`}>
                              + Stock
                            </button>
                            <button onClick={() => startEdit(p)} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-brand-50 hover:text-brand-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteProduct(p.id, p.name)} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-danger-50 hover:text-danger-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'promos' ? (
        /* PROMO PACKAGES TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {promoPackages.map(promo => (
            <div key={promo.id} className="glass-card p-5 border border-brand-100/80 bg-gradient-to-br from-white to-brand-50/20 relative overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-100 text-brand-700">
                  Promo Package
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
                    className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
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
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{promo.bonus_item_name}</span>
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
      ) : (
        <div className="space-y-5">
          {/* Branch totals */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {branchTotals.map(b => (
              <div key={b.id} className="min-w-[132px] shrink-0 rounded-xl border border-surface-200 bg-white px-3 py-2.5">
                <p className="truncate text-[11px] font-bold uppercase tracking-wider text-surface-500" title={b.address || b.name}>{b.name}</p>
                <p className={`mt-0.5 text-lg font-black ${b.units === 0 ? 'text-surface-300' : 'text-surface-900'}`}>{b.units}</p>
                <p className="text-[10px] text-surface-400">units</p>
              </div>
            ))}
          </div>

          {/* Product × branch grid */}
          <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-surface-900"><Package className="h-4 w-4 text-brand-600" /> Stock by branch</h3>
              <p className="text-xs text-surface-500">Tap a number to correct it · ✎ edits the product · red = at or below the minimum</p>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className={`${corner} min-w-[220px]`}>Product</th>
                    <th className={`${thBase} text-right`}>Total</th>
                    {locations.map(loc => (
                      <th key={loc.id} className={`${thBase} min-w-[92px] text-center`} title={loc.address || loc.name}>{loc.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, i) => (<Fragment key={p.id}>
                    {(i === 0 || categoryOf(filteredProducts[i - 1]) !== categoryOf(p)) && (
                      <tr key={`group-${categoryOf(p)}`}>
                        <td className="sticky left-0 z-10 border-b border-surface-200 bg-surface-100 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-surface-600">{CATEGORY_LABEL[categoryOf(p)]}</td>
                        <td colSpan={locations.length + 1} className="border-b border-surface-200 bg-surface-100" />
                      </tr>
                    )}
                    <tr key={p.id} className="group hover:bg-surface-50">
                      <td className={firstCol}>
                        <div className="flex max-w-[260px] items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-surface-100 bg-white">
                            <img src={getProductImage(p.name, p.image_url)} alt="" className="h-full w-full object-contain" loading="lazy" />
                          </span>
                          <span className="truncate font-bold text-surface-900">{p.name}</span>
                          <button onClick={() => startEdit(p)} title="Edit product" className="ml-auto shrink-0 rounded-md p-1 text-surface-300 transition-colors hover:bg-brand-50 hover:text-brand-600 group-hover:text-surface-500">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-b border-surface-100 px-4 py-2.5 text-right font-black text-surface-900">{totalStock(p.id)}</td>
                      {locations.map(loc => {
                        const qty = stockAt(p.id, loc.id)
                        const low = qty <= (p.min_stock_level || 5)
                        return (
                          <td key={loc.id} className="border-b border-surface-100 px-2 py-2 text-center">
                            <button onClick={() => { setPhysicalCountForm({ product_id: p.id, location_id: loc.id, target_quantity: qty, notes: `Stock corrected at ${loc.name}` }); setIsPhysicalCountModalOpen(true) }}
                              title={`Set ${p.name} stock at ${loc.name}`}
                              className={`min-w-[44px] rounded-lg px-2 py-1 text-xs font-extrabold transition-colors ${qty === 0 ? 'text-surface-300 hover:bg-surface-100 hover:text-surface-600' : low ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-surface-100 text-surface-800 hover:bg-brand-50 hover:text-brand-700'}`}>
                              {qty}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  </Fragment>))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock movements */}
          <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
            <div className="border-b border-surface-100 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-surface-900"><RefreshCw className="h-4 w-4 text-brand-600" /> Stock movements</h3>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className={corner}>When</th>
                    <th className={thBase}>Type</th>
                    <th className={thBase}>Product</th>
                    <th className={thBase}>From → To</th>
                    <th className={`${thBase} text-right`}>Units</th>
                    <th className={thBase}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsList.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-surface-500">No stock movements yet.</td></tr>
                  )}
                  {movementsList.map(m => {
                    const tone = m.movement_type === 'stock_in' || m.movement_type === 'return' ? 'bg-emerald-50 text-emerald-700'
                      : m.movement_type === 'transfer' ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-700'
                    return (
                      <tr key={m.id} className="group hover:bg-surface-50">
                        <td className={`${firstCol} whitespace-nowrap text-xs text-surface-500`}>{new Date(m.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="border-b border-surface-100 px-4 py-2.5"><span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${tone}`}>{String(m.movement_type).replace('_', ' ')}</span></td>
                        <td className="border-b border-surface-100 px-4 py-2.5 font-semibold text-surface-900">{m.product?.name || '—'}</td>
                        <td className="whitespace-nowrap border-b border-surface-100 px-4 py-2.5 text-xs text-surface-600">{m.from_loc?.name || '—'} → {m.to_loc?.name || '—'}</td>
                        <td className="border-b border-surface-100 px-4 py-2.5 text-right font-black text-surface-900">{m.quantity}</td>
                        <td className="max-w-[280px] truncate border-b border-surface-100 px-4 py-2.5 text-xs text-surface-500" title={m.notes || ''}>{m.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {isPromoModalOpen && (
            <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
                onClick={() => setIsPromoModalOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-md relative z-10 rounded-2xl shadow-card-xl my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50 shrink-0">
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
                  className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-hide"
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <div className="pt-4 border-t border-surface-100 flex justify-end gap-3 sticky bottom-0 bg-white pb-1 -mx-6 px-6 pt-3 mt-4 shrink-0 shadow-xs">
                    <button type="button" onClick={() => setIsPromoModalOpen(false)} className="btn-outline">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary shadow-brand">
                      {editingPromo ? 'Save Changes' : 'Create Package'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {isLocationModalOpen && (
            <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex items-center justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={() => setIsLocationModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative z-10 w-full max-w-md my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-card-xl">
                <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4 shrink-0"><h2 className="flex items-center gap-2 text-lg font-bold"><MapPin className="h-5 w-5 text-brand-600" /> Add Inventory Location</h2><button onClick={() => setIsLocationModalOpen(false)}><X className="h-5 w-5" /></button></div>
                <form onSubmit={handleCreateLocation} className="space-y-4 p-6 overflow-y-auto flex-1 scrollbar-hide">
                  <div><label className="label">Location name *</label><input required className="input" value={locationForm.name} onChange={e => setLocationForm(previous => ({ ...previous, name: e.target.value }))} placeholder="e.g. Ibadan Branch" /></div>
                  <div><label className="label">Address</label><input className="input" value={locationForm.address} onChange={e => setLocationForm(previous => ({ ...previous, address: e.target.value }))} /></div>
                  <div><label className="label">Phone</label><input className="input" value={locationForm.phone} onChange={e => setLocationForm(previous => ({ ...previous, phone: e.target.value }))} /></div>
                  <div className="flex justify-end gap-3 border-t border-surface-100 pt-4 sticky bottom-0 bg-white pb-1 -mx-6 px-6 pt-3 mt-4 shrink-0 shadow-xs"><button type="button" className="btn-outline" onClick={() => setIsLocationModalOpen(false)}>Cancel</button><button className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Add Location'}</button></div>
                </form>
              </motion.div>
            </div>
          )}

          {/* STOCK IN MODAL */}
          {isStockInModalOpen && (
            <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex items-center justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={() => setIsStockInModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-md relative z-10 rounded-2xl shadow-card-xl my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-emerald-50 text-emerald-900 shrink-0">
                  <h2 className="text-lg font-bold flex items-center gap-2"><Package className="h-5 w-5" /> Log Stock In (New Stock)</h2>
                  <button onClick={() => setIsStockInModalOpen(false)} className="text-emerald-700 hover:text-emerald-950"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleStockIn} className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                  <div>
                    <label className="label">Product *</label>
                    <select required className="input bg-white text-sm" value={stockInForm.product_id} onChange={e => setStockInForm({...stockInForm, product_id: e.target.value})}>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Select Target Location / Branch *</label>
                    <select required className="input bg-white text-sm" value={stockInForm.location_id} onChange={e => setStockInForm({...stockInForm, location_id: e.target.value})}>
                      <option value="">Select branch location...</option>
                      {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Quantity Incoming *</label>
                    <input required type="number" min={1} className="input font-bold text-lg text-emerald-700" value={stockInForm.quantity} onChange={e => setStockInForm({...stockInForm, quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="label">Notes / Reference (Optional)</label>
                    <input type="text" className="input text-xs" placeholder="e.g. Shipment Waybill #402" value={stockInForm.notes} onChange={e => setStockInForm({...stockInForm, notes: e.target.value})} />
                  </div>
                  <div className="pt-4 flex justify-end gap-3 border-t border-surface-100 sticky bottom-0 bg-white pb-1 -mx-6 px-6 pt-3 mt-4 shrink-0 shadow-xs">
                    <button type="button" onClick={() => setIsStockInModalOpen(false)} className="btn-outline">Cancel</button>
                    <button type="submit" disabled={submitting} className="btn-primary bg-emerald-600 hover:bg-emerald-700">{submitting ? 'Saving...' : 'Add Stock'}</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* STOCK TRANSFER MODAL */}
          {isTransferModalOpen && (
            <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex items-center justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={() => setIsTransferModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-md relative z-10 rounded-2xl shadow-card-xl my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-brand-50 text-brand-900 shrink-0">
                  <h2 className="text-lg font-bold flex items-center gap-2">Inter-Branch Stock Transfer</h2>
                  <button onClick={() => setIsTransferModalOpen(false)} className="text-brand-700 hover:text-brand-950"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleStockTransfer} className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                  <div>
                    <label className="label">Select Camera Product *</label>
                    <select required className="input bg-white text-sm" value={transferForm.product_id} onChange={e => setTransferForm({...transferForm, product_id: e.target.value})}>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label text-xs">From Branch *</label>
                      <select required className="input bg-white text-xs" value={transferForm.from_location_id} onChange={e => setTransferForm({...transferForm, from_location_id: e.target.value})}>
                        <option value="">Source branch...</option>
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">To Branch *</label>
                      <select required className="input bg-white text-xs" value={transferForm.to_location_id} onChange={e => setTransferForm({...transferForm, to_location_id: e.target.value})}>
                        <option value="">Destination...</option>
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Quantity to Transfer *</label>
                    <input required type="number" min={1} className="input font-bold text-lg text-brand-700" value={transferForm.quantity} onChange={e => setTransferForm({...transferForm, quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="label">Transfer Notes / Reason (Optional)</label>
                    <input type="text" className="input text-xs" placeholder="e.g. Restocking Abuja branch demand" value={transferForm.notes} onChange={e => setTransferForm({...transferForm, notes: e.target.value})} />
                  </div>
                  <div className="pt-4 flex justify-end gap-3 border-t border-surface-100 sticky bottom-0 bg-white pb-1 -mx-6 px-6 pt-3 mt-4 shrink-0 shadow-xs">
                    <button type="button" onClick={() => setIsTransferModalOpen(false)} className="btn-outline">Cancel</button>
                    <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Transferring...' : 'Execute Stock Transfer'}</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* PHYSICAL COUNT AUDIT OVERRIDE MODAL */}
          {isPhysicalCountModalOpen && (
            <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex items-center justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={() => setIsPhysicalCountModalOpen(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white w-full max-w-md relative z-10 rounded-2xl shadow-card-xl my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50 text-amber-950 shrink-0">
                  <h2 className="text-lg font-bold flex items-center gap-2">Set stock count</h2>
                  <button onClick={() => setIsPhysicalCountModalOpen(false)} className="text-amber-700 hover:text-amber-950"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSetPhysicalCount} className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                  <p className="text-xs text-surface-500">
                    Use this tool to align database inventory directly with the actual physical count sitting on your branch shelves.
                  </p>
                  <div>
                    <label className="label">Select Camera Product *</label>
                    <select required className="input bg-white text-sm" value={physicalCountForm.product_id} onChange={e => setPhysicalCountForm({...physicalCountForm, product_id: e.target.value})}>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Branch Inventory Location *</label>
                    <select required className="input bg-white text-xs" value={physicalCountForm.location_id} onChange={e => setPhysicalCountForm({...physicalCountForm, location_id: e.target.value})}>
                      <option value="">Select branch...</option>
                      {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Units on the shelf now *</label>
                    <input required type="number" min={0} className="input font-bold text-xl text-amber-800" value={physicalCountForm.target_quantity} onChange={e => setPhysicalCountForm({...physicalCountForm, target_quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="label">Audit Note / Reason</label>
                    <input type="text" className="input text-xs" placeholder="e.g. Physical inventory count after legacy order cleanup" value={physicalCountForm.notes} onChange={e => setPhysicalCountForm({...physicalCountForm, notes: e.target.value})} />
                  </div>
                  <div className="pt-4 flex justify-end gap-3 border-t border-surface-100 sticky bottom-0 bg-white pb-1 -mx-6 px-6 pt-3 mt-4 shrink-0 shadow-xs">
                    <button type="button" onClick={() => setIsPhysicalCountModalOpen(false)} className="btn-outline">Cancel</button>
                    <button type="submit" disabled={submitting} className="btn-primary bg-amber-600 hover:bg-amber-700">{submitting ? 'Updating...' : 'Save Physical Count'}</button>
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
                      <label className="label">Group *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['camera', 'sd_card', 'accessory'] as const).map(c => (
                          <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${form.category === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
                            {CATEGORY_LABEL[c]}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-surface-500">SD cards appear as an add-on when placing an order and are deducted from the same branch.</p>
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

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label">Total Stock</label>
                        <input readOnly type="number" className="input bg-surface-100 text-surface-500" value={editingId ? form.stock_quantity : 0} />
                        <p className="mt-1 text-[10px] text-surface-400">Use Stock In to capture quantities per location.</p>
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
