import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  User, Mail, Phone, Calendar, ArrowLeft, Shield, ShieldAlert, Ban, CheckCircle2,
  Sliders, Save, RefreshCw, AlertTriangle, Trash2, ShoppingBag, Target, Banknote,
  DollarSign, Wrench, Clock, FileSpreadsheet, Download, Users
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { TableSkeleton } from '@/components/shared/Skeletons'
import { resetDSAPerformanceWindow } from '@/lib/performanceWatcher'

interface SystemUser {
  id: string
  email: string
  full_name: string
  phone?: string
  role: string
  status: 'active' | 'suspended'
  created_at: string
  expected_orders_target?: number
  expected_leads_target?: number
  commission_per_camera?: number
  performance_window_days?: number
  performance_start_date?: string
  eviction_warning_day4_sent?: boolean
  eviction_alert_day5_sent?: boolean
  probation_status?: string
  probation_approval_status?: 'none' | 'pending_confirmation' | 'confirmed_probation' | 'waived'
}

export function UserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { role: currentRole } = useAuthStore()

  const [user, setUser] = useState<SystemUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [resettingWindow, setResettingWindow] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Target Settings Form
  const [targetOrders, setTargetOrders] = useState(30)
  const [targetLeads, setTargetLeads] = useState(10)
  const [commissionRate, setCommissionRate] = useState(0)

  // User Activity State & Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [userOrders, setUserOrders] = useState<any[]>([])
  const [userLeads, setUserLeads] = useState<any[]>([])
  const [userCommissions, setUserCommissions] = useState<any[]>([])
  const [userJobs, setUserJobs] = useState<any[]>([])
  const [userExpenses, setUserExpenses] = useState<any[]>([])

  useEffect(() => {
    if (userId) fetchUserData()
  }, [userId, startDate, endDate])

  const fetchUserData = async () => {
    setLoading(true)
    try {
      // 1. Fetch User Record
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userErr || !userData) throw userErr || new Error('User not found')

      setUser(userData)
      setTargetOrders(userData.expected_orders_target ?? 30)
      setTargetLeads(userData.expected_leads_target ?? 10)
      setCommissionRate(userData.commission_per_camera ?? 0)

      // Fetch Orders
      let ordersQuery = supabase
        .from('orders')
        .select('*')
        .or(`dsa_id.eq.${userId},created_by_auth_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (startDate) ordersQuery = ordersQuery.gte('created_at', `${startDate}T00:00:00.000Z`)
      if (endDate) ordersQuery = ordersQuery.lte('created_at', `${endDate}T23:59:59.999Z`)

      const { data: orders } = await ordersQuery
      if (orders) setUserOrders(orders)

      // Fetch DSA Leads & Commissions
      if (userData.role === 'dsa') {
        let leadsQuery = supabase
          .from('leads')
          .select('*')
          .eq('dsa_id', userId)
          .order('created_at', { ascending: false })

        if (startDate) leadsQuery = leadsQuery.gte('created_at', `${startDate}T00:00:00.000Z`)
        if (endDate) leadsQuery = leadsQuery.lte('created_at', `${endDate}T23:59:59.999Z`)

        const { data: leads } = await leadsQuery
        if (leads) setUserLeads(leads)

        try {
          let commQuery = supabase.from('commissions').select('*').eq('dsa_id', userId).order('triggered_at', { ascending: false })
          if (startDate) commQuery = commQuery.gte('triggered_at', `${startDate}T00:00:00.000Z`)
          if (endDate) commQuery = commQuery.lte('triggered_at', `${endDate}T23:59:59.999Z`)
          const { data: comms } = await commQuery
          if (comms) setUserCommissions(comms)
        } catch (_) {}

        try {
          let expQuery = supabase.from('expenses').select('*').eq('dsa_id', userId).order('expense_date', { ascending: false })
          if (startDate) expQuery = expQuery.gte('expense_date', startDate)
          if (endDate) expQuery = expQuery.lte('expense_date', endDate)
          const { data: exps } = await expQuery
          if (exps) setUserExpenses(exps)
        } catch (_) {}
      }

      // Fetch Installer Jobs
      if (userData.role === 'installer') {
        let jobsQuery = supabase
          .from('installer_jobs')
          .select('*, order:orders(order_number, customer_name, customer_address, status)')
          .eq('installer_id', userId)
          .order('created_at', { ascending: false })

        if (startDate) jobsQuery = jobsQuery.gte('created_at', `${startDate}T00:00:00.000Z`)
        if (endDate) jobsQuery = jobsQuery.lte('created_at', `${endDate}T23:59:59.999Z`)

        const { data: jobs } = await jobsQuery
        if (jobs) setUserJobs(jobs)
      }

    } catch (err) {
      console.error('Error fetching user detail:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!user) return
    setSavingSettings(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          expected_orders_target: Number(targetOrders),
          expected_leads_target: Number(targetLeads),
          commission_per_camera: Number(commissionRate),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error
      alert('DSA Target & Commission settings updated successfully!')
      fetchUserData()
    } catch (err) {
      console.error('Failed to update user settings:', err)
      alert('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleResetWindow = async () => {
    if (!user) return
    if (!window.confirm('Nullify underperformance status and reset 7-day countdown starting fresh from today?')) return
    setResettingWindow(true)
    try {
      await resetDSAPerformanceWindow(user.id)
      alert('7-day performance countdown reset successfully!')
      fetchUserData()
    } catch (err) {
      console.error('Failed to reset performance window:', err)
      alert('Failed to reset countdown window')
    } finally {
      setResettingWindow(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!user) return
    const newStatus = user.status === 'active' ? 'suspended' : 'active'
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      fetchUserData()
    } catch (err) {
      console.error('Error toggling status:', err)
      alert('Failed to update status')
    }
  }

  const handleDeleteUser = async () => {
    if (!user) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('users').delete().eq('id', user.id)
      if (error) throw error
      alert('User account deleted permanently.')
      navigate('/app/admin/users')
    } catch (err) {
      console.error('Failed to delete user:', err)
      alert('Failed to delete user account.')
    } finally {
      setDeleting(false)
      setIsDeleteModalOpen(false)
    }
  }

  // Calculate probation badge status for DSA
  const now = new Date()
  const currentMonthStr = now.toISOString().slice(0, 7)
  const deliveredThisMonth = userOrders.filter(o => o.status === 'delivered' && o.created_at?.startsWith(currentMonthStr)).length
  const isOnProbation = deliveredThisMonth < 20

  // Calculate 7-day performance window status for DSA
  const windowStart = user?.performance_start_date ? new Date(user.performance_start_date) : new Date()
  const rawDiffDays = Math.floor((now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24))
  const dayNumber = Math.min(7, Math.max(1, rawDiffDays + 1))
  const windowSales = userOrders.filter(o => o.status === 'delivered' && new Date(o.created_at) >= windowStart).length
  const advertisingExpenses = userExpenses.filter(expense =>
    ['advertising', 'ad_cost', 'marketing'].includes(String(expense.category).toLowerCase())
  )
  const totalAdSpend = advertisingExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-surface-200 animate-pulse rounded-lg" />
        <TableSkeleton rows={8} cols={5} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="glass-card p-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
        <h2 className="text-xl font-bold">User Not Found</h2>
        <button onClick={() => navigate('/app/admin/users')} className="btn-primary">Return to Users</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button & Top Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/admin/users')}
            className="p-2.5 rounded-xl border border-surface-200 bg-white text-surface-600 hover:text-surface-900 hover:bg-surface-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{user.full_name || 'User Profile'}</h1>
            <p className="text-xs text-surface-500 mt-0.5">Role-specific administrative workspace & performance history.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-hide">
          {/* DSA-Specific Action: Nullify & Reset 7-Day Performance Countdown */}
          {user.role === 'dsa' && (
            <button
              onClick={handleResetWindow}
              disabled={resettingWindow}
              className="btn-outline text-xs font-bold flex items-center gap-1.5 h-9 px-3 whitespace-nowrap bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors shrink-0"
              title="Nullify underperformance warning and reset 7-day countdown"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-700" /> Nullify & Reset
            </button>
          )}

          <button
            onClick={handleToggleStatus}
            className={`text-xs font-bold h-9 px-3 rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              user.status === 'active'
                ? 'bg-white border-surface-200 text-danger-600 hover:bg-danger-50'
                : 'bg-white border-surface-200 text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {user.status === 'active' ? <><Ban className="w-3.5 h-3.5" /> Suspend</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Reactivate</>}
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-xs font-bold h-9 px-3 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* 🚨 Day 7 Eviction Action Banner for Admin 🚨 */}
      {user.role === 'dsa' && (dayNumber >= 7 || user.probation_status === 'evicted') && windowSales === 0 && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950 flex items-center gap-2">
                7-Day Window Expired (0 Sales Delivered) — Account Suspended
              </h3>
              <p className="text-xs text-rose-700 mt-0.5 font-medium">
                This DSA reached Day 7 with 0 sales and was automatically suspended. Choose an administrative action:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
            <button
              onClick={handleResetWindow}
              disabled={resettingWindow}
              className="btn-outline text-xs font-bold h-9 px-4 bg-white border-rose-300 text-rose-900 hover:bg-rose-100 flex-1 md:flex-none transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-600" /> Reset Window & Reactivate
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="text-xs font-bold h-9 px-4 rounded-xl bg-rose-600 text-white hover:bg-rose-700 flex-1 md:flex-none shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Evict & Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Profile Header Banner */}
      <div className="glass-card p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg shrink-0">
            {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-surface-900">{user.full_name || 'No Name'}</h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-100 text-brand-700 border border-brand-200">
                {user.role.replace('_', ' ')}
              </span>

              {/* DSA-Specific Probation Status Pill */}
              {user.role === 'dsa' && (
                user.probation_approval_status === 'confirmed_probation' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Confirmed Probation
                  </span>
                ) : user.probation_approval_status === 'waived' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" /> Target Waived
                  </span>
                ) : isOnProbation ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Under Target ({deliveredThisMonth}/20 Sales)
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Target Achieved ({deliveredThisMonth} Delivered)
                  </span>
                )
              )}

              {user.status === 'suspended' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-danger-100 text-danger-700 border border-danger-200 flex items-center gap-1">
                  <Ban className="w-3.5 h-3.5" /> Suspended
                </span>
              )}
            </div>

            <p className="text-xs text-surface-500 flex items-center gap-3 mt-2 flex-wrap font-medium">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-surface-400" /> {user.email}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-surface-400" /> {user.phone || 'No Phone'}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-surface-400" /> Joined {formatDate(user.created_at)}</span>
            </p>
          </div>
        </div>

        {/* 7-Day Performance Clock Widget (DSA ONLY) */}
        {user.role === 'dsa' && (
          <div className={`w-full md:w-auto p-4 rounded-2xl border text-right shrink-0 ${
            user.status === 'suspended' ? 'bg-surface-100/70 border-surface-200' : 'bg-surface-50 border-surface-200'
          }`}>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-surface-500 flex items-center justify-end gap-1">
              <Clock className="w-3.5 h-3.5 text-brand-600" /> 7-Day Performance Clock
            </p>
            {user.status === 'suspended' ? (
              <>
                <p className="text-base font-black text-rose-600 mt-1">Clock Paused</p>
                <p className="text-xs font-semibold text-surface-500 mt-0.5">Account is Suspended</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-surface-900 mt-1">Day {dayNumber} <span className="text-sm font-semibold text-surface-400">/ 7</span></p>
                <p className="text-xs font-bold text-surface-600 mt-0.5">
                  {windowSales > 0 ? `${windowSales} Sales Delivered` : '0 Sales (Eviction Risk)'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 🛡️ Dedicated Admin Probation Decision Panel 🛡️ */}
      {user.role === 'dsa' && user.status === 'active' && isOnProbation && (currentRole === 'admin' || currentRole === 'super_admin') && (
        <div className="glass-card p-5 border-2 border-amber-300/90 bg-amber-50/60 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Monthly Target Review ({deliveredThisMonth} of 20 Delivered Orders)
              </h3>
              <p className="text-xs text-amber-800 mt-0.5 font-medium">
                This agent has delivered {deliveredThisMonth} orders this month. As an admin, select an action below:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={async () => {
                await supabase.from('users').update({ probation_approval_status: 'confirmed_probation' }).eq('id', user.id)
                setUser(prev => prev ? { ...prev, probation_approval_status: 'confirmed_probation' } : null)
              }}
              className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 flex-1 md:flex-none"
            >
              <AlertTriangle className="w-4 h-4" /> Confirm Probation
            </button>
            <button
              onClick={async () => {
                await supabase.from('users').update({ probation_approval_status: 'waived' }).eq('id', user.id)
                setUser(prev => prev ? { ...prev, probation_approval_status: 'waived' } : null)
              }}
              className="h-10 px-4 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 md:flex-none shadow-2xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Waive Target Threshold
            </button>
          </div>
        </div>
      )}

      {/* DSA Targets & Commission Config Form (DSA ONLY) */}
      {user.role === 'dsa' && (
        <div className="glass-card p-6">
          <h3 className="text-base font-bold text-surface-900 mb-4 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-600" /> DSA Targets & Commission Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-surface-700 mb-1 block">Monthly Orders Target (Default 30)</label>
              <input
                type="number" min={1}
                value={targetOrders}
                onChange={e => setTargetOrders(Number(e.target.value))}
                className="input h-10 text-sm font-semibold bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-surface-700 mb-1 block">Monthly Leads Target (Default 10)</label>
              <input
                type="number" min={1}
                value={targetLeads}
                onChange={e => setTargetLeads(Number(e.target.value))}
                className="input h-10 text-sm font-semibold bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-surface-700 mb-1 block">Commission Rate per Camera (Default ₦0)</label>
              <input
                type="number" min={0} step={500}
                value={commissionRate}
                onChange={e => setCommissionRate(Number(e.target.value))}
                className="input h-10 text-sm font-semibold bg-white"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn-primary h-10 px-5 text-xs font-bold flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save Target & Commission Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Role-Specific Activity KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-4">
          <span className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
            <ShoppingBag className="w-4 h-4 text-brand-600" /> {user.role === 'admin' || user.role === 'super_admin' ? 'Orders Processed' : 'Total Orders'}
          </span>
          <p className="text-2xl font-black text-surface-900 mt-2">{userOrders.length}</p>
        </div>

        <div className="glass-card p-4">
          <span className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {user.role === 'installer' ? 'Completed Jobs' : 'Delivered Orders'}
          </span>
          <p className="text-2xl font-black text-surface-900 mt-2">
            {user.role === 'installer' ? userJobs.filter(j => j.status === 'completed').length : userOrders.filter(o => o.status === 'delivered').length}
          </p>
        </div>

        <div className="glass-card p-4">
          <span className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-cyan-600" /> Total Sales Value
          </span>
          <p className="text-2xl font-black text-surface-900 mt-2">
            {formatCurrency(userOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount || 0), 0))}
          </p>
        </div>

        {/* Role-Specific Fourth Card */}
        <div className="glass-card p-4">
          {user.role === 'dsa' && (
            <>
              <span className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
                <Banknote className="w-4 h-4 text-amber-600" /> Commissions Earned
              </span>
              <p className="text-2xl font-black text-surface-900 mt-2">
                {formatCurrency(userCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0))}
              </p>
            </>
          )}

          {user.role === 'installer' && (
            <>
              <span className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
                <Wrench className="w-4 h-4 text-amber-600" /> Installer Earnings
              </span>
              <p className="text-2xl font-black text-surface-900 mt-2">
                {formatCurrency(userJobs.filter(j => j.status === 'completed').reduce((sum, j) => sum + Number(j.installer_cut || 0), 0))}
              </p>
            </>
          )}

          {(user.role === 'admin' || user.role === 'super_admin') && (
            <>
              <span className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-4 h-4 text-brand-600" /> Administrative Access
              </span>
              <p className="text-sm font-bold text-surface-900 mt-2">Full Portal Permissions</p>
            </>
          )}
        </div>
      </div>

      {/* DSA Ad Spend KPI Card (DSA ONLY) */}
      {user.role === 'dsa' && (
        <div className="glass-card flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
              Total Ad Spend Allocation
            </span>
            <h3 className="text-2xl font-black text-surface-900 mt-2">
              {formatCurrency(totalAdSpend)}
            </h3>
            <p className="text-xs text-surface-500 mt-1 font-medium">
              Total advertising & marketing expenditure allocated to generate leads/orders for {user.full_name || 'this DSA'}.
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-surface-200 text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Ad Spend Per Delivered Order</span>
            <p className="text-lg font-black text-surface-900 mt-0.5">
              {userOrders.filter(o => o.status === 'delivered').length > 0
                ? formatCurrency(totalAdSpend / userOrders.filter(o => o.status === 'delivered').length)
                : '₦0'}
            </p>
          </div>
        </div>
      )}

      {/* Date Range Filter Bar for Activity Reports */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="font-bold text-surface-900 text-sm">Historical Activity Report</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-surface-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input h-8 text-xs px-2 bg-white rounded-lg border-surface-200"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-surface-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="input h-8 text-xs px-2 bg-white rounded-lg border-surface-200"
            />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate('') }} className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              Clear Date Filter
            </button>
          )}
        </div>
      </div>

      {/* User Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <h3 className="font-bold text-surface-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-600" /> User Orders ({userOrders.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="bg-surface-50/50 border-b border-surface-100 font-bold uppercase tracking-wider text-surface-500">
                <th className="py-3 px-5">Order #</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Qty</th>
                <th className="py-3 px-5 text-right">Total Amount</th>
                <th className="py-3 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 font-medium">
              {userOrders.map(o => (
                <tr key={o.id} className="hover:bg-surface-50">
                  <td className="py-3 px-5 font-bold text-brand-600">{o.order_number}</td>
                  <td className="py-3 px-5">{o.customer_name}</td>
                  <td className="py-3 px-5 text-surface-500">{formatDate(o.created_at)}</td>
                  <td className="py-3 px-5">{o.quantity}</td>
                  <td className="py-3 px-5 text-right font-bold">{formatCurrency(o.total_amount)}</td>
                  <td className="py-3 px-5 text-center">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      o.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                      o.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {userOrders.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-surface-400 font-semibold">No orders recorded for this user.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DSA Leads Table (DSA ONLY) */}
      {user.role === 'dsa' && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-surface-100 flex items-center justify-between">
            <h3 className="font-bold text-surface-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-600" /> Logged Leads ({userLeads.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead>
                <tr className="bg-surface-50/50 border-b border-surface-100 font-bold uppercase tracking-wider text-surface-500">
                  <th className="py-3 px-5">Lead / Phone</th>
                  <th className="py-3 px-5">Phone</th>
                  <th className="py-3 px-5">Date Logged</th>
                  <th className="py-3 px-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-medium">
                {userLeads.map(l => (
                  <tr key={l.id} className="hover:bg-surface-50">
                    <td className="py-3 px-5 font-bold text-surface-900">
                      {l.customer_name || l.name
                        ? <span>{l.customer_name || l.name}</span>
                        : <span className="text-surface-400 italic text-xs">No name recorded</span>
                      }
                    </td>
                    <td className="py-3 px-5 text-surface-600">{l.phone || l.customer_phone || '—'}</td>
                    <td className="py-3 px-5 text-surface-500">{formatDate(l.created_at)}</td>
                    <td className="py-3 px-5 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        l.status === 'converted' ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {userLeads.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-surface-400 font-semibold">No leads logged for this DSA.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Prompt Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-surface-200 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-lg font-bold text-surface-900">Delete User Account?</h3>
            </div>
            <p className="text-sm text-surface-600 leading-relaxed">
              Are you sure you want to permanently delete user account <strong>{user.full_name || user.email}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsDeleteModalOpen(false)} className="btn-outline px-4 py-2 text-xs font-bold">Cancel</button>
              <button onClick={handleDeleteUser} disabled={deleting} className="btn-danger px-4 py-2 text-xs font-bold bg-rose-600 text-white">
                {deleting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
