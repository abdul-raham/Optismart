import { useState, useEffect } from 'react'
import { Banknote, CheckCircle2, Clock, Wrench, Calendar, History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/shared/StatCard'
import { formatCurrency, formatDate } from '@/lib/utils'
import { jobPay } from '@/components/shared/InstallerPayouts'

const DONE = ['installed', 'completed']

export function InstallerEarnings() {
  const { user } = useAuthStore()
  const [jobs, setJobs] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) fetchEarnings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const fetchEarnings = async () => {
    try {
      const [j, p] = await Promise.all([
        supabase.from('installer_jobs')
          .select('*, orders ( order_number, customer_name, installation_price, installer_commission_pct )')
          .eq('installer_id', user?.id)
          .order('scheduled_date', { ascending: false }),
        supabase.from('installer_payouts').select('*').eq('installer_id', user?.id).order('created_at', { ascending: false }),
      ])
      setJobs(j.data ?? [])
      setPayouts(p.data ?? [])
    } catch (err) {
      console.error('Error fetching installer earnings:', err)
    } finally {
      setLoading(false)
    }
  }

  const owedJobs = jobs.filter(j => DONE.includes(j.status) && !j.payout_id)
  const openJobs = jobs.filter(j => !DONE.includes(j.status))
  const owed = owedJobs.reduce((s, j) => s + jobPay(j), 0)
  const upcoming = openJobs.reduce((s, j) => s + jobPay(j), 0)
  const paidToDate = payouts.reduce((s, p) => s + Number(p.amount), 0)

  const tag = (j: any) => j.payout_id ? ['Paid', 'bg-surface-100 text-surface-600']
    : DONE.includes(j.status) ? ['Owed', 'bg-emerald-50 text-emerald-700']
    : ['In progress', 'bg-amber-50 text-amber-800']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-900">Earnings</h1>
        <p className="mt-1 text-sm text-surface-500">Each finished job adds to <strong className="text-surface-800">Owed</strong>. When admin pays you, it goes back to ₦0 and the payment shows below.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Owed to you now" value={formatCurrency(owed)} icon={Banknote} color="success" />
        <StatCard title={`In progress (${openJobs.length} job${openJobs.length === 1 ? '' : 's'})`} value={formatCurrency(upcoming)} icon={Clock} color="warning" />
        <StatCard title="Paid to date" value={formatCurrency(paidToDate)} icon={CheckCircle2} color="brand" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-100 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-surface-900"><Wrench className="h-5 w-5 text-brand-600" /> Jobs and pay</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-surface-400">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="mx-auto mb-3 h-12 w-12 text-surface-300" />
            <h3 className="mb-1 text-lg font-bold text-surface-900">No jobs yet</h3>
            <p className="text-sm text-surface-500">Jobs admin gives you appear here with what you get for each.</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-surface-500">
                  <th className="sticky left-0 top-0 z-30 border-b border-surface-100 bg-surface-50 px-5 py-3 font-bold">Order</th>
                  <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 font-bold">Customer</th>
                  <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 font-bold">Date</th>
                  <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 font-bold">Pay status</th>
                  <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right font-bold">You get</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const [label, cls] = tag(job)
                  return (
                    <tr key={job.id} className="group hover:bg-surface-50">
                      <td className="sticky left-0 z-10 border-b border-surface-100 bg-white px-5 py-3 font-bold text-surface-900 group-hover:bg-surface-50">{job.orders?.order_number || '—'}</td>
                      <td className="border-b border-surface-100 px-5 py-3 text-surface-700">{job.orders?.customer_name || 'Customer'}</td>
                      <td className="border-b border-surface-100 px-5 py-3 text-surface-600">
                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-surface-400" />{formatDate(job.completed_at || job.scheduled_date || job.created_at)}</span>
                      </td>
                      <td className="border-b border-surface-100 px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span></td>
                      <td className="border-b border-surface-100 px-5 py-3 text-right font-bold text-surface-900">{formatCurrency(jobPay(job))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payouts.length > 0 && (
        <div className="glass-card overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-surface-100 p-5 text-base font-bold text-surface-900"><History className="h-5 w-5 text-brand-600" /> Payments received</h2>
          <ul className="divide-y divide-surface-100">
            {payouts.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-surface-600">{formatDate(p.created_at)} · {p.jobs_count} job{p.jobs_count === 1 ? '' : 's'}{p.note ? ` · ${p.note}` : ''}</span>
                <strong className="text-surface-900">{formatCurrency(p.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
