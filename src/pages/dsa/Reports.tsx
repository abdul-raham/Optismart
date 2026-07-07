import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order } from '@/types'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'

export function DSAReports() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    totalOrdersMonth: 0,
    deliveredOrdersMonth: 0,
    totalDeliveredTillDate: 0,
    totalOrdersTillDate: 0,
    totalRemittance: 0,
    percentDelivered: 0,
  })
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      fetchData(user.id)
    }
  }, [user?.id])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const { data: orders } = await supabase.from('orders').select('*').eq('dsa_id', userId)
      const { data: commissions } = await supabase.from('commissions').select('amount, status').eq('dsa_id', userId)

      if (orders) {
        const deliveredOrders = orders.filter(o => o.status === 'delivered')
        
        const now = new Date()
        const currentMonthOrders = orders.filter(o => {
          const d = new Date(o.created_at)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        const currentMonthDelivered = currentMonthOrders.filter(o => o.status === 'delivered')
        
        const totalDelivered = deliveredOrders.length
        const totalOrders = orders.length
        const percentDelivered = totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0

        setStats(prev => ({ 
          ...prev, 
          totalOrdersMonth: currentMonthOrders.length,
          deliveredOrdersMonth: currentMonthDelivered.length,
          totalDeliveredTillDate: totalDelivered,
          totalOrdersTillDate: totalOrders,
          percentDelivered: percentDelivered
        }))
        
        setAllOrders(orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      }

      if (commissions) {
        const paid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)
        setStats(prev => ({ ...prev, totalRemittance: paid }))
      }
    } catch (error) {
      console.error('Error fetching DSA reports:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Analytics & Reports</h1>
          <p className="text-sm text-surface-500 mt-1">Detailed performance metrics and historical data.</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-card h-64 animate-pulse bg-surface-100/50" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl bg-brand-50 border border-brand-100">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">Orders (Month)</p>
              <p className="text-2xl font-black text-brand-900">{stats.totalOrdersMonth}</p>
            </div>
            <div className="p-4 rounded-xl bg-success-50 border border-success-100">
              <p className="text-xs font-bold text-success-600 uppercase tracking-wider mb-1">Delivered (Month)</p>
              <p className="text-2xl font-black text-success-900">{stats.deliveredOrdersMonth}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Orders</p>
              <p className="text-2xl font-black text-blue-900">{stats.totalOrdersTillDate}</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Total Delivered</p>
              <p className="text-2xl font-black text-indigo-900">{stats.totalDeliveredTillDate}</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Total Remittance</p>
              <p className="text-xl font-black text-purple-900">{formatCurrency(stats.totalRemittance)}</p>
            </div>
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">% Delivered</p>
              <p className="text-2xl font-black text-orange-900">{stats.percentDelivered}%</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-5 border-b border-surface-100 bg-surface-50">
              <h2 className="text-lg font-bold text-surface-900">All Historical Orders</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-50 border-y border-surface-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Date</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Order Number</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Customer Name</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {allOrders.map(order => (
                    <tr key={order.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3 text-surface-600">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-surface-900">{order.order_number}</td>
                      <td className="px-4 py-3 text-surface-900">{order.customer_name}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 font-bold text-brand-700 text-right">{formatCurrency(order.total_amount)}</td>
                    </tr>
                  ))}
                  {allOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-surface-500">No orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      <MobileDashboardNav />
    </div>
  )
}
