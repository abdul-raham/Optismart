import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CreditCard, ReceiptText, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
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
      await fetchPayments()
    } catch (err) {
      console.error('Error confirming payment:', err)
      alert('Failed to confirm payment.')
    } finally {
      setUpdating(null)
    }
  }

  const filteredPayments = payments.filter((payment) => {
    const term = search.toLowerCase()
    return (
      payment.orders?.order_number?.toLowerCase().includes(term) ||
      payment.orders?.customer_name?.toLowerCase().includes(term) ||
      payment.reference_code?.toLowerCase().includes(term) ||
      payment.receipt_number?.toLowerCase().includes(term)
    )
  })

  const pendingCount = payments.filter((payment) => payment.status === 'pending').length
  const confirmedCount = payments.filter((payment) => payment.status === 'confirmed').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900">Payments</h1>
          <p className="mt-1 text-sm text-surface-500">Confirm transactions and unlock the order lifecycle.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input h-10 w-full pl-9 sm:w-72" placeholder="Search payment..." />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Pending" value={pendingCount} icon={CreditCard} tone="warning" />
        <SummaryCard title="Confirmed" value={confirmedCount} icon={CheckCircle2} tone="success" />
        <SummaryCard title="Total Value" value={formatCurrency(payments.reduce((sum, payment) => sum + Number(payment.amount), 0))} icon={ReceiptText} tone="brand" />
      </div>

      {loading ? (
        <div className="glass-card h-72 animate-pulse bg-surface-100/60" />
      ) : filteredPayments.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <CreditCard className="h-8 w-8 text-brand-600" />
          </div>
          <h2 className="text-lg font-bold text-surface-900">No payments found</h2>
          <p className="mt-1 text-sm text-surface-500">New order payment records appear here automatically.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="bg-surface-50/70 text-xs uppercase tracking-wider text-surface-500">
                <tr>
                  <th className="px-5 py-4 font-bold">Order</th>
                  <th className="px-5 py-4 font-bold">Customer</th>
                  <th className="px-5 py-4 font-bold">Reference</th>
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
                        <span className={payment.status === 'confirmed' ? 'badge-green' : 'badge-yellow'}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {payment.status === 'pending' ? (
                          <button onClick={() => confirmPayment(payment)} disabled={updating === payment.id} className="btn-primary h-9 px-3 text-xs">
                            {updating === payment.id ? 'Confirming...' : 'Confirm'}
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-success-600">Confirmed</span>
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
                      <span className={`mt-2 inline-block ${payment.status === 'confirmed' ? 'badge-green' : 'badge-yellow'}`}>
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
                        <span className="text-xs font-bold text-success-600">Confirmed</span>
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

function SummaryCard({ title, value, icon: Icon, tone }: { title: string; value: string | number; icon: React.ElementType; tone: 'brand' | 'warning' | 'success' }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    warning: 'bg-warning-50 text-warning-600',
    success: 'bg-success-50 text-success-600',
  }

  return (
    <div className="glass-card p-5">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${colors[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-surface-500">{title}</p>
      <p className="mt-1 text-2xl font-black text-surface-900">{value}</p>
    </div>
  )
}
