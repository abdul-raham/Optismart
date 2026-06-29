import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Package, User, Phone, MapPin, Building2, CheckCircle2, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { useAuthStore } from '@/stores/authStore'
import type { Product } from '@/types'

interface CreateOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const { user } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingProducts, setFetchingProducts] = useState(true)

  // Form State
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Payment Flow State
  const [showPayment, setShowPayment] = useState(false)
  const [createdOrderNumber, setCreatedOrderNumber] = useState('')
  const [createdOrderAmount, setCreatedOrderAmount] = useState(0)
  const [systemSettings, setSystemSettings] = useState({ moniepointAccountName: '', moniepointAccountNumber: '' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchProducts()
    }
  }, [isOpen])

  const fetchProducts = async () => {
    setFetchingProducts(true)
    try {
      const { data } = await supabase.from('products').select('*').eq('is_active', true)
      if (data) {
        setProducts(data)
        if (data.length > 0) setSelectedProductId(data[0].id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setFetchingProducts(false)
    }
  }

  const fetchSystemSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').eq('id', 'default').single()
      if (data) {
        setSystemSettings({
          moniepointAccountName: data.moniepoint_account_name,
          moniepointAccountNumber: data.moniepoint_account_number
        })
      }
    } catch (err) {
      console.error('Error fetching system settings:', err)
    }
  }

  useEffect(() => {
    if (isOpen) fetchSystemSettings()
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!user) throw new Error('Not authenticated')
      
      const product = products.find(p => p.id === selectedProductId)
      if (!product) throw new Error('Please select a product')

      const unitPrice = product.retail_price
      const totalAmount = unitPrice * quantity
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`

      const { error: insertError } = await supabase.from('orders').insert({
        order_number: orderNumber,
        dsa_id: user.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        product_id: product.id,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        status: 'pending'
      })

      if (insertError) throw insertError

      // Trigger email notification in background
      sendEmail('new_order', {
        recipientEmail: user.email,
        orderNumber: orderNumber,
        customerName: customerName
      }, { onError: (e) => console.warn('Email failed:', e) })

      setCreatedOrderNumber(orderNumber)
      setCreatedOrderAmount(totalAmount)
      setShowPayment(true)
    } catch (err: any) {
      setError(err.message || 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const handleFinishPayment = () => {
    onSuccess()
    onClose()
    setShowPayment(false)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerAddress('')
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  const selectedProduct = products.find(p => p.id === selectedProductId)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-visible"
        >
          <div className="flex items-center justify-between p-6 border-b border-surface-100 bg-surface-50">
            <h2 className="text-xl font-bold text-surface-900">
              {showPayment ? 'Complete Payment' : 'Create New Order'}
            </h2>
            <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {showPayment ? (
            <div className="p-8 flex flex-col items-center">
              <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-success-600" />
              </div>
              <h3 className="text-xl font-bold text-surface-900 text-center mb-2">Order Created!</h3>
              <p className="text-surface-500 text-center mb-6">
                Order <span className="font-bold text-surface-900">#{createdOrderNumber}</span> is pending. Please make a bank transfer to process this order.
              </p>

              <div className="w-full bg-surface-50 border border-surface-200 rounded-2xl p-6 space-y-4 mb-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500" />
                <div className="flex items-center justify-between border-b border-surface-200 pb-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-surface-400" />
                    <div>
                      <p className="text-xs text-surface-500 font-semibold uppercase tracking-wider">Bank Name</p>
                      <p className="font-bold text-surface-900">Moniepoint Microfinance Bank</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-surface-200 pb-4">
                  <div>
                    <p className="text-xs text-surface-500 font-semibold uppercase tracking-wider">Account Name</p>
                    <p className="font-bold text-surface-900">{systemSettings.moniepointAccountName || 'Optismart Networks Ltd'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-xs text-surface-500 font-semibold uppercase tracking-wider">Account Number</p>
                    <p className="text-2xl font-black text-brand-700 tracking-wider font-mono">
                      {systemSettings.moniepointAccountNumber || '1234567890'}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleCopy(systemSettings.moniepointAccountNumber || '1234567890')}
                    className="p-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-700 transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="text-sm font-bold">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-warning-50 text-warning-800 p-4 rounded-xl text-sm font-medium mb-8 w-full border border-warning-200 text-center">
                Transfer exactly <strong>₦{createdOrderAmount.toLocaleString()}</strong> to the account above.
              </div>

              <button 
                onClick={handleFinishPayment} 
                className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-brand flex items-center justify-center gap-2 transition-colors"
              >
                I have made the transfer
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="p-3 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-100 rounded-xl">
                  {error}
                </div>
              )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1.5">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input required type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition-all" placeholder="John Doe" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input required type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/[^\d+]/g, ''))} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition-all" placeholder="+234..." />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1.5">Installation Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-surface-400" />
                  <textarea required value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} rows={3} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition-all resize-none" placeholder="Full address for installer..." />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-surface-700 mb-1.5">Product</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <select disabled={fetchingProducts} value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition-all appearance-none bg-white">
                      {fetchingProducts ? <option>Loading products...</option> : products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-surface-700 mb-1.5">Quantity</label>
                  <input required type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition-all text-center" />
                </div>
              </div>
            </div>

            {selectedProduct && (
              <div className="bg-surface-50 p-4 rounded-xl border border-surface-100 flex justify-between items-center mt-2">
                <span className="text-sm font-semibold text-surface-600">Total Amount:</span>
                <span className="text-xl font-black text-brand-700">₦{(selectedProduct.retail_price * quantity).toLocaleString()}</span>
              </div>
            )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-bold text-surface-700 hover:bg-surface-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-brand flex items-center justify-center gap-2 transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Order'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
