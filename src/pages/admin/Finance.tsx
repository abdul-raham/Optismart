import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const monthlyData = [
  { month: 'Jan', revenue: 1200000, expenses: 450000, profit: 750000 },
  { month: 'Feb', revenue: 1850000, expenses: 520000, profit: 1330000 },
  { month: 'Mar', revenue: 1400000, expenses: 380000, profit: 1020000 },
  { month: 'Apr', revenue: 2100000, expenses: 610000, profit: 1490000 },
  { month: 'May', revenue: 1900000, expenses: 490000, profit: 1410000 },
  { month: 'Jun', revenue: 2800000, expenses: 700000, profit: 2100000 },
]

const categoryBreakdown = [
  { name: 'Salaries', amount: 850000, color: '#0A74FF' },
  { name: 'Marketing', amount: 120000, color: '#f59e0b' },
  { name: 'Logistics', amount: 45000, color: '#22c55e' },
  { name: 'Equipment', amount: 78000, color: '#a855f7' },
  { name: 'Utilities', amount: 35000, color: '#ef4444' },
  { name: 'Other', amount: 27000, color: '#94a3b8' },
]

const CustomBar = (props: any) => {
  const { fill, x, y, width, height } = props
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />
}

export function AdminFinance() {
  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0)
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses
  const profitMargin = Math.round((totalProfit / totalRevenue) * 100)

  const summaryCards = [
    { label: 'Total Revenue (H1)', value: totalRevenue, icon: DollarSign, color: 'brand', positive: true },
    { label: 'Total Expenses (H1)', value: totalExpenses, icon: TrendingDown, color: 'danger', positive: false },
    { label: 'Net Profit (H1)', value: totalProfit, icon: TrendingUp, color: 'success', positive: true },
    { label: 'Profit Margin', value: `${profitMargin}%`, icon: PieChart, color: 'purple', positive: true, isPercent: true },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Overview</h1>
          <p className="page-subtitle">Revenue, expenses and profit analysis</p>
        </div>
        <div className="text-sm text-surface-500 bg-white px-4 py-2 rounded-xl border border-surface-200">
          H1 2025 (Jan — Jun)
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {summaryCards.map((card, i) => {
          const Icon = card.icon
          const colorMap: Record<string, string> = {
            brand: 'bg-brand-50 text-brand-600',
            danger: 'bg-danger-50 text-danger-500',
            success: 'bg-success-50 text-success-600',
            purple: 'bg-purple-50 text-purple-600',
          }
          return (
            <motion.div key={card.label} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06 }}
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

      {/* Profit chart */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}
        className="bg-white rounded-2xl shadow-card border border-surface-100 p-6 mb-6">
        <div className="mb-5">
          <h3 className="font-semibold text-surface-800">Monthly Profit Trend</h3>
          <p className="text-sm text-surface-400">Net profit per month</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData} margin={{ top:5, right:10, left:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `₦${(v/1000000).toFixed(1)}M`} />
            <Tooltip formatter={(v) => [formatCurrency(v as number), 'Profit']}
              contentStyle={{ borderRadius:'12px', border:'1px solid #f1f5f9', boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }} />
            <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2.5} dot={{ fill:'#22c55e', r:4 }}
              activeDot={{ r:6, fill:'#22c55e' }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Bottom charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue vs Expenses bars */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
          className="bg-white rounded-2xl shadow-card border border-surface-100 p-6">
          <h3 className="font-semibold text-surface-800 mb-5">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top:5, right:10, left:0, bottom:0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₦${(v/1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v) => [formatCurrency(v as number)]}
                contentStyle={{ borderRadius:'12px', border:'1px solid #f1f5f9' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#0A74FF" shape={<CustomBar />} radius={[4,4,0,0]} maxBarSize={28} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" shape={<CustomBar />} radius={[4,4,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Expense breakdown */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
          className="bg-white rounded-2xl shadow-card border border-surface-100 p-6">
          <h3 className="font-semibold text-surface-800 mb-5">Expense Breakdown (Jun)</h3>
          <div className="space-y-3">
            {categoryBreakdown.map((cat) => {
              const pct = Math.round((cat.amount / categoryBreakdown.reduce((s,c) => s+c.amount, 0)) * 100)
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-surface-600 font-medium">{cat.name}</span>
                    <span className="font-semibold text-surface-800">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width:0 }}
                      animate={{ width:`${pct}%` }}
                      transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: cat.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
