import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/shared/StatCard'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { StatCardSkeleton, TableSkeleton } from '@/components/shared/Skeletons'
import { ShoppingBag, Users, Banknote, Wrench, ArrowUpRight, Download, FileSpreadsheet, AlertTriangle, Clock, Plus } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'
import { exportToExcel, exportToCSV } from '@/utils/exportUtils'
import type { Order } from '@/types'

export function AdminDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isSuperAdmin = user?.role === 'super_admin'

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeDSAs: 0,
    activeInstallers: 0,
    outstandingOrdersCount: 0,
    outstandingOrdersValue: 0
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [outstandingOrders, setOutstandingOrders] = useState<Order[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [allOrders, setAllOrders] = useState<Order[]>([])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch Orders for revenue and count
      const { data: orders } = await supabase.from('orders').select('*, dsa:users!orders_dsa_id_fkey(full_name)')
      
      // Fetch Users for counts
      const { data: users } = await supabase.from('users').select('role, status')

      // Fetch Low Stock Products (stock <= 5)
      const { data: lowStock } = await supabase.from('products').select('id, name, stock_quantity').lte('stock_quantity', 5)
      if (lowStock) setLowStockProducts(lowStock)

      if (orders) {
        const activeOrders = orders.filter(o => o.status !== 'cancelled')
        const deliveredOrders = orders.filter(o => o.status === 'delivered')
        const revenue = deliveredOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
        
        // Outstanding orders: pending, unassigned, in_progress, processing
        const outstanding = orders.filter(o => ['pending', 'unassigned', 'in_progress', 'processing'].includes(o.status))
        const outstandingVal = outstanding.reduce((sum, o) => sum + Number(o.total_amount), 0)

        setStats(prev => ({
          ...prev,
          totalRevenue: revenue,
          totalOrders: activeOrders.length,
          outstandingOrdersCount: outstanding.length,
          outstandingOrdersValue: outstandingVal
        }))
        setAllOrders(orders)
        setOutstandingOrders(outstanding)

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

  useEffect(() => {
    fetchDashboardData()

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const getExportData = () => {
    return allOrders
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(o => ({
        'Order Number': o.order_number,
        'Date': formatDate(o.created_at),
        'Customer Name': o.customer_name,
        'Phone': o.customer_phone ?? '',
        'Address': o.customer_address ?? '',
        'DSA': (o as any).dsa?.full_name ?? o.unregistered_dsa_name ?? 'System',
        'Status': o.status,
        'Qty': o.quantity,
        'Amount (₦)': o.total_amount,
        'Notes': o.notes ?? ''
      }))
  }

  const handleExportExcel = () => {
    exportToExcel({
      filename: 'optismart-orders-overview',
      sheetTitle: 'System Orders Overview',
      reportSubHeading: `Total Orders: ${allOrders.length}`,
      data: getExportData()
    })
  }

  const handleExportCSV = () => {
    exportToCSV(getExportData(), 'optismart-orders-overview')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">System Overview</h1>
          <p className="text-sm text-surface-500 mt-1">Real-time metrics and operations control.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button onClick={handleExportExcel} className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={handleExportCSV} className="btn-outline h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* 🚨 Low Stock Warning Alert Banner for Admin 🚨 */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Low Inventory Warning ({lowStockProducts.length} Camera{lowStockProducts.length > 1 ? 's' : ''} at or below 5 units)
              </h3>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                {lowStockProducts.map(p => `${p.name} (${p.stock_quantity} left)`).join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/app/admin/products?action=stock_in&product_id=${lowStockProducts[0]?.id}`)}
            className="btn-primary h-9 px-4 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Top Up Stock Now
          </button>
        </div>
      )}

      {loading ? (
        <StatCardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue visible ONLY to super_admin; admin sees Outstanding Orders Value */}
          {isSuperAdmin ? (
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats.totalRevenue)}
              icon={Banknote}
              color="brand"
              trend={{ value: 12.5, isPositive: true }}
              delay={0.1}
            />
          ) : (
            <StatCard
              title="Outstanding Orders Value"
              value={formatCurrency(stats.outstandingOrdersValue)}
              icon={Clock}
              color="warning"
              delay={0.1}
            />
          )}

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

      {/* PRIORITY: Outstanding Orders Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden border-2 border-amber-300/80 shadow-md"
      >
        <div className="flex flex-col gap-3 border-b border-amber-200/80 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950 flex items-center gap-2">
                Outstanding Orders Needing Action ({stats.outstandingOrdersCount})
              </h2>
              <p className="text-xs text-amber-800 font-medium">Orders pending assignment, dispatch, or confirmation.</p>
            </div>
          </div>
          <button onClick={() => window.location.href = '/app/admin/orders'} className="btn-sm bg-amber-600 hover:bg-amber-700 text-white font-bold">
            Manage Orders <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-50/60 text-surface-500 text-xs uppercase tracking-wider font-semibold border-b border-surface-100">
                <th className="py-3 px-5">Order #</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Amount</th>
                <th className="py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-surface-400">Loading outstanding orders...</td>
                </tr>
              ) : outstandingOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-emerald-700 bg-emerald-50/50 font-semibold">
                    All caught up. No pending or unassigned orders.
                  </td>
                </tr>
              ) : (
                outstandingOrders.slice(0, 6).map((order) => (
                  <tr key={order.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-5 font-bold text-surface-900">{order.order_number}</td>
                    <td className="py-3 px-5 font-medium text-surface-800">{order.customer_name}</td>
                    <td className="py-3 px-5 text-surface-500">{formatDate(order.created_at)}</td>
                    <td className="py-3 px-5 font-bold text-surface-900">{formatCurrency(order.total_amount)}</td>
                    <td className="py-3 px-5"><OrderStatusBadge status={order.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Recent Orders Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-surface-900">Recent Transactions</h2>
          <button onClick={() => window.location.href = '/app/admin/orders'} className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View All <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse">
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
