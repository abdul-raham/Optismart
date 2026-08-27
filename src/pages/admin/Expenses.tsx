import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Plus, Search, Banknote, Wallet, TrendingDown, Calendar, FileText, X, Filter } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TableSkeleton } from '@/components/shared/Skeletons'
import type { Expense, ExpenseCategory, Order, User } from '@/types'

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'advertising', label: 'Advertising / Ad Cost' },
  { value: 'remittance', label: 'DSA Remittance' },
  { value: 'commission', label: 'Commission Expense' },
  { value: 'delivery', label: 'Delivery Cost' },
  { value: 'waybill', label: 'Waybill Cost' },
  { value: 'dsa_salary', label: 'DSA Salary' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other Expenses' },
]

export function AdminExpenses() {
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [timeframe, setTimeframe] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dsas, setDsas] = useState<Pick<User, 'id' | 'full_name'>[]>([])
  const [orders, setOrders] = useState<Pick<Order, 'id' | 'order_number' | 'customer_name' | 'dsa_id'>[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    description: '',
    category: 'delivery' as ExpenseCategory,
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    expense_scope: 'daily' as 'daily' | 'order_specific',
    dsa_id: '',
    order_id: '',
  })

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      const [expensesRes, dsasRes, ordersRes] = await Promise.all([
        supabase.from('expenses').select('*, poster:users!expenses_posted_by_fkey(full_name), dsa:users!expenses_dsa_id_fkey(full_name), order:orders!expenses_order_id_fkey(order_number, customer_name)').order('expense_date', { ascending: false }),
        supabase.from('users').select('id, full_name').eq('role', 'dsa').order('full_name'),
        supabase.from('orders').select('id, order_number, customer_name, dsa_id').order('created_at', { ascending: false }).limit(500),
      ])
      if (expensesRes.error) throw expensesRes.error
      if (dsasRes.error) throw dsasRes.error
      if (ordersRes.error) throw ordersRes.error
      setExpenses((expensesRes.data ?? []) as any[])
      setDsas((dsasRes.data ?? []) as any[])
      setOrders((ordersRes.data ?? []) as any[])
    } catch (err) {
      console.error('Error fetching expenses:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    try {
      if (form.expense_scope === 'order_specific' && !form.order_id) {
        throw new Error('Please select the order linked to this expense.')
      }

      const { error } = await supabase
        .from('expenses')
        .insert([{ 
          description: form.description,
          category: form.category,
          amount: Number(form.amount),
          expense_date: form.expense_date,
          dsa_id: form.dsa_id || null,
          order_id: form.order_id || null,
          posted_by: user.id,
        }])

      if (error) throw error
      setIsModalOpen(false)
      setForm({ description: '', category: 'delivery', amount: '', expense_date: new Date().toISOString().split('T')[0], expense_scope: 'daily', dsa_id: '', order_id: '' })
      await fetchExpenses()
    } catch (err: any) {
      console.error('Error creating expense:', err)
      alert(`Failed to save expense: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(search.toLowerCase()) || expense.category.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
    
    // Custom Date Range Filtering (From Date & To Date)
    let matchesDateRange = true
    if (startDate) {
      matchesDateRange = matchesDateRange && expense.expense_date >= startDate
    }
    if (endDate) {
      matchesDateRange = matchesDateRange && expense.expense_date <= endDate
    }

    // Timeframe filtering logic
    const expDate = new Date(expense.expense_date)
    const now = new Date()
    let matchesTimeframe = true

    if (timeframe === 'daily') {
      matchesTimeframe = expense.expense_date === now.toISOString().split('T')[0]
    } else if (timeframe === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      matchesTimeframe = expDate >= oneWeekAgo
    } else if (timeframe === 'monthly') {
      matchesTimeframe = expense.expense_date.startsWith(now.toISOString().slice(0, 7))
    } else if (timeframe === 'yearly') {
      matchesTimeframe = expense.expense_date.startsWith(now.getFullYear().toString())
    }

    return matchesSearch && matchesCategory && matchesTimeframe && matchesDateRange
  }).sort((a, b) => {
    if (sortBy === 'date_desc') return new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
    if (sortBy === 'date_asc') return new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
    if (sortBy === 'amount_desc') return Number(b.amount) - Number(a.amount)
    if (sortBy === 'amount_asc') return Number(a.amount) - Number(b.amount)
    return 0
  })

  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const thisMonthAmount = expenses.filter(exp => exp.expense_date?.startsWith(currentMonthStr)).reduce((sum, exp) => sum + Number(exp.amount || 0), 0)

  // Category Summary Breakdown Calculations
  const adExpenses = filteredExpenses
    .filter(e => ['advertising', 'ad_cost', 'marketing'].includes(e.category.toLowerCase()))
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const remittanceExpenses = filteredExpenses
    .filter(e => ['dsa_remittance', 'commissions', 'commission'].includes(e.category.toLowerCase()))
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const deliveryExpenses = filteredExpenses
    .filter(e => ['delivery', 'waybill', 'logistics', 'shipping'].includes(e.category.toLowerCase()))
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const operationalExpenses = filteredExpenses
    .filter(e => !['advertising', 'ad_cost', 'marketing', 'dsa_remittance', 'commissions', 'commission', 'delivery', 'waybill', 'logistics', 'shipping'].includes(e.category.toLowerCase()))
    .reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Expense Records</h1>
          <p className="text-sm text-surface-500 mt-1">Track operational costs, ad expenses, remittances, and date range analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="input h-10 px-3 text-xs font-semibold bg-white">
            <option value="date_desc">Sort: Newest Date</option>
            <option value="date_asc">Sort: Oldest Date</option>
            <option value="amount_desc">Sort: Amount (High to Low)</option>
            <option value="amount_asc">Sort: Amount (Low to High)</option>
          </select>

          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-xl text-xs font-semibold outline-none w-full sm:w-48 transition-all bg-white"
            />
          </div>
          
          <button onClick={() => setIsModalOpen(true)} className="btn-primary h-10 px-4 text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Log Expense
          </button>
        </div>
      </div>

      {/* Date Range & Timeframe Filter Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['all', 'daily', 'weekly', 'monthly', 'yearly'].map(t => (
            <button
              key={t}
              onClick={() => {
                setTimeframe(t as any)
                setStartDate('')
                setEndDate('')
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl capitalize transition-all whitespace-nowrap ${
                timeframe === t && !startDate && !endDate ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {t === 'all' ? 'All Time' : t}
            </button>
          ))}
        </div>

        {/* Date Range Picker (From & To Date) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-surface-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-brand-600" /> From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value)
                setTimeframe('all')
              }}
              className="input h-8 text-xs py-0 px-2 bg-white rounded-lg border-surface-200"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-surface-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value)
                setTimeframe('all')
              }}
              className="input h-8 text-xs py-0 px-2 bg-white rounded-lg border-surface-200"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200"
            >
              Clear Date Filter
            </button>
          )}

          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input h-8 px-2 text-xs bg-white w-44 rounded-lg">
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
        </div>
      </div>

      {/* Expense Category Summary Breakdown Grid */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${searchParams.get('highlight') === 'breakdown' ? 'animate-feature-glow p-2 rounded-2xl border border-brand-500' : ''}`}>
        <div className="glass-card border border-cyan-100 bg-cyan-50/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Ads &amp; Marketing</span>
            <span className="text-[10px] font-extrabold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
              {totalAmount > 0 ? `${Math.round((adExpenses / totalAmount) * 100)}%` : '0%'}
            </span>
          </div>
          <p className="text-xl font-black text-surface-900">{formatCurrency(adExpenses)}</p>
        </div>

        <div className="glass-card border border-emerald-100 bg-emerald-50/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">DSA Remittance</span>
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {totalAmount > 0 ? `${Math.round((remittanceExpenses / totalAmount) * 100)}%` : '0%'}
            </span>
          </div>
          <p className="text-xl font-black text-surface-900">{formatCurrency(remittanceExpenses)}</p>
        </div>

        <div className="glass-card border border-amber-100 bg-amber-50/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Delivery &amp; Waybill</span>
            <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {totalAmount > 0 ? `${Math.round((deliveryExpenses / totalAmount) * 100)}%` : '0%'}
            </span>
          </div>
          <p className="text-xl font-black text-surface-900">{formatCurrency(deliveryExpenses)}</p>
        </div>

        <div className="glass-card border border-indigo-100 bg-indigo-50/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">Operational &amp; Other</span>
            <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              {totalAmount > 0 ? `${Math.round((operationalExpenses / totalAmount) * 100)}%` : '0%'}
            </span>
          </div>
          <p className="text-xl font-black text-surface-900">{formatCurrency(operationalExpenses)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-surface-500">Total Filtered Expenses</p>
          <p className="mt-1 text-2xl font-black text-surface-900">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-50 text-warning-600">
            <TrendingDown className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-surface-500">This Month's Expenses</p>
          <p className="mt-1 text-2xl font-black text-surface-900">{formatCurrency(thisMonthAmount)}</p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filteredExpenses.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Banknote className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No expenses logged</h3>
          <p className="text-surface-500 max-w-md">Keep track of your company's operational spending here.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50/50 border-b border-surface-100">
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider">Date</th>
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider">Description</th>
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider">Category</th>
                  <th className="py-4 px-5 text-xs font-bold text-surface-500 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="text-sm font-semibold text-surface-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-surface-400" />
                        {formatDate(exp.expense_date)}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-bold text-surface-900">{exp.description}</div>
                      <div className="text-xs text-surface-500 mt-0.5">Logged by {(exp.poster as any)?.full_name || 'System'}</div>
                      <div className="mt-1 text-xs text-surface-400">{(exp.dsa as any)?.full_name ? `DSA: ${(exp.dsa as any).full_name}` : 'Company-wide'}{(exp.order as any)?.order_number ? ` · Order: ${(exp.order as any).order_number}` : ''}</div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="badge-gray uppercase text-[10px] tracking-wider">{exp.category}</span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="text-sm font-bold text-surface-900">{formatCurrency(exp.amount)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-surface-100">
            {filteredExpenses.map(exp => (
              <div key={exp.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="badge-gray uppercase text-[10px] tracking-wider mb-2 block w-fit">{exp.category}</span>
                    <p className="font-bold text-surface-900 text-sm leading-tight">{exp.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-brand-700">{formatCurrency(exp.amount)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-500 border-t border-surface-50 pt-2">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(exp.expense_date)}</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {(exp.poster as any)?.full_name || 'System'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
            onClick={() => !submitting && setIsModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50/50">
              <h2 className="text-lg font-bold text-surface-900">Log New Expense</h2>
              <button onClick={() => !submitting && setIsModalOpen(false)} className="text-surface-400 hover:text-surface-900 transition-colors p-1 rounded-md hover:bg-surface-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div>
                <label className="label">Description *</label>
                <input required type="text" className="input" placeholder="e.g. Facebook Ads" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Category *</label>
                  <select required className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value as any})}>
                    {EXPENSE_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input required type="date" className="input" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} />
                </div>
              </div>

              {/* Scope Selection: Daily vs Order-specific */}
              <div>
                <label className="label">Expense Type / Scope *</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-surface-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, expense_scope: 'daily', order_id: '', dsa_id: '' })}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      form.expense_scope === 'daily' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-600 hover:text-surface-900'
                    }`}
                  >
                    Daily / General Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, expense_scope: 'order_specific' })}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      form.expense_scope === 'order_specific' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-600 hover:text-surface-900'
                    }`}
                  >
                    Single DSA Order
                  </button>
                </div>
              </div>

              {form.expense_scope === 'order_specific' && (
                <div className="p-3 bg-brand-50/60 border border-brand-200/60 rounded-xl space-y-3">
                  <div>
                    <label className="label text-brand-900 text-xs">Select DSA Order *</label>
                    <select
                      required={form.expense_scope === 'order_specific'}
                      className="input bg-white text-xs"
                      value={form.order_id}
                      onChange={e => {
                        const order = orders.find(item => item.id === e.target.value)
                        setForm({ ...form, order_id: e.target.value, dsa_id: order?.dsa_id || form.dsa_id })
                      }}
                    >
                      <option value="">Select order number...</option>
                      {orders.map(order => (
                        <option key={order.id} value={order.id}>
                          {order.order_number} — {order.customer_name}
                        </option>
                      ))}
                    </select>
                  </div>

              {/* Assigned DSA (Optional) */}
              <div>
                <label className="label">Assigned DSA / Sales Agent (Optional)</label>
                <select
                  className="input bg-white text-xs"
                  value={form.dsa_id}
                  onChange={e => setForm({ ...form, dsa_id: e.target.value })}
                >
                  <option value="">No specific DSA assigned (General expense)</option>
                  {dsas.map(dsa => (
                    <option key={dsa.id} value={dsa.id}>{dsa.full_name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-surface-400 mt-1">Assigning a DSA tracks ad spend & cost allocation on their user report.</p>
              </div>
                </div>
              )}

              <div>
                <label className="label">Amount (₦) *</label>
                <input required type="number" min={1} className="input font-bold text-lg text-brand-700" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting} className="btn-outline">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary w-32 flex items-center justify-center">
                  {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  )
}
