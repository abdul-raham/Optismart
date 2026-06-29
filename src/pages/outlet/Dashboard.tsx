import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package, TrendingUp, DollarSign, Store, ShoppingBag, Plus } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { OrderStatusBadge } from '@/components/shared/Badges'

const inventory = [
  { id:'1', name:'CCTV Starter Kit', stock: 12, min_stock: 5, price: 120000 },
  { id:'2', name:'CCTV Pro Kit', stock: 4, min_stock: 5, price: 380000 },
  { id:'3', name:'PTZ Camera Unit', stock: 8, min_stock: 3, price: 150000 },
]

const recentSales = [
  { id:'1', receipt:'RCPT-001', item:'CCTV Starter Kit', amount:120000, date:'2025-06-18T10:30:00Z', status:'delivered' as const },
  { id:'2', receipt:'RCPT-002', item:'PTZ Camera Unit', amount:150000, date:'2025-06-17T14:00:00Z', status:'delivered' as const },
  { id:'3', receipt:'RCPT-003', item:'CCTV Pro Kit', amount:380000, date:'2025-06-16T09:00:00Z', status:'delivered' as const },
]

export function OutletDashboard() {
  const { user } = useAuthStore()

  const stats = {
    todaySales: 120000,
    monthSales: 1850000,
    lowStock: inventory.filter(i => i.stock <= i.min_stock).length,
    totalOrders: 45
  }

  return (
    <div>
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-gradient rounded-2xl p-6 mb-8 relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-40 h-40 rounded-full bg-white/10 -translate-y-10 translate-x-10" />
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-1">Store Dashboard,</p>
          <h1 className="text-2xl font-bold text-white mb-3">{user?.full_name ?? 'Outlet Manager'} 🏪</h1>
          <p className="text-white/70 text-sm">
            You have <span className="text-white font-semibold">{stats.lowStock} items</span> low on stock.
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Today's Sales" value={stats.todaySales} icon={DollarSign} color="success" prefix="₦" delay={0} />
        <StatCard title="Monthly Sales" value={stats.monthSales} icon={TrendingUp} color="brand" prefix="₦" delay={0.05} />
        <StatCard title="Low Stock Items" value={stats.lowStock} icon={Package} color="danger" delay={0.1} />
        <StatCard title="Total Orders" value={stats.totalOrders} icon={ShoppingBag} color="brand" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Point of Sale / Recent */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-card border border-surface-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-800 flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-500" /> Recent Store Sales
            </h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-semibold hover:bg-brand-100 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Sale
            </button>
          </div>
          <div className="divide-y divide-surface-50">
            {recentSales.map((sale) => (
              <div key={sale.id} className="px-6 py-4 hover:bg-surface-50 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-surface-800">{sale.item}</p>
                  <p className="text-xs text-surface-400 font-mono mt-0.5">{sale.receipt} · {formatDate(sale.date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-surface-900">{formatCurrency(sale.amount)}</p>
                  <div className="mt-1"><OrderStatusBadge status={sale.status} /></div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Inventory Status */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl shadow-card border border-surface-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-800">Inventory Status</h3>
            <button className="text-sm text-brand-600 hover:text-brand-700 font-medium">Request Stock</button>
          </div>
          <div className="p-6 space-y-4">
            {inventory.map((item) => {
              const isLow = item.stock <= item.min_stock
              const pct = Math.min(100, Math.round((item.stock / 20) * 100)) // Assuming max capacity 20 for visual
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-surface-800">{item.name}</span>
                    <span className={`text-sm font-bold ${isLow ? 'text-danger-500' : 'text-surface-600'}`}>
                      {item.stock} in stock
                    </span>
                  </div>
                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.4, duration: 0.8 }}
                      className={`h-full rounded-full ${isLow ? 'bg-danger-500' : 'bg-success-500'}`}
                    />
                  </div>
                  {isLow && <p className="text-xs text-danger-500 mt-1.5 font-medium">Low stock! Minimum required is {item.min_stock}.</p>}
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
