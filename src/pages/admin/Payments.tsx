import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CreditCard, ReceiptText, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { TableSkeleton } from '@/components/shared/Skeletons'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Payment } from '@/types'

interface PaymentRow extends Payment {
  orders?: {
    order_number: string
    customer_name: string
    customer_phone: string
    status: string
  }
}

export function AdminPayments() {
  const { user } = useAuthStore()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          orders (
            order_number,
            customer_name,
            customer_phone,
            status
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPayments((data ?? []) as PaymentRow[])
    } catch (err) {
      console.error('Error fetching payments:', err)
    } finally {
      setLoading(false)
    }
  }

  const confirmPayment = async (payment: PaymentRow) => {
    if (!user?.id) return
    setUpdating(payment.id)
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', payment.id)

      if (error) throw error

      // Auto-advance the order status to 'confirmed'
      await supabase
        .from('orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', payment.order_id)
        .eq('status', 'pending') // only move if still pending

      await fetchPayments()
    } catch (err) {
      console.error('Error confirming payment:', err)
      alert('Failed to confirm payment.')
    } finally {
      setUpdating(null)
    }
  }

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high' | 'amount_low'>('newest')

  const filteredPayments = payments.filter((payment) => {
    const term = search.toLowerCase()
    const matchesSearch = (
      payment.orders?.order_number?.toLowerCase().includes(term) ||
      payment.orders?.customer_name?.toLowerCase().includes(term) ||
      payment.reference_code?.toLowerCase().includes(term) ||
      payment.receipt_number?.toLowerCase().includes(term)
    )

    if (!matchesSearch) return false

    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return (payment.status as string) === 'pending'
    if (statusFilter === 'confirmed') return (payment.status as string) === 'confirmed' || (payment.status as string) === 'delivered'
    if (statusFilter === 'outstanding') return (payment.status as string) === 'outstanding' || ((payment.status as string) === 'pending' && payment.orders?.status === 'pending')
    if (statusFilter === 'cancelled') return (payment.status as string) === 'cancelled' || payment.orders?.status === 'cancelled'

    return true
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sortBy === 'amount_high') return Number(b.amount) - Number(a.amount)
    if (sortBy === 'amount_low') return Number(a.amount) - Number(b.amount)
    return 0
  })

  // Calculate metrics for each status: count and total monetary value
  const pendingPayments = payments.filter(p => (p.status as string) === 'pending')
  const confirmedPayments = payments.filter(p => (p.status as string) === 'confirmed' || (p.status as string) === 'delivered')
  const outstandingPayments = payments.filter(p => (p.status as string) === 'outstanding' || ((p.status as string) === 'pending' && p.orders?.status === 'pending'))
  const cancelledPayments = payments.filter(p => (p.status as string) === 'cancelled' || p.orders?.status === 'cancelled')

  const pendingVal = pendingPayments.reduce((s, p) => s + Number(p.amount), 0)
  const confirmedVal = confirmedPayments.reduce((s, p) => s + Number(p.amount), 0)
  const outstandingVal = outstandingPayments.reduce((s, p) => s + Number(p.amount), 0)
  const cancelledVal = cancelledPayments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900">Payments & Transactions</h1>
          <p className="mt-1 text-sm text-surface-500">Track payment verification, status metrics, and sorting control.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input h-10 px-3 text-xs font-semibold bg-white border-surface-200 rounded-xl"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="amount_high">Sort: Amount (High to Low)</option>
            <option value="amount_low">Sort: Amount (Low to High)</option>
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input h-10 w-full pl-9 sm:w-64" placeholder="Search reference, customer..." />
          </div>
        </div>
      </div>

      {/* Metric Cards showing numbers AND ₦ values */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Pending Payments" count={pendingPayments.length} value={formatCurrency(pendingVal)} icon={CreditCard} tone="warning" />
        <SummaryCard title="Confirmed / Delivered" count={confirmedPayments.length} value={formatCurrency(confirmedVal)} icon={CheckCircle2} tone="success" />
        <SummaryCard title="Outstanding Balances" count={outstandingPayments.length} value={formatCurrency(outstandingVal)} icon={ReceiptText} tone="brand" />
        <SummaryCard title="Cancelled" count={cancelledPayments.length} value={formatCurrency(cancelledVal)} icon={ReceiptText} tone="danger" />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-200 pb-2 overflow-x-auto">
        {['all', 'pending', 'confirmed', 'outstanding', 'cancelled'].map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition-all whitespace-nowrap ${
              statusFilter === tab ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : filteredPayments.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <CreditCard className="h-8 w-8 text-brand-600" />
          </div>
          <h2 className="text-lg font-bold text-surface-900">No payments found</h2>
          <p className="mt-1 text-sm text-surface-500">No transactions match your current search or status filter.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="bg-surface-50/70 text-xs uppercase tracking-wider text-surface-500">
                <tr>
                  <th className="px-5 py-4 font-bold">Order #</th>
                  <th className="px-5 py-4 font-bold">Customer</th>
                  <th className="px-5 py-4 font-bold">Reference / Receipt</th>
                  <th className="px-5 py-4 font-bold">Amount</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                <AnimatePresence>
                  {filteredPayments.map((payment) => (
                    <motion.tr key={payment.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-surface-50/70">
                      <td className="px-5 py-4">
                        <p className="font-bold text-brand-700">{payment.orders?.order_number ?? 'Unknown order'}</p>
                        <p className="mt-0.5 text-xs text-surface-500">{formatDate(payment.created_at)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-surface-900">{payment.orders?.customer_name}</p>
                        <p className="mt-0.5 text-xs text-surface-500">{payment.orders?.customer_phone}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-bold text-surface-700">{payment.reference_code ?? 'No reference'}</p>
                        <p className="mt-0.5 font-mono text-xs text-surface-400">{payment.receipt_number}</p>
                      </td>
                      <td className="px-5 py-4 font-bold text-surface-900">{formatCurrency(payment.amount)}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          (payment.status as string) === 'confirmed' || (payment.status as string) === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          (payment.status as string) === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {payment.status === 'pending' ? (
                          <button onClick={() => confirmPayment(payment)} disabled={updating === payment.id} className="btn-primary h-9 px-3 text-xs">
                            {updating === payment.id ? 'Confirming...' : 'Confirm Payment'}
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-success-600">Verified</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-surface-100">
            <AnimatePresence>
              {filteredPayments.map((payment) => (
                <motion.div 
                  key={payment.id} 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                  className="p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-brand-700">{payment.orders?.order_number ?? 'Unknown order'}</p>
                      <p className="mt-1 font-semibold text-surface-900">{payment.orders?.customer_name}</p>
                      <p className="mt-0.5 text-xs text-surface-500">{payment.orders?.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-surface-900">{formatCurrency(payment.amount)}</p>
                      <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        payment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-surface-50 pt-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-surface-700">{payment.reference_code ?? 'No reference'}</p>
                      <p className="mt-0.5 font-mono text-xs text-surface-400">{payment.receipt_number}</p>
                    </div>
                    <div className="text-right">
                      {payment.status === 'pending' ? (
                        <button onClick={() => confirmPayment(payment)} disabled={updating === payment.id} className="btn-primary h-9 px-3 text-xs">
                          {updating === payment.id ? 'Confirming...' : 'Confirm'}
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-success-600">Verified</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, count, value, icon: Icon, tone }: { title: string; count: number; value: string; icon: React.ElementType; tone: 'brand' | 'warning' | 'success' | 'danger' }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600 border-brand-200',
    warning: 'bg-warning-50 text-warning-600 border-warning-200',
    success: 'bg-success-50 text-success-600 border-success-200',
    danger: 'bg-danger-50 text-danger-600 border-danger-200',
  }

  return (
    <div className="glass-card p-5 border shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-surface-100 text-surface-700">
          {count} transactions
        </span>
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-surface-500">{title}</p>
      <p className="mt-1 text-xl font-black text-surface-900">{value}</p>
    </div>
  )
}
