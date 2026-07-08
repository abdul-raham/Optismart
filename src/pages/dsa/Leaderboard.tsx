import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Trophy, Medal, Award, TrendingUp, Search, Calendar as CalendarIcon, Package, User } from 'lucide-react'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'
import { formatCurrency } from '@/lib/utils'

type TimeFilter = 'total' | 'year' | 'month' | 'week' | 'day'

interface LeaderboardEntry {
  id: string
  name: string
  deliveredOrders: number
  totalRevenue: number
  rank: number
}

export function DSALeaderboard() {
  const { user } = useAuthStore()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    fetchLeaderboard()
  }, [timeFilter])

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      // 1. Fetch all DSAs
      const { data: dsas } = await supabase.from('users').select('id, full_name, email').eq('role', 'dsa')
      
      // 2. Fetch all delivered orders (filter by date later or query)
      const { data: orders } = await supabase.from('orders').select('dsa_id, created_at, total_amount').eq('status', 'delivered')

      if (dsas && orders) {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startOfWeek = new Date(startOfDay)
        startOfWeek.setDate(now.getDate() - now.getDay())
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfYear = new Date(now.getFullYear(), 0, 1)

        const filteredOrders = orders.filter(o => {
          const d = new Date(o.created_at)
          switch (timeFilter) {
            case 'day': return d >= startOfDay
            case 'week': return d >= startOfWeek
            case 'month': return d >= startOfMonth
            case 'year': return d >= startOfYear
            case 'total': return true
            default: return true
          }
        })

        // Group by DSA
        let aggregated = dsas.map(dsa => {
          const dsaOrders = filteredOrders.filter(o => o.dsa_id === dsa.id)
          const revenue = dsaOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
          return {
            id: dsa.id,
            name: dsa.full_name || dsa.email.split('@')[0], // fallback to email prefix if no name
            deliveredOrders: dsaOrders.length,
            totalRevenue: revenue,
            rank: 0
          }
        })

        // Sort by deliveredOrders (primary) and revenue (secondary)
        aggregated.sort((a, b) => {
          if (b.deliveredOrders !== a.deliveredOrders) {
            return b.deliveredOrders - a.deliveredOrders
          }
          return b.totalRevenue - a.totalRevenue
        })

        // Assign ranks
        aggregated = aggregated.map((entry, index) => ({ ...entry, rank: index + 1 }))
        setEntries(aggregated)
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEntries = entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-500" />
            DSA Leaderboard
          </h1>
          <p className="text-sm text-surface-500 mt-1">See how you rank against other Sales Agents globally.</p>
        </div>

        {/* Time Filters */}
        <div className="flex items-center gap-2 bg-surface-100 p-1 rounded-xl overflow-x-auto hide-scrollbar">
          {(['total', 'year', 'month', 'week', 'day'] as TimeFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-all ${
                timeFilter === filter 
                  ? 'bg-white text-brand-700 shadow-sm' 
                  : 'text-surface-600 hover:text-surface-900 hover:bg-surface-200/50'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <input 
          type="text" 
          placeholder="Search for an agent..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-surface-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-4 mt-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="glass-card h-20 animate-pulse bg-surface-100/50" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredEntries.map((entry, index) => {
              const isCurrentUser = entry.id === user?.id
              const isFirst = entry.rank === 1
              const isSecond = entry.rank === 2
              const isThird = entry.rank === 3

              let RankIcon = null
              let rankColor = "text-surface-400 bg-surface-100"
              
              if (isFirst) {
                RankIcon = Trophy
                rankColor = "text-yellow-600 bg-yellow-100 border-yellow-200"
              } else if (isSecond) {
                RankIcon = Medal
                rankColor = "text-slate-500 bg-slate-100 border-slate-200"
              } else if (isThird) {
                RankIcon = Award
                rankColor = "text-amber-700 bg-amber-100 border-amber-200"
              }

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative overflow-hidden rounded-2xl border transition-all ${
                    isCurrentUser 
                      ? 'bg-brand-50 border-brand-200 shadow-md shadow-brand-500/10' 
                      : 'bg-white border-surface-100 hover:shadow-md hover:border-surface-200'
                  }`}
                >
                  {isCurrentUser && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-500" />
                  )}
                  
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                      <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center border font-black text-lg ${rankColor}`}>
                        {RankIcon ? <RankIcon className="w-6 h-6" /> : `#${entry.rank}`}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold truncate text-base sm:text-lg ${isCurrentUser ? 'text-brand-900' : 'text-surface-900'}`}>
                            {entry.name}
                          </h3>
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-brand-100 text-brand-700">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-surface-500">
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {entry.deliveredOrders} delivered
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm sm:text-base ${isFirst ? 'text-yellow-600' : isSecond ? 'text-slate-600' : isThird ? 'text-amber-700' : 'text-surface-700'}`}>
                        {formatCurrency(entry.totalRevenue)}
                      </p>
                      <p className="text-[10px] sm:text-xs font-semibold text-surface-400 uppercase tracking-wider mt-0.5">
                        Revenue Generated
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
            {filteredEntries.length === 0 && (
              <div className="py-12 text-center text-surface-500 bg-white rounded-2xl border border-surface-100">
                <User className="w-12 h-12 mx-auto text-surface-300 mb-3" />
                <p className="font-semibold text-surface-600">No agents found.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      <MobileDashboardNav />
    </div>
  )
}
