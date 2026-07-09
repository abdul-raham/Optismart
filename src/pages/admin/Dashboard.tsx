import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/shared/StatCard'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { ShoppingBag, Users, Banknote, Wrench, ArrowUpRight, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'
import type { Order } from '@/types'

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeDSAs: 0,
    activeInstallers: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const [allOrders, setAllOrders] = useState<Order[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch Orders for revenue and count
      const { data: orders } = await supabase.from('orders').select('*, dsa:users!orders_dsa_id_fkey(full_name)')
      
      // Fetch Users for counts
      const { data: users } = await supabase.from('users').select('role, status')

      if (orders) {
        const activeOrders = orders.filter(o => o.status !== 'cancelled')
        const revenue = activeOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
        setStats(prev => ({ ...prev, totalRevenue: revenue, totalOrders: activeOrders.length }))
        setAllOrders(orders)
        const recent = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
        setRecentOrders(recent)
      }

      if (users) {
        const dsas = users.filter(u => u.role === 'dsa' && u.status === 'active').length
        const installers = users.filter(u => u.role === 'installer' && u.status === 'active').length
        setStats(prev => ({ ...prev, activeDSAs: dsas, activeInstallers: installers }))
      }

    } catch (error) {
      console.error('Error fetching admin dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const headers = ['Order Number', 'Date', 'Customer Name', 'Phone', 'Address', 'DSA', 'Status', 'Qty', 'Amount (₦)', 'Notes']
    const rows = allOrders
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(o => [
        o.order_number, formatDate(o.created_at), o.customer_name,
        o.customer_phone ?? '', o.customer_address ?? '',
        (o as any).dsa?.full_name ?? o.unregistered_dsa_name ?? 'System',
        o.status, o.quantity, o.total_amount, o.notes ?? ''
      ])
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `optismart-orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">System Overview</h1>
          <p className="text-sm text-surface-500 mt-1">Real-time metrics and operations control.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={downloadCSV} className="btn-outline h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" /> Generate Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card h-[140px] animate-pulse bg-surface-100/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={Banknote}
            color="brand"
            trend={{ value: 12.5, isPositive: true }}
            delay={0.1}
          />
          <StatCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={ShoppingBag}
            color="success"
            trend={{ value: 8.2, isPositive: true }}
            delay={0.2}
          />
          <StatCard
            title="Active Agents (DSA)"
            value={stats.activeDSAs}
            icon={Users}
            color="warning"
            delay={0.3}
          />
          <StatCard
            title="Active Installers"
            value={stats.activeInstallers}
            icon={Wrench}
            color="danger"
            delay={0.4}
          />
        </div>
      )}

      {/* Recent Orders Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-surface-900">Recent Transactions</h2>
          <button className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View All <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-50/50">
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Order ID</th>
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Customer</th>
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Date</th>
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Amount</th>
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-surface-400 text-sm">Loading orders...</td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-surface-400 text-sm">No recent orders found.</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="py-3 px-5">
                      <span className="text-sm font-semibold text-surface-900">{order.order_number}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-sm font-medium text-surface-700">{order.customer_name}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-sm text-surface-500">{formatDate(order.created_at)}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-sm font-bold text-surface-900">{formatCurrency(order.total_amount)}</span>
                    </td>
                    <td className="py-3 px-5">
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <MobileDashboardNav />
    </div>
  )
}
