import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Banknote, PieChart, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EXPENSE_COLORS: Record<string, string> = {
  logistics: '#22c55e',
  marketing: '#f59e0b',
  salaries: '#0A74FF',
  utilities: '#ef4444',
  equipment: '#a855f7',
  other: '#94a3b8',
}

const CustomBar = (props: any) => {
  const { fill, x, y, width, height } = props
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />
}

export function AdminFinance() {
  const [loading, setLoading] = useState(true)
  const [monthlyRevenue, setMonthlyRevenue] = useState<Record<number, number>>({})
  const [monthlyExpenses, setMonthlyExpenses] = useState<Record<number, number>>({})
  const [expenseByCategory, setExpenseByCategory] = useState<Record<string, number>>({})

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    fetchFinanceData()
  }, [])

  const fetchFinanceData = async () => {
    setLoading(true)
    try {
      const yearStart = `${currentYear}-01-01`
      const yearEnd = `${currentYear}-12-31`

      const [ordersRes, expensesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total_amount, delivered_at, created_at, status')
          .eq('status', 'delivered')
          .gte('created_at', yearStart)
          .lte('created_at', yearEnd),
        supabase
          .from('expenses')
          .select('amount, category, expense_date')
          .gte('expense_date', yearStart)
          .lte('expense_date', yearEnd),
      ])

      // Group revenue by month
      const revByMonth: Record<number, number> = {}
      for (const order of ordersRes.data ?? []) {
        const month = new Date(order.created_at).getMonth()
        revByMonth[month] = (revByMonth[month] ?? 0) + Number(order.total_amount)
      }
      setMonthlyRevenue(revByMonth)

      // Group expenses by month and by category
      const expByMonth: Record<number, number> = {}
      const expByCat: Record<string, number> = {}
      for (const exp of expensesRes.data ?? []) {
        const month = new Date(exp.expense_date).getMonth()
        expByMonth[month] = (expByMonth[month] ?? 0) + Number(exp.amount)
        expByCat[exp.category] = (expByCat[exp.category] ?? 0) + Number(exp.amount)
      }
      setMonthlyExpenses(expByMonth)
      setExpenseByCategory(expByCat)
    } catch (err) {
      console.error('Error fetching finance data:', err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = useMemo(() => {
    return MONTHS.map((month, i) => {
      const revenue = monthlyRevenue[i] ?? 0
      const expenses = monthlyExpenses[i] ?? 0
      return { month, revenue, expenses, profit: revenue - expenses }
    })
  }, [monthlyRevenue, monthlyExpenses])

  const totalRevenue = Object.values(monthlyRevenue).reduce((s, v) => s + v, 0)
  const totalExpenses = Object.values(monthlyExpenses).reduce((s, v) => s + v, 0)
  const totalProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  const categoryBreakdown = Object.entries(expenseByCategory).map(([name, amount]) => ({
    name,
    amount,
    color: EXPENSE_COLORS[name] ?? '#94a3b8',
  }))
  const totalCatExpenses = categoryBreakdown.reduce((s, c) => s + c.amount, 0)

  const summaryCards = [
    { label: `Total Revenue (${currentYear})`, value: totalRevenue, icon: Banknote, color: 'brand' },
    { label: `Total Expenses (${currentYear})`, value: totalExpenses, icon: TrendingDown, color: 'danger' },
    { label: `Net Profit (${currentYear})`, value: totalProfit, icon: TrendingUp, color: 'success' },
    { label: 'Profit Margin', value: `${profitMargin}%`, icon: PieChart, color: 'purple', isPercent: true },
  ]

  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    danger: 'bg-danger-50 text-danger-500',
    success: 'bg-success-50 text-success-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Overview</h1>
          <p className="page-subtitle">Revenue, expenses and profit analysis</p>
        </div>
        <div className="text-sm text-surface-500 bg-white px-4 py-2 rounded-xl border border-surface-200">
          {currentYear} (Live Data)
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {summaryCards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="stat-card">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${colorMap[card.color]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <p className="text-2xl font-bold text-surface-900">
                {card.isPercent ? card.value : formatCurrency(card.value as number)}
              </p>
              <p className="text-sm text-surface-500 mt-1">{card.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Profit trend */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl shadow-card border border-surface-100 p-6 mb-6">
        <div className="mb-5">
          <h3 className="font-semibold text-surface-800">Monthly Profit Trend</h3>
          <p className="text-sm text-surface-400">Net profit per month</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`} />
            <Tooltip formatter={(v) => [formatCurrency(v as number), 'Profit']}
              contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
            <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: '#22c55e', r: 4 }}
              activeDot={{ r: 6, fill: '#22c55e' }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Bottom charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-card border border-surface-100 p-6">
          <h3 className="font-semibold text-surface-800 mb-5">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v) => [formatCurrency(v as number)]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#0A74FF" shape={<CustomBar />} maxBarSize={28} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" shape={<CustomBar />} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl shadow-card border border-surface-100 p-6">
          <h3 className="font-semibold text-surface-800 mb-5">Expense Breakdown ({currentYear})</h3>
          {categoryBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-surface-400 text-sm">
              No expense data recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => {
                const pct = totalCatExpenses > 0 ? Math.round((cat.amount / totalCatExpenses) * 100) : 0
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-surface-600 font-medium capitalize">{cat.name}</span>
                      <span className="font-semibold text-surface-800">{formatCurrency(cat.amount)}</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: cat.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
