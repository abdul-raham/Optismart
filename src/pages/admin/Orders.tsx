import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, Search, Calendar, Check, X, ArrowRightLeft } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { AssignInstallerModal } from '@/components/shared/AssignInstallerModal'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'
import type { Order, OrderStatus } from '@/types'

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null)
  
  // A simple mapping for the allowed status transitions in the lifecycle
  const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing'],
    processing: ['dispatched'],
    dispatched: ['delivered'],
    delivered: [],
    cancelled: []
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, dsa:users!orders_dsa_id_fkey(email, full_name)')
        .order('created_at', { ascending: false })
      
      if (data) setOrders(data)
    } catch (err) {
      console.error('Error fetching admin orders:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)

      if (error) throw error
      
      const updatedOrder = orders.find(o => o.id === orderId)
      
      // Send Notifications to DSA
      if (updatedOrder?.dsa_id) {
        const dsa = (updatedOrder as any).dsa;
        if (dsa?.email) {
          sendEmail('order_status_update', {
            recipientEmail: dsa.email,
            customerName: updatedOrder.customer_name,
            orderNumber: updatedOrder.order_number,
            status: newStatus
          }).catch(console.error);
        }
        sendWebPush(
          updatedOrder.dsa_id,
          'Order Status Updated',
          `Order ${updatedOrder.order_number} for ${updatedOrder.customer_name} is now ${newStatus.toUpperCase()}`,
          '/app/dsa/orders'
        ).catch(console.error);
      }

      // Update local state
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
      
      // NOTE: In production, Supabase Edge Functions or Triggers would catch the 'delivered' status 
      // and automatically write to the `commissions` table for the DSA.
    } catch (err) {
      console.error('Failed to update status:', err)
      alert('Failed to update order status')
    } finally {
      setUpdating(null)
    }
  }

  const filteredOrders = orders.filter(o => 
    o.customer_name.toLowerCase().includes(search.toLowerCase()) || 
    o.order_number.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">System Orders</h1>
          <p className="text-sm text-surface-500 mt-1">Manage all orders and update their lifecycle status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by ID or customer..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card h-64 animate-pulse bg-surface-100/50" />
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No orders found</h3>
          <p className="text-surface-500 max-w-md">No matching orders currently exist in the system.</p>
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
                  <th className="py-4 px-6 text-xs font-semibold text-surface-500 uppercase tracking-wider text-right">Lifecycle Actions</th>
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
                        <p className="text-sm font-bold text-brand-600">{order.order_number}</p>
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
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {updating === order.id ? (
                            <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                          ) : (
                            allowedTransitions[order.status].map(nextStatus => (
                              <button
                                key={nextStatus}
                                onClick={() => handleUpdateStatus(order.id, nextStatus)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                                  nextStatus === 'cancelled' 
                                    ? 'bg-white border-surface-200 text-danger-600 hover:border-danger-200 hover:bg-danger-50'
                                    : nextStatus === 'delivered'
                                      ? 'bg-success-50 border-success-200 text-success-700 hover:bg-success-100'
                                      : 'bg-white border-surface-200 text-brand-600 hover:border-brand-200 hover:bg-brand-50'
                                }`}
                              >
                                {nextStatus === 'cancelled' ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                Mark {nextStatus}
                              </button>
                            ))
                          )}
                          {(order.status === 'confirmed' || order.status === 'processing') && !updating && (
                            <button
                              onClick={() => setAssigningOrderId(order.id)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100 transition-colors flex items-center gap-1"
                            >
                              Assign
                            </button>
                          )}
                        </div>
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

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    {updating === order.id ? (
                      <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                    ) : (
                      allowedTransitions[order.status].map(nextStatus => (
                        <button
                          key={nextStatus}
                          onClick={() => handleUpdateStatus(order.id, nextStatus)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                            nextStatus === 'cancelled' 
                              ? 'bg-white border-surface-200 text-danger-600 hover:border-danger-200 hover:bg-danger-50'
                              : nextStatus === 'delivered'
                                ? 'bg-success-50 border-success-200 text-success-700 hover:bg-success-100'
                                : 'bg-white border-surface-200 text-brand-600 hover:border-brand-200 hover:bg-brand-50'
                          }`}
                        >
                          {nextStatus === 'cancelled' ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                          Mark {nextStatus}
                        </button>
                      ))
                    )}
                    {(order.status === 'confirmed' || order.status === 'processing') && !updating && (
                      <button
                        onClick={() => setAssigningOrderId(order.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100 transition-colors flex items-center gap-1"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

        <AssignInstallerModal 
          isOpen={!!assigningOrderId} 
          onClose={() => setAssigningOrderId(null)} 
          onSuccess={fetchOrders}
          order={orders.find(o => o.id === assigningOrderId) || null}
        />
    </div>
  )
}
