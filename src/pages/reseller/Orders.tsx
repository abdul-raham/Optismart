import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Package, Search, Calendar, ChevronRight } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { useAuthStore } from '@/stores/authStore'
import type { Order } from '@/types'

export function ResellerOrders() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (user?.id) fetchOrders(user.id)
  }, [user?.id])

  const fetchOrders = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('reseller_id', userId)
        .order('created_at', { ascending: false })
      
      if (data) setOrders(data as Order[])
    } catch (err) {
      console.error('Error fetching reseller orders:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(o => 
    o.order_number?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Order Tracking</h1>
          <p className="text-sm text-surface-500 mt-1">Track and manage your wholesale bulk orders.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search order number..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full transition-all"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center animate-pulse bg-surface-50/50">
            <div className="text-surface-400 text-sm font-semibold">Loading orders...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 mb-2">No orders found</h3>
            <p className="text-surface-500 max-w-md">You haven't placed any bulk orders yet.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50/50 border-b border-surface-100">
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider">Order ID</th>
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider">Date</th>
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider">Amount</th>
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-surface-50/50 transition-colors group">
                    <td className="py-4 px-5">
                      <div className="font-bold text-surface-900">{order.order_number}</div>
                      <div className="text-xs text-surface-500 mt-0.5">Bulk Purchase</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-sm font-semibold text-surface-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-surface-400" />
                        {formatDate(order.created_at)}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-sm font-bold text-surface-900">{formatCurrency(order.total_amount)}</div>
                    </td>
                    <td className="py-4 px-5">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors inline-flex items-center">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-surface-100">
              {filteredOrders.map(order => (
                <div key={order.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-surface-900 text-sm">{order.order_number}</div>
                      <div className="text-xs text-surface-500 mt-0.5">Bulk Purchase</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-brand-700">{formatCurrency(order.total_amount)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-surface-50 pt-3">
                    <OrderStatusBadge status={order.status} />
                    <div className="text-xs font-semibold text-surface-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(order.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
