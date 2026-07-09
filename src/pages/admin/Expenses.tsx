import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Plus, Search, Banknote, Wallet, TrendingDown, Calendar, FileText, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types'

export function AdminExpenses() {
  const { user } = useAuthStore()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    description: '',
    category: 'logistics' as ExpenseCategory,
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          poster:posted_by (full_name)
        `)
        .order('expense_date', { ascending: false })

      if (error) throw error
      if (data) setExpenses(data as any[])
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
      const { error } = await supabase
        .from('expenses')
        .insert([{ 
          ...form, 
          amount: Number(form.amount),
          posted_by: user.id 
        }])

      if (error) throw error
      setIsModalOpen(false)
      setForm({ description: '', category: 'logistics', amount: '', expense_date: new Date().toISOString().split('T')[0] })
      await fetchExpenses()
    } catch (err: any) {
      console.error('Error creating expense:', err)
      alert(`Failed to save expense: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredExpenses = expenses.filter(e => 
    e.description.toLowerCase().includes(search.toLowerCase()) || 
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const thisMonthAmount = expenses
    .filter(e => new Date(e.expense_date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Expenses</h1>
          <p className="text-sm text-surface-500 mt-1">Track internal company costs and operational overhead.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-64 transition-all"
            />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Log Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-surface-500">Total Expenses All-Time</p>
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

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center animate-pulse bg-surface-50/50">
            <div className="text-surface-400 text-sm font-semibold">Loading expenses...</div>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
              <Banknote className="w-8 h-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 mb-2">No expenses logged</h3>
            <p className="text-surface-500 max-w-md">Keep track of your company's operational spending here.</p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category *</label>
                  <select required className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value as any})}>
                    <option value="logistics">Logistics</option>
                    <option value="marketing">Marketing</option>
                    <option value="salaries">Salaries</option>
                    <option value="utilities">Utilities</option>
                    <option value="equipment">Equipment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input required type="date" className="input" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} />
                </div>
              </div>

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
