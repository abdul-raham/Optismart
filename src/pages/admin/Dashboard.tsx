import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/shared/StatCard'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { StatCardSkeleton, TableSkeleton } from '@/components/shared/Skeletons'
import { ShoppingBag, Users, Banknote, Wrench, ArrowUpRight, Download, FileSpreadsheet, Clock, Package } from 'lucide-react'
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
      // Stock alerts come from branch counts (a branch row exists once that product was stocked there).
      const [{ data: prods }, { data: inv }, { data: locs }] = await Promise.all([
        supabase.from('products').select('id, name, min_stock_level, is_active').eq('is_active', true),
        supabase.from('product_inventory').select('product_id, location_id, quantity'),
        supabase.from('inventory_locations').select('id, name').eq('is_active', true),
      ])
      const branchName = new Map((locs ?? []).map((l: any) => [l.id, l.name]))
      const alerts = (prods ?? []).map((pr: any) => {
        const min = pr.min_stock_level || 5
        const rows = (inv ?? []).filter((i: any) => i.product_id === pr.id && branchName.has(i.location_id))
        const total = rows.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
        const low = rows.filter((i: any) => (i.quantity || 0) <= min)
          .map((i: any) => ({ branch: branchName.get(i.location_id) as string, qty: i.quantity || 0 }))
          .sort((a: any, b: any) => a.qty - b.qty)
        return { id: pr.id, name: pr.name, total, min, low, out: total === 0 }
      }).filter((a: any) => a.out || a.low.length > 0)
        .sort((a: any, b: any) => Number(b.out) - Number(a.out) || a.total - b.total)
      setLowStockProducts(alerts)

      if (orders) {
        const activeOrders = orders.filter(o => o.status !== 'cancelled')
        const deliveredOrders = orders.filter(o => o.status === 'delivered')
        const revenue = deliveredOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
        
        // Outstanding orders: pending, unassigned, in_progress, processing
        // Everything not finished yet, oldest first.
        const outstanding = orders.filter(o => !['delivered', 'completed', 'cancelled'].includes(o.status))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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

      {/* Stock alerts */}
      {lowStockProducts.length > 0 && (() => {
        const outCount = lowStockProducts.filter(a => a.out).length
        const lowCount = lowStockProducts.length - outCount
        return (
          <div className="glass-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-surface-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600"><Package className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-base font-bold text-surface-900">Stock to top up</h2>
                  <p className="text-xs text-surface-500">At or below each product's minimum, by branch.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {outCount > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{outCount} out everywhere</span>}
                {lowCount > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{lowCount} low at a branch</span>}
                <button onClick={() => navigate('/app/admin/products?tab=inventory')} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Branch stock <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <ul className="divide-y divide-surface-100">
              {lowStockProducts.slice(0, 6).map(a => (
                <li key={a.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${a.out ? 'bg-rose-500' : 'bg-amber-400'}`} />
                    <span className="truncate text-sm font-semibold text-surface-900">{a.name}</span>
                    <span className="shrink-0 text-xs text-surface-500">{a.out ? 'none in any branch' : `${a.total} in total`}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    {a.low.slice(0, 3).map((l: any) => (
                      <span key={l.branch} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${l.qty === 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                        {l.branch} · {l.qty}
                      </span>
                    ))}
                    {a.low.length > 3 && <span className="text-[11px] text-surface-500">+{a.low.length - 3} more</span>}
                    <button onClick={() => navigate(`/app/admin/products?action=stock_in&product_id=${a.id}`)}
                      className="ml-1 rounded-lg px-2 py-1 text-[11px] font-bold text-brand-600 hover:bg-brand-50">+ Stock</button>
                  </div>
                </li>
              ))}
            </ul>
            {lowStockProducts.length > 6 && (
              <button onClick={() => navigate('/app/admin/products?tab=inventory')} className="w-full border-t border-surface-100 py-2.5 text-xs font-semibold text-surface-500 hover:bg-surface-50 hover:text-surface-800">
                {lowStockProducts.length - 6} more products to top up →
              </button>
            )}
          </div>
        )
      })()}

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

      {/* Orders needing action */}
      {(() => {
        const byStatus = outstandingOrders.reduce((acc: Record<string, number>, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})
        const daysOld = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
        const stale = outstandingOrders.filter(o => daysOld(o.created_at) > 7).length
        return (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-surface-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Clock className="h-4 w-4" /></span>
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-surface-900">
                    Orders needing action
                    <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs font-bold text-surface-700">{stats.outstandingOrdersCount}</span>
                  </h2>
                  <p className="text-xs text-surface-500">
                    Not delivered yet · {formatCurrency(stats.outstandingOrdersValue)}{stale > 0 ? ` · ${stale} older than a week` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => navigate('/app/admin/orders')} className="btn-primary flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold">
                Manage orders <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {Object.keys(byStatus).length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-surface-100 px-5 py-2.5">
                {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([st, n]) => (
                  <button key={st} onClick={() => navigate(`/app/admin/orders?status=${st}`)}
                    className="rounded-full border border-surface-200 px-2.5 py-0.5 text-xs font-semibold capitalize text-surface-600 hover:border-brand-300 hover:text-brand-700">
                    {st.replace(/_/g, ' ')} <span className="text-surface-400">{n}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50/60 text-xs font-semibold uppercase tracking-wider text-surface-500">
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Waiting</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {loading ? (
                    <tr><td colSpan={5} className="py-6 text-center text-surface-400">Loading…</td></tr>
                  ) : outstandingOrders.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center font-semibold text-emerald-700">All caught up — nothing waiting.</td></tr>
                  ) : outstandingOrders.slice(0, 6).map(order => {
                    const d = daysOld(order.created_at)
                    return (
                      <tr key={order.id} className="cursor-pointer transition-colors hover:bg-surface-50" onClick={() => navigate('/app/admin/orders')}>
                        <td className="px-5 py-3 font-bold text-surface-900">{order.order_number}</td>
                        <td className="px-5 py-3 text-surface-800">{order.customer_name}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${d > 7 ? 'bg-rose-50 text-rose-700' : d > 2 ? 'bg-amber-50 text-amber-800' : 'bg-surface-100 text-surface-600'}`}>
                            {d === 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'}`}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-surface-900">{formatCurrency(order.total_amount)}</td>
                        <td className="px-5 py-3"><OrderStatusBadge status={order.status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {outstandingOrders.length > 6 && (
              <button onClick={() => navigate('/app/admin/orders')} className="w-full border-t border-surface-100 py-2.5 text-xs font-semibold text-surface-500 hover:bg-surface-50 hover:text-surface-800">
                Show all {outstandingOrders.length} →
              </button>
            )}
          </motion.div>
        )
      })()}

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
