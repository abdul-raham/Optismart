import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Banknote, Camera, Loader2, PieChart, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

import { useAuthStore } from '@/stores/authStore'
import { ShieldAlert } from 'lucide-react'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface FinanceOrder {
  id: string
  dsa_id: string | null
  quantity: number
  unit_cost: number
  total_amount: number
  delivered_at: string | null
  updated_at: string
  dsa?: { full_name: string; email: string } | null
}

interface FinanceExpense {
  id: string
  dsa_id: string | null
  category: string
  amount: number
  expense_date: string
  dsa?: { full_name: string; email: string } | null
}

interface DsaProfitLoss {
  id: string
  name: string
  email: string
  cameras: number
  revenue: number
  cameraCost: number
  manualExpenses: number
  totalExpenses: number
  profit: number
  margin: number
}

const monthKey = (value: string | null | undefined) => value?.slice(0, 7) || ''

export function AdminFinance() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [orders, setOrders] = useState<FinanceOrder[]>([])
  const [expenses, setExpenses] = useState<FinanceExpense[]>([])

  const fetchFinanceData = async () => {
    setLoading(true)
    setError('')
    try {
      const [ordersRes, expensesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, dsa_id, quantity, unit_cost, total_amount, delivered_at, updated_at, dsa:users!orders_dsa_id_fkey(full_name, email)')
          .eq('status', 'delivered'),
        supabase.from('expenses').select('id, dsa_id, category, amount, expense_date, dsa:users!expenses_dsa_id_fkey(full_name, email)'),
      ])
      if (ordersRes.error) throw ordersRes.error
      if (expensesRes.error) throw expensesRes.error
      setOrders((ordersRes.data ?? []) as unknown as FinanceOrder[])
      setExpenses((expensesRes.data ?? []) as unknown as FinanceExpense[])
    } catch (err: any) {
      console.error('Error fetching profit/loss data:', err)
      setError(err?.message || 'Unable to load profit/loss data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinanceData()
    const channel = supabase
      .channel('admin-finance-profit-loss')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchFinanceData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchFinanceData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const selectedOrders = useMemo(
    () => orders.filter(order => monthKey(order.delivered_at || order.updated_at) === selectedMonth),
    [orders, selectedMonth],
  )
  const selectedExpenses = useMemo(
    () => expenses.filter(expense => monthKey(expense.expense_date) === selectedMonth),
    [expenses, selectedMonth],
  )

  const revenue = selectedOrders.reduce((sum, order) => sum + Number(order.total_amount), 0)
  const cameraCost = selectedOrders.reduce((sum, order) => sum + Number(order.unit_cost || 0) * Number(order.quantity || 0), 0)
  const recordedExpenses = selectedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const totalExpenses = cameraCost + recordedExpenses
  const profit = revenue - totalExpenses
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  const dsaProfitLoss = useMemo(() => {
    const rows = new Map<string, DsaProfitLoss>()
    const ensure = (id: string, name = 'Unregistered / System', email = '—') => {
      if (!rows.has(id)) rows.set(id, { id, name, email, cameras: 0, revenue: 0, cameraCost: 0, manualExpenses: 0, totalExpenses: 0, profit: 0, margin: 0 })
      return rows.get(id)!
    }

    selectedOrders.forEach(order => {
      const id = order.dsa_id || '_unassigned'
      const row = ensure(id, order.dsa?.full_name || 'Unregistered / System', order.dsa?.email || '—')
      row.cameras += Number(order.quantity || 0)
      row.revenue += Number(order.total_amount || 0)
      row.cameraCost += Number(order.unit_cost || 0) * Number(order.quantity || 0)
    })
    selectedExpenses.forEach(expense => {
      if (!expense.dsa_id) return
      ensure(expense.dsa_id, expense.dsa?.full_name || 'Unknown DSA', expense.dsa?.email || '—').manualExpenses += Number(expense.amount || 0)
    })
    rows.forEach(row => {
      row.totalExpenses = row.cameraCost + row.manualExpenses
      row.profit = row.revenue - row.totalExpenses
      row.margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0
    })
    return [...rows.values()].sort((a, b) => b.profit - a.profit)
  }, [selectedOrders, selectedExpenses])

  const selectedYear = selectedMonth.slice(0, 4)
  const chartData = useMemo(() => MONTH_NAMES.map((month, index) => {
    const key = `${selectedYear}-${String(index + 1).padStart(2, '0')}`
    const monthOrders = orders.filter(order => monthKey(order.delivered_at || order.updated_at) === key)
    const monthExpenses = expenses.filter(expense => monthKey(expense.expense_date) === key)
    const monthRevenue = monthOrders.reduce((sum, order) => sum + Number(order.total_amount), 0)
    const monthCameraCost = monthOrders.reduce((sum, order) => sum + Number(order.unit_cost || 0) * Number(order.quantity || 0), 0)
    const monthRecorded = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
    return { month, revenue: monthRevenue, expenses: monthCameraCost + monthRecorded, profit: monthRevenue - monthCameraCost - monthRecorded }
  }), [orders, expenses, selectedYear])

  const categoryBreakdown = useMemo(() => {
    const values: Record<string, number> = { camera_cost: cameraCost }
    selectedExpenses.forEach(expense => { values[expense.category] = (values[expense.category] || 0) + Number(expense.amount) })
    return Object.entries(values).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1])
  }, [cameraCost, selectedExpenses])

  if (!isSuperAdmin) {
    return (
      <div className="glass-card p-12 text-center max-w-xl mx-auto my-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">Restricted Superadmin Feature</h2>
        <p className="text-surface-600 text-sm leading-relaxed mb-6">
          Company Profit & Loss metrics, camera acquisition cost margins, and DSA profitability reports are confidential and accessible exclusively to <strong>Superadmin</strong> accounts.
        </p>
        <button onClick={() => window.location.href = '/app/admin'} className="btn-primary px-6 py-2.5 text-xs">
          Return to Dashboard
        </button>
      </div>
    )
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>

  const cards = [
    { label: 'Revenue received', value: revenue, icon: Banknote, tone: 'bg-brand-50 text-brand-600' },
    { label: 'Camera cost', value: cameraCost, icon: Camera, tone: 'bg-orange-50 text-orange-600' },
    { label: 'Total expenses', value: totalExpenses, icon: TrendingDown, tone: 'bg-danger-50 text-danger-600' },
    { label: profit >= 0 ? 'Net profit' : 'Net loss', value: profit, icon: profit >= 0 ? TrendingUp : TrendingDown, tone: profit >= 0 ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600' },
    { label: 'Profit margin', value: margin, icon: PieChart, tone: 'bg-purple-50 text-purple-600', percent: true },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Monthly Profit & Loss</h1><p className="page-subtitle">Delivered-order revenue minus camera and operating costs</p></div>
        <input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="input h-10 w-auto bg-white" />
      </div>

      {error && <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm font-semibold text-danger-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="stat-card"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="h-6 w-6" /></div><p className={`text-2xl font-black ${card.value < 0 ? 'text-danger-600' : 'text-surface-900'}`}>{card.percent ? `${card.value.toFixed(1)}%` : formatCurrency(card.value)}</p><p className="mt-1 text-sm text-surface-500">{card.label}</p></motion.div>)}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="glass-card p-6 xl:col-span-2"><h2 className="font-bold text-surface-900">Revenue, Expenses & Profit — {selectedYear}</h2><p className="mb-5 text-xs text-surface-400">Revenue is recognized when an order is delivered</p><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="month" /><YAxis tickFormatter={value => `₦${Math.round(value / 1000)}k`} /><Tooltip formatter={value => formatCurrency(Number(value))} /><Bar dataKey="revenue" name="Revenue" fill="#0A74FF" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="glass-card p-6"><h2 className="font-bold text-surface-900">Expense Breakdown</h2><p className="mb-5 text-xs text-surface-400">Selected month</p><div className="space-y-4">{categoryBreakdown.length === 0 ? <p className="py-12 text-center text-sm text-surface-400">No expenses recorded</p> : categoryBreakdown.map(([category, amount]) => <div key={category}><div className="flex justify-between gap-3 text-sm"><span className="font-medium capitalize text-surface-600">{category.replace(/_/g, ' ')}</span><span className="font-bold text-surface-900">{formatCurrency(amount)}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full bg-danger-400" style={{ width: `${totalExpenses ? Math.max(3, amount / totalExpenses * 100) : 0}%` }} /></div></div>)}</div></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="border-b border-surface-100 p-5"><h2 className="flex items-center gap-2 font-bold text-surface-900"><Users className="h-5 w-5 text-brand-500" /> DSA Monthly Profit & Loss</h2><p className="mt-1 text-xs text-surface-400">Only expenses attributed to a DSA are included in that DSA’s row; company-wide expenses remain in the company total.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-surface-50 text-left">{['DSA', 'Cameras', 'Revenue', 'Camera Cost', 'Other Expenses', 'Total Expenses', 'Profit / Loss', 'Margin'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-surface-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-surface-100">{dsaProfitLoss.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-surface-400">No delivered DSA orders or attributed expenses for this month.</td></tr> : dsaProfitLoss.map(row => <tr key={row.id} className="hover:bg-surface-50/50"><td className="px-4 py-3"><p className="font-bold text-surface-900">{row.name}</p><p className="text-xs text-surface-400">{row.email}</p></td><td className="px-4 py-3 font-semibold">{row.cameras}</td><td className="px-4 py-3 font-semibold">{formatCurrency(row.revenue)}</td><td className="px-4 py-3">{formatCurrency(row.cameraCost)}</td><td className="px-4 py-3">{formatCurrency(row.manualExpenses)}</td><td className="px-4 py-3 font-semibold text-danger-600">{formatCurrency(row.totalExpenses)}</td><td className={`px-4 py-3 font-black ${row.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatCurrency(row.profit)}</td><td className={`px-4 py-3 font-bold ${row.margin >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{row.margin.toFixed(1)}%</td></tr>)}</tbody></table></div>
      </div>

      <div className="glass-card p-6"><h2 className="font-bold text-surface-900">Monthly Net Profit Trend</h2><ResponsiveContainer width="100%" height={220}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="month" /><YAxis tickFormatter={value => `₦${Math.round(value / 1000)}k`} /><Tooltip formatter={value => formatCurrency(Number(value))} /><Line type="monotone" dataKey="profit" name="Profit / Loss" stroke="#22c55e" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
    </div>
  )
}
