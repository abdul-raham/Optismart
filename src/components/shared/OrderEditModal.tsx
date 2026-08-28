import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Package, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { Order, Product } from '@/types'

interface OrderEditModalProps {
  order: Order | null
  products: Product[]
  onClose: () => void
  onSaved: (order: Order) => void
}

const emptyForm = {
  customer_name: '', customer_email: '', customer_phone: '', customer_address: '',
  product_id: '', quantity: 1, total_amount: 0, installation_needed: false,
  installation_price: 0, expected_delivery_date: '', notes: '',
}

export function OrderEditModal({ order, products, onClose, onSaved }: OrderEditModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!order) return
    setForm({
      customer_name: order.customer_name,
      customer_email: order.customer_email || '',
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      product_id: order.product_id,
      quantity: order.quantity,
      total_amount: Number(order.total_amount),
      installation_needed: order.installation_needed,
      installation_price: Number(order.installation_price),
      expected_delivery_date: order.expected_delivery_date || '',
      notes: order.notes || '',
    })
    setError('')
  }, [order])

  const close = () => {
    if (!submitting) onClose()
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!order) return
    setSubmitting(true)
    setError('')

    try {
      const product = products.find(item => item.id === form.product_id)
      if (!product) throw new Error('Select a valid product.')

      const { data, error: saveError } = await supabase
        .from('orders')
        .update({
          customer_name: form.customer_name.trim(),
          customer_email: form.customer_email.trim() || null,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address.trim(),
          product_id: form.product_id,
          quantity: form.quantity,
          unit_price: product.retail_price,
          unit_cost: product.cost_price || 0,
          total_amount: form.total_amount,
          installation_needed: form.installation_needed,
          installation_price: form.installation_needed ? form.installation_price : 0,
          expected_delivery_date: form.expected_delivery_date || null,
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select()
        .single()

      if (saveError) throw saveError
      onSaved({ ...order, ...data } as Order)
      onClose()
    } catch (err: any) {
      console.error('Failed to edit order:', err)
      setError(err?.message || 'Failed to save order changes.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {order && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
          <motion.div key="order-edit-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={close} />
          <motion.div key="order-edit-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative z-10 my-auto flex max-h-[calc(100vh-2rem)] sm:max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-card-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-surface-100 bg-surface-50/50 px-6 py-4">
              <div><h2 className="text-lg font-bold text-surface-900">Edit Order</h2><p className="mt-0.5 text-xs text-surface-500">{order.order_number}</p></div>
              <button type="button" onClick={close} className="rounded-md p-1 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-900"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div><label className="label">Customer Name *</label><input required className="input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><label className="label">Customer Phone *</label><input required type="tel" className="input" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value.replace(/[^\d+]/g, '') })} /></div>
                  <div><label className="label">Customer Email</label><input type="email" className="input" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
                </div>
                <div><label className="label">Delivery Address *</label><div className="relative"><MapPin className="absolute left-3 top-3 h-5 w-5 text-surface-400" /><textarea required rows={2} className="input pl-10" value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} /></div></div>
                <div className="border-t border-surface-100 pt-4"><label className="label">Product *</label><div className="relative"><Package className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-400" /><select required className="input pl-10" value={form.product_id} onChange={e => { const product = products.find(item => item.id === e.target.value); setForm({ ...form, product_id: e.target.value, total_amount: product ? Number(product.retail_price) * form.quantity : form.total_amount }) }}><option value="">Select a product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} — {formatCurrency(product.retail_price)}</option>)}</select></div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Quantity *</label><input required type="number" min={1} className="input" value={form.quantity} onChange={e => { const quantity = Math.max(1, Number(e.target.value) || 1); const product = products.find(item => item.id === form.product_id); setForm({ ...form, quantity, total_amount: product ? Number(product.retail_price) * quantity : form.total_amount }) }} /></div>
                  <div><label className="label">Total Amount (₦) *</label><input required type="number" min={0} className="input" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: Number(e.target.value) })} /></div>
                </div>
                <div className="border-t border-surface-100 pt-4"><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={form.installation_needed} onChange={e => setForm({ ...form, installation_needed: e.target.checked })} className="h-5 w-5 rounded border-surface-300 text-brand-600 focus:ring-brand-500" /><span className="label mb-0">Installation Needed</span></label>{form.installation_needed && <div className="mt-3"><label className="label">Installation Price (₦)</label><input type="number" min={0} className="input" value={form.installation_price} onChange={e => setForm({ ...form, installation_price: Number(e.target.value) })} /></div>}</div>
                <div><label className="label">Expected Delivery Date</label><input type="date" className="input" value={form.expected_delivery_date} onChange={e => setForm({ ...form, expected_delivery_date: e.target.value })} /></div>
                <div><label className="label">Notes</label><textarea rows={2} className="input resize-none" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                {error && <div role="alert" className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-700">{error}</div>}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-surface-100 bg-white px-6 py-4"><button type="button" onClick={close} disabled={submitting} className="btn-outline">Cancel</button><button type="submit" disabled={submitting} className="btn-primary flex w-36 items-center justify-center">{submitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Save Changes'}</button></div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.getElementById('modal-root') || document.body,
  )
}
