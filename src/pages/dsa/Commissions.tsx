import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { DollarSign, Target, TrendingUp, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Commission {
  id: string
  amount: number
  status: 'pending' | 'paid'
  triggered_at: string
  orders: {
    order_number: string
    quantity: number
  }
}

export function DSACommissions() {
  const { user } = useAuthStore()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)

  // Commission Engine Logic Constants
  const MONTHLY_TARGET = 30 // Target is 30 delivered cameras
  const COMMISSION_PER_CAMERA = 5000 // Placeholder logic for UI

  useEffect(() => {
    if (user?.id) fetchCommissions()
  }, [user?.id])

  const fetchCommissions = async () => {
    try {
      const { data } = await supabase
        .from('commissions')
        .select(`
          id, amount, status, triggered_at,
          orders ( order_number, quantity )
        `)
        .eq('dsa_id', user?.id)
        .order('triggered_at', { ascending: false })

      if (data) setCommissions(data as any[])
    } catch (err) {
      console.error('Error fetching commissions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate threshold metrics
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  
  const thisMonthCommissions = commissions.filter(c => {
    const d = new Date(c.triggered_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  // Cameras delivered this month
  const totalDeliveredCameras = thisMonthCommissions.reduce((sum, c) => sum + (c.orders?.quantity || 1), 0)
  
  const pendingAmount = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0)
  const totalEarned = thisMonthCommissions.reduce((sum, c) => sum + Number(c.amount), 0)

  // Target status logic
  const progressPercent = Math.min(100, Math.round((totalDeliveredCameras / MONTHLY_TARGET) * 100))
  let targetColor = 'bg-danger-500' // Red
  if (progressPercent >= 100) targetColor = 'bg-success-500' // Green
  else if (progressPercent >= 70) targetColor = 'bg-warning-500' // Amber

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Commission Engine</h1>
          <p className="text-sm text-surface-500 mt-1">Track your earnings and monthly targets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Target Tracker */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <h2 className="text-base font-bold text-surface-900 mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-600" /> Monthly Threshold
            </h2>

            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-4xl font-extrabold text-surface-900">{totalDeliveredCameras}</p>
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mt-1">Cameras Delivered</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-surface-400">/ {MONTHLY_TARGET}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-4 bg-surface-100 rounded-full mt-4 overflow-hidden shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${targetColor}`}
              />
            </div>

            <div className="mt-4 p-3 rounded-xl bg-surface-50 border border-surface-100 flex gap-3 items-start">
              {progressPercent >= 100 ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-success-600 flex-shrink-0" />
                  <p className="text-xs font-medium text-surface-600">Target achieved! You are fully qualified for this month's commission payout.</p>
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5 text-brand-600 flex-shrink-0" />
                  <p className="text-xs font-medium text-surface-600">Sell {MONTHLY_TARGET - totalDeliveredCameras} more cameras to hit your monthly target and unlock payouts.</p>
                </>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-xs font-bold text-surface-500 uppercase">Pending</p>
              <p className="text-lg font-bold text-surface-900 mt-1">{formatCurrency(pendingAmount)}</p>
            </div>
            <div className="glass-card p-4">
              <div className="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center mb-3">
                <DollarSign className="w-5 h-5 text-success-600" />
              </div>
              <p className="text-xs font-bold text-surface-500 uppercase">Earned (This Mo)</p>
              <p className="text-lg font-bold text-surface-900 mt-1">{formatCurrency(totalEarned)}</p>
            </div>
          </div>
        </div>

        {/* Right Col: Earnings History */}
        <div className="lg:col-span-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card h-full flex flex-col">
            <div className="p-5 border-b border-surface-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-surface-900">Commission History</h2>
            </div>
            
            <div className="flex-1 p-5 overflow-y-auto">
              {loading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-16 bg-surface-100/50 rounded-xl animate-pulse" />)}
                </div>
              ) : commissions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-surface-50 flex items-center justify-center mb-4">
                    <DollarSign className="w-8 h-8 text-surface-300" />
                  </div>
                  <h3 className="text-sm font-bold text-surface-900 mb-1">No commissions yet</h3>
                  <p className="text-xs text-surface-500 max-w-[250px]">Commissions are generated automatically when your orders are marked as delivered.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {commissions.map(comm => (
                    <div key={comm.id} className="flex items-center justify-between p-4 rounded-xl border border-surface-100 hover:border-brand-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${comm.status === 'paid' ? 'bg-success-50 text-success-600' : 'bg-surface-100 text-surface-500'}`}>
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-surface-900">Order #{comm.orders?.order_number}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-surface-500">
                            <Calendar className="w-3 h-3" /> {formatDate(comm.triggered_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-surface-900">{formatCurrency(comm.amount)}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          comm.status === 'paid' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
                        }`}>
                          {comm.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  )
}
