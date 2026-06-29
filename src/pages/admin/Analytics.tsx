import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { BarChart3, TrendingUp, Users, Target, Activity } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts'

export function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<any[]>([])
  const [dsaRankings, setDsaRankings] = useState<any[]>([])

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      // Fetch orders to process sales trends
      const { data: orders } = await supabase.from('orders').select('total_amount, created_at, status, dsa_id')
      const { data: users } = await supabase.from('users').select('id, full_name').eq('role', 'dsa')

      if (orders && users) {
        // Process last 7 days sales trend
        const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (6 - i))
          return d.toISOString().split('T')[0]
        })

        const trendData = last7Days.map(date => {
          const dayOrders = orders.filter(o => o.status === 'delivered' && o.created_at.startsWith(date))
          const revenue = dayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
          return {
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            revenue: revenue,
            orders: dayOrders.length
          }
        })
        setSalesData(trendData)

        // Process DSA Rankings (Top 5)
        const rankings = users.map(user => {
          const userOrders = orders.filter(o => o.dsa_id === user.id && o.status === 'delivered')
          const totalRevenue = userOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
          return {
            name: user.full_name,
            sales: userOrders.length,
            revenue: totalRevenue
          }
        }).sort((a, b) => b.sales - a.sales).slice(0, 5)

        setDsaRankings(rankings)
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">System Analytics</h1>
          <p className="text-sm text-surface-500 mt-1">Deep dive into revenue, agent performance, and metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Trend Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-600" /> 7-Day Revenue Trend
            </h2>
          </div>
          
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="w-full h-full bg-surface-50/50 rounded-xl animate-pulse" />
            ) : salesData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-surface-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₦${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* DSA Rankings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1 glass-card p-6 flex flex-col">
          <h2 className="text-base font-bold text-surface-900 mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" /> Top Sales Agents
          </h2>
          
          <div className="flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-surface-50/50 rounded-lg animate-pulse" />)}
              </div>
            ) : dsaRankings.length === 0 ? (
               <div className="text-center text-surface-400">No agent sales yet</div>
            ) : (
              <div className="space-y-4">
                {dsaRankings.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-surface-200 text-surface-700' :
                        i === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-surface-50 text-surface-500'
                      }`}>
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-surface-900">{agent.name}</p>
                        <p className="text-[10px] text-surface-500 uppercase tracking-wider">{agent.sales} units delivered</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-600">{formatCurrency(agent.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
