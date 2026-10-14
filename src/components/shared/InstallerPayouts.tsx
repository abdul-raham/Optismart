import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Banknote, CheckCircle2, History, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { defaultInstallerPay } from './InstallerPicker'

const DONE = ['installed', 'completed']
export const jobPay = (j: any) => Number(j.commission_amount ?? defaultInstallerPay(j.orders?.installation_price, j.orders?.installer_commission_pct))

/** Admin: what each installer is owed, "Mark as paid" to reset it, and the payout history. */
export function InstallerPayouts({ installers }: { installers: { id: string; full_name: string; phone?: string | null }[] }) {
  const [jobs, setJobs] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [paying, setPaying] = useState<{ id: string; name: string; owed: number; count: number } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [j, p] = await Promise.all([
      supabase.from('installer_jobs').select('id, installer_id, status, commission_amount, payout_id, orders(order_number, installation_price, installer_commission_pct)').neq('status', 'rejected'),
      supabase.from('installer_payouts').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setJobs(j.data ?? [])
    setPayouts(p.data ?? [])
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => installers.map(i => {
    const mine = jobs.filter(j => j.installer_id === i.id)
    const unpaid = mine.filter(j => DONE.includes(j.status) && !j.payout_id)
    const upcoming = mine.filter(j => !DONE.includes(j.status))
    const paid = payouts.filter(p => p.installer_id === i.id)
    return {
      ...i,
      owed: unpaid.reduce((s, j) => s + jobPay(j), 0), owedCount: unpaid.length,
      upcoming: upcoming.reduce((s, j) => s + jobPay(j), 0), upcomingCount: upcoming.length,
      paidTotal: paid.reduce((s, p) => s + Number(p.amount), 0), lastPaid: paid[0]?.created_at as string | undefined,
    }
  }).sort((a, b) => b.owed - a.owed || b.upcoming - a.upcoming), [installers, jobs, payouts])

  const totalOwed = rows.reduce((s, r) => s + r.owed, 0)
  const nameOf = (id: string) => installers.find(i => i.id === id)?.full_name || 'Installer'

  const confirmPaid = async () => {
    if (!paying) return
    setBusy(true)
    const { error } = await supabase.rpc('record_installer_payout', { p_installer_id: paying.id, p_note: note })
    setBusy(false)
    if (error) return alert(error.message)
    setPaying(null)
    setNote('')
    load()
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-surface-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Banknote className="h-4 w-4" /></span>
          <div>
            <h2 className="text-base font-bold text-surface-900">Payouts</h2>
            <p className="text-xs text-surface-500"><strong className="text-surface-800">Pay the installer first, then tap Mark as paid.</strong> Their balance resets to ₦0.</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-700">{formatCurrency(totalOwed)} owed in total</span>
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wider text-surface-500">
              <th className="sticky left-0 top-0 z-30 border-b border-surface-100 bg-surface-50 px-5 py-3">Installer</th>
              <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right">Owed now</th>
              <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right">Jobs in progress</th>
              <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right">Paid to date</th>
              <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-surface-400">No installers yet.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="group hover:bg-surface-50">
                <td className="sticky left-0 z-10 border-b border-surface-100 bg-white px-5 py-3 font-bold text-surface-900 group-hover:bg-surface-50">
                  {r.full_name}
                  {r.lastPaid && <span className="block text-[11px] font-normal text-surface-500">Last paid {formatDate(r.lastPaid)}</span>}
                </td>
                <td className="border-b border-surface-100 px-5 py-3 text-right">
                  <span className={`font-bold ${r.owed > 0 ? 'text-emerald-700' : 'text-surface-400'}`}>{formatCurrency(r.owed)}</span>
                  {r.owedCount > 0 && <span className="block text-[11px] text-surface-500">{r.owedCount} finished job{r.owedCount === 1 ? '' : 's'}</span>}
                </td>
                <td className="border-b border-surface-100 px-5 py-3 text-right text-surface-600">
                  {r.upcomingCount > 0 ? <>{formatCurrency(r.upcoming)}<span className="block text-[11px] text-surface-500">{r.upcomingCount} not finished</span></> : '—'}
                </td>
                <td className="border-b border-surface-100 px-5 py-3 text-right font-semibold text-surface-800">{formatCurrency(r.paidTotal)}</td>
                <td className="border-b border-surface-100 px-5 py-3 text-right">
                  <button disabled={r.owed <= 0} onClick={() => setPaying({ id: r.id, name: r.full_name, owed: r.owed, count: r.owedCount })}
                    className="btn-primary h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40">Mark as paid</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payouts.length > 0 && (
        <details className="border-t border-surface-100">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-xs font-bold text-surface-600 hover:bg-surface-50">
            <History className="h-3.5 w-3.5" /> Payout history ({payouts.length})
          </summary>
          <ul className="divide-y divide-surface-100">
            {payouts.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span><strong className="text-surface-900">{nameOf(p.installer_id)}</strong> <span className="text-surface-500">· {p.jobs_count} job{p.jobs_count === 1 ? '' : 's'}{p.note ? ` · ${p.note}` : ''}</span></span>
                <span className="shrink-0 text-right"><strong className="text-surface-900">{formatCurrency(p.amount)}</strong><span className="block text-[11px] text-surface-500">{formatDate(p.created_at)}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <AnimatePresence>
        {paying && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-950/60 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-sm space-y-4 rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-surface-900">Mark as paid</h3>
                <button onClick={() => setPaying(null)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100"><X className="h-5 w-5" /></button>
              </div>
              <p className="text-sm text-surface-600">
                You paid <strong className="text-surface-900">{paying.name}</strong> <strong className="text-surface-900">{formatCurrency(paying.owed)}</strong> for {paying.count} finished job{paying.count === 1 ? '' : 's'}?
                Their balance goes back to ₦0 and they get a notification. This can&apos;t be undone here.
              </p>
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" placeholder="e.g. Transfer ref 12345" value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setPaying(null)} className="btn-outline">Cancel</button>
                <button disabled={busy} onClick={confirmPaid} className="btn-primary flex items-center gap-1.5 px-4">
                  <CheckCircle2 className="h-4 w-4" /> {busy ? 'Saving…' : 'Yes, I paid'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
