import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { ShoppingBag, Plus, Search, Calendar, MapPin, X, Package } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { OrderStatusBadge } from '@/components/shared/Badges'
import type { Order, Product } from '@/types'

export function DSAOrders() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dsas, setDsas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    dsa_id: user?.id || '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    product_id: '',
    quantity: 1,
    amount: 0,
    installation_needed: false,
    installation_price: 0,
    expected_delivery_date: '',
    notes: '',
  })

  useEffect(() => {
    if (user?.id) {
      fetchData()
    }
  }, [user?.id])

  const fetchData = async () => {
    try {
      const [ordersRes, productsRes, dsasRes] = await Promise.all([
        supabase.from('orders').select('*').eq('dsa_id', user?.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('users').select('id, full_name, email').eq('role', 'dsa')
      ])
      
      if (ordersRes.data) setOrders(ordersRes.data)
      if (productsRes.data) setProducts(productsRes.data)
      if (dsasRes.data) setDsas(dsasRes.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !form.product_id) return
    
    setSubmitting(true)
    try {
      const product = products.find(p => p.id === form.product_id)
      if (!product) throw new Error('Product not found')

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`
      const productTotal = form.amount > 0 ? form.amount : Number(product.retail_price) * form.quantity
      const totalAmount = productTotal + (form.installation_needed ? form.installation_price : 0)

      const { data, error } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          dsa_id: form.dsa_id || user.id,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          product_id: form.product_id,
          quantity: form.quantity,
          unit_price: product.retail_price,
          total_amount: totalAmount,
          installation_needed: form.installation_needed,
          installation_price: form.installation_needed ? form.installation_price : 0,
          expected_delivery_date: form.expected_delivery_date || null,
          status: 'pending',
          notes: form.notes
        }])
        .select()
        .single()

      if (error) throw error
      if (data) {
        setOrders([data, ...orders])
        setIsModalOpen(false)
        setForm({ dsa_id: user?.id || '', customer_name: '', customer_phone: '', customer_address: '', product_id: '', quantity: 1, amount: 0, installation_needed: false, installation_price: 0, expected_delivery_date: '', notes: '' })
      }
    } catch (err) {
      console.error('Error creating order:', err)
      alert('Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredOrders = orders.filter(o => 
    o.customer_name.toLowerCase().includes(search.toLowerCase()) || 
    o.order_number.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Orders Management</h1>
          <p className="text-sm text-surface-500 mt-1">Create and track your customer orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search orders..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-64 transition-all"
            />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card h-64 animate-pulse bg-surface-100/50" />
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No orders found</h3>
          <p className="text-surface-500 max-w-md">You haven't processed any orders yet. Click "New Order" to make your first sale!</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary mt-6">Create Order</button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50/50">
                  <th className="py-4 px-6 text-xs font-semibold text-surface-500 uppercase tracking-wider">Order Details</th>
                  <th className="py-4 px-6 text-xs font-semibold text-surface-500 uppercase tracking-wider">Customer</th>
                  <th className="py-4 px-6 text-xs font-semibold text-surface-500 uppercase tracking-wider">Amount</th>
                  <th className="py-4 px-6 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-semibold text-surface-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                <AnimatePresence>
                  {filteredOrders.map(order => (
                    <motion.tr 
                      key={order.id}
                      layout
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="hover:bg-surface-50/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <p className="text-sm font-bold text-surface-900">{order.order_number}</p>
                        <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> {formatDate(order.created_at)}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-medium text-surface-900">{order.customer_name}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{order.customer_phone}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-bold text-surface-900">{formatCurrency(order.total_amount)}</p>
                        <p className="text-xs text-surface-500 mt-0.5">Qty: {order.quantity}</p>
                      </td>
                      <td className="py-4 px-6">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="py-4 px-6 text-right">
                        {order.status === 'pending' && (
                          <button className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
                            Book Installer
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-surface-100">
            <AnimatePresence>
              {filteredOrders.map(order => (
                <motion.div 
                  key={order.id}
                  layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-brand-600">{order.order_number}</p>
                      <p className="text-sm font-medium text-surface-900 mt-1">{order.customer_name}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{order.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-900">{formatCurrency(order.total_amount)}</p>
                      <p className="text-xs text-surface-500 mt-0.5">Qty: {order.quantity}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-surface-50 pt-3">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-xs text-surface-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(order.created_at)}
                    </span>
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex justify-end pt-2">
                      <button className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
                        Book Installer
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
              onClick={() => !submitting && setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-card-xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50/50">
                <h2 className="text-lg font-bold text-surface-900">Create New Order</h2>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="text-surface-400 hover:text-surface-900 transition-colors p-1 rounded-md hover:bg-surface-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="label">DSA In Charge *</label>
                  <div className="relative">
                    <select required className="input" value={form.dsa_id} onChange={e => setForm({...form, dsa_id: e.target.value})}>
                      <option value="">Select a DSA</option>
                      {dsas.map(dsa => (
                        <option key={dsa.id} value={dsa.id}>{dsa.full_name} ({dsa.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Customer Name *</label>
                  <input required type="text" className="input" placeholder="e.g. John Smith" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} />
                </div>
                
                <div>
                  <label className="label">Customer Phone *</label>
                  <input required type="tel" className="input" placeholder="080..." value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value.replace(/[^\d+]/g, '')})} />
                </div>

                <div>
                  <label className="label">Delivery Address *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-surface-400" />
                    <textarea required rows={2} className="input pl-10" placeholder="Full delivery address" value={form.customer_address} onChange={e => setForm({...form, customer_address: e.target.value})} />
                  </div>
                </div>

                <div className="border-t border-surface-100 pt-4">
                  <label className="label">Select Model / Product *</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                    <select required className="input pl-10" value={form.product_id} onChange={e => {
                      const pId = e.target.value
                      const p = products.find(prod => prod.id === pId)
                      setForm({...form, product_id: pId, amount: p ? p.retail_price * form.quantity : 0})
                    }}>
                      <option value="">Select a product model</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.retail_price)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Quantity *</label>
                    <input required type="number" min={1} className="input" value={form.quantity} onChange={e => {
                      const qty = parseInt(e.target.value) || 1
                      const p = products.find(prod => prod.id === form.product_id)
                      setForm({...form, quantity: qty, amount: p ? p.retail_price * qty : form.amount})
                    }} />
                  </div>
                  <div>
                    <label className="label">Product Amount (₦)</label>
                    <input type="number" min={0} className="input" value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="border-t border-surface-100 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="label mb-0">Is Installation Needed?</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.installation_needed}
                      onClick={() => setForm({...form, installation_needed: !form.installation_needed})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.installation_needed ? 'bg-brand-500' : 'bg-surface-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.installation_needed ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  
                  {form.installation_needed && (
                    <div className="mb-4">
                      <label className="label">Installation Price (₦) *</label>
                      <input required type="number" min={0} className="input" value={form.installation_price} onChange={e => setForm({...form, installation_price: Number(e.target.value)})} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Expected Delivery Date</label>
                  <input type="date" className="input" value={form.expected_delivery_date} onChange={e => setForm({...form, expected_delivery_date: e.target.value})} />
                </div>

                <div>
                  <label className="label">Additional Notes</label>
                  <textarea rows={2} className="input resize-none" placeholder="Special instructions?" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting} className="btn-outline">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary w-36 flex items-center justify-center">
                    {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Order'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
