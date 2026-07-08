import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/shared/StatCard'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { CreateOrderModal } from '@/components/shared/CreateOrderModal'
import { ShoppingBag, Target, Banknote, CalendarDays, ArrowRight, Trophy, Medal, Award } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'
import type { Order } from '@/types'

export function DSADashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    totalSales: 0,
    activeLeads: 0,
    pendingCommissions: 0,
    totalOrdersMonth: 0,
    deliveredOrdersMonth: 0,
    totalDeliveredTillDate: 0,
    totalOrdersTillDate: 0,
    totalRemittance: 0,
    percentDelivered: 0,
  })
  const [commissionStatus, setCommissionStatus] = useState({ camerasDelivered: 0, target: 30 })
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [activeLeadsList, setActiveLeadsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData(user.id)
    }
  }, [user?.id])

  const fetchDashboardData = async (userId: string) => {
    setLoading(true)
    try {
      // For dev-user, these will likely return 0/empty due to RLS, which is fine for preview.
      const { data: orders } = await supabase.from('orders').select('*').eq('dsa_id', userId)
      const { data: leads } = await supabase.from('leads').select('*').eq('dsa_id', userId).neq('status', 'converted')
      const { data: commissions } = await supabase.from('commissions').select('amount, status').eq('dsa_id', userId)

      if (orders) {
        const deliveredOrders = orders.filter(o => o.status === 'delivered')
        const sales = deliveredOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
        
        const now = new Date()
        const currentMonthOrders = orders.filter(o => {
          const d = new Date(o.created_at)
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        const currentMonthDelivered = currentMonthOrders.filter(o => o.status === 'delivered')
        
        const camerasDeliveredMonth = currentMonthDelivered.reduce((sum, o) => sum + o.quantity, 0)
        setCommissionStatus({ camerasDelivered: camerasDeliveredMonth, target: 30 })
        
        const totalDelivered = deliveredOrders.length
        const totalOrders = orders.length
        const percentDelivered = totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0

        setStats(prev => ({ 
          ...prev, 
          totalSales: sales,
          totalOrdersMonth: currentMonthOrders.length,
          deliveredOrdersMonth: currentMonthDelivered.length,
          totalDeliveredTillDate: totalDelivered,
          totalOrdersTillDate: totalOrders,
          percentDelivered: percentDelivered
        }))
        
        setAllOrders(orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        const recent = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4)
        setRecentOrders(recent)
      }

      if (leads) {
        setStats(prev => ({ ...prev, activeLeads: leads.length }))
        setActiveLeadsList(leads.slice(0, 5))
      }

      if (commissions) {
        const pending = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0)
        const paid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)
        setStats(prev => ({ ...prev, pendingCommissions: pending, totalRemittance: paid }))
      }

      // Fetch Leaderboard Preview
      const { data: allDsas } = await supabase.from('users').select('id, full_name, email').eq('role', 'dsa')
      const { data: allDeliveredOrders } = await supabase.from('orders').select('dsa_id, total_amount').eq('status', 'delivered')

      if (allDsas && allDeliveredOrders) {
        let aggregated = allDsas.map(dsa => {
          const dsaOrders = allDeliveredOrders.filter(o => o.dsa_id === dsa.id)
          const revenue = dsaOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
          return {
            id: dsa.id,
            name: dsa.full_name || dsa.email.split('@')[0],
            deliveredOrders: dsaOrders.length,
            totalRevenue: revenue
          }
        })
        aggregated.sort((a, b) => b.deliveredOrders - a.deliveredOrders || b.totalRevenue - a.totalRevenue)
        setLeaderboard(aggregated.slice(0, 5).map((e, i) => ({ ...e, rank: i + 1 })))
      }

    } catch (error) {
      console.error('Error fetching DSA dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Welcome back, {user?.full_name?.split(' ')[0]}!</h1>
          <p className="text-sm text-surface-500 mt-1">Here is your sales performance overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsOrderModalOpen(true)} className="btn-primary h-10 px-4 text-sm font-semibold">New Order</button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card h-[140px] animate-pulse bg-surface-100/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            title="Delivered Sales"
            value={formatCurrency(stats.totalSales)}
            icon={ShoppingBag}
            color="brand"
            trend={{ value: 15.2, isPositive: true }}
            delay={0.1}
          />
          <StatCard
            title="Pending Commissions"
            value={formatCurrency(stats.pendingCommissions)}
            icon={Banknote}
            color="success"
            delay={0.2}
          />
          <StatCard
            title="Active Leads"
            value={stats.activeLeads}
            icon={Target}
            color="warning"
            trend={{ value: 4.1, isPositive: true }}
            delay={0.3}
          />
        </div>
      )}

      {/* Commission Status Banner */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-5 rounded-2xl border flex items-center justify-between ${
          commissionStatus.camerasDelivered >= commissionStatus.target ? 'bg-success-50 border-success-200 text-success-800' :
          commissionStatus.camerasDelivered >= commissionStatus.target / 2 ? 'bg-warning-50 border-warning-200 text-warning-800' :
          'bg-danger-50 border-danger-200 text-danger-800'
        }`}>
          <div>
            <h3 className="font-bold text-lg">Monthly Commission Target</h3>
            <p className="text-sm opacity-90 mt-0.5 font-medium">
              {commissionStatus.camerasDelivered >= commissionStatus.target 
                ? 'Target reached! Full commission rates unlocked.' 
                : `${commissionStatus.target - commissionStatus.camerasDelivered} more cameras needed to unlock full commission.`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{commissionStatus.camerasDelivered} / {commissionStatus.target}</p>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80 mt-1">Cameras Delivered</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Actions / Reminders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-surface-900">Outstanding Leads</h2>
            <button onClick={() => window.location.href = '/app/dsa/leads'} className="text-xs font-bold text-brand-600 hover:text-brand-700">View All</button>
          </div>
          
          <div className="space-y-3 mb-8">
            {activeLeadsList.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-surface-200 rounded-xl">
                <Target className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                <p className="text-xs text-surface-500 font-medium">No outstanding leads</p>
              </div>
            ) : (
              activeLeadsList.map(lead => (
                <div key={lead.id} className="flex flex-col p-3 rounded-xl border border-surface-100 bg-surface-50 hover:border-brand-200 transition-colors cursor-pointer" onClick={() => window.location.href = '/app/dsa/leads'}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-surface-900">{lead.customer_name}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">{lead.temperature}</span>
                  </div>
                  <p className="text-xs text-surface-500">{lead.phone}</p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-surface-100 pt-6 mb-4">
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider mb-4">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            <button onClick={() => window.location.href = '/app/dsa/leads'} className="w-full flex items-center gap-3 p-3 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors font-semibold text-sm">
              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                <Target className="w-4 h-4 text-brand-600" />
              </div>
              Add New Lead
            </button>
            <button onClick={() => setIsOrderModalOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors font-semibold text-sm">
              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-orange-600" />
              </div>
              Create Order
            </button>
          </div>
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="lg:col-span-2 glass-card overflow-hidden flex flex-col"
        >
          <div className="p-5 border-b border-surface-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-surface-900">Your Recent Orders</h2>
            <button className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-5 flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">Loading orders...</div>
            ) : recentOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-surface-300" />
                </div>
                <h3 className="text-sm font-bold text-surface-900 mb-1">No orders yet</h3>
                <p className="text-xs text-surface-500 max-w-[250px]">When you place orders for your customers, they will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-xl border border-surface-100 hover:border-brand-200 hover:bg-brand-50/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-surface-900">{order.customer_name}</p>
                        <p className="text-xs text-surface-500">{order.order_number} • {formatDate(order.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-900 mb-1">{formatCurrency(order.total_amount)}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

      </div>
      
      {/* Comprehensive Analytics Report */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="glass-card overflow-hidden mt-6"
      >
        <div className="p-5 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <div>
            <h2 className="text-lg font-bold text-surface-900">Performance & Analytics</h2>
            <p className="text-sm text-surface-500">Your total metrics and remittance summary.</p>
          </div>
          <button 
            onClick={() => window.location.href = '/app/dsa/reports'}
            className="text-sm font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            View Full Report <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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
                {allOrders.slice(0, 5).map(order => (
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
        </div>
      </motion.div>

      {/* Global Leaderboard Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="glass-card overflow-hidden mt-6"
      >
        <div className="p-5 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-surface-900">Top 5 Global Agents</h2>
          </div>
          <button 
            onClick={() => window.location.href = '/app/dsa/leaderboard'}
            className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            View Leaderboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {leaderboard.map(agent => {
              const isFirst = agent.rank === 1
              const isSecond = agent.rank === 2
              const isThird = agent.rank === 3
              
              let RankIcon = null
              let rankColor = "text-surface-500 bg-surface-100"
              if (isFirst) { RankIcon = Trophy; rankColor = "text-yellow-600 bg-yellow-100" }
              else if (isSecond) { RankIcon = Medal; rankColor = "text-slate-500 bg-slate-100" }
              else if (isThird) { RankIcon = Award; rankColor = "text-amber-700 bg-amber-100" }

              return (
                <div key={agent.id} className="relative p-4 rounded-xl border border-surface-100 bg-white shadow-sm flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${rankColor}`}>
                    {RankIcon ? <RankIcon className="w-5 h-5" /> : <span className="font-bold">#{agent.rank}</span>}
                  </div>
                  <p className={`font-bold text-sm ${agent.id === user?.id ? 'text-brand-600' : 'text-surface-900'} truncate w-full`}>
                    {agent.name} {agent.id === user?.id && '(You)'}
                  </p>
                  <p className="text-xs text-surface-500 mt-1">{agent.deliveredOrders} Delivered</p>
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>
      
      <CreateOrderModal 
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSuccess={() => {
          if (user?.id) fetchDashboardData(user.id)
        }}
      />

      <MobileDashboardNav />
    </div>
  )
}
