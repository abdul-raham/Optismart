import { Wrench } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export interface InstallerChoice { installerId: string; pay: number | '' }
export const INSTALLER_NONE: InstallerChoice = { installerId: '', pay: '' }

/** Installer's default pay: their share of the installation fee (60% unless the order says otherwise). */
export const defaultInstallerPay = (fee: number, pct?: number | null) => Math.round((Number(fee) || 0) * (pct ?? 60) / 100)

/** Who installs this order, and what they are paid for it (adds to their Earnings once the job is done). */
export function InstallerPicker({ installers, fee, pct, value, onChange, locked }: {
  installers: { id: string; full_name: string }[]
  fee: number
  pct?: number | null
  value: InstallerChoice
  onChange: (v: InstallerChoice) => void
  locked?: boolean
}) {
  const fallback = defaultInstallerPay(fee, pct)
  return (
    <div className="grid gap-3 rounded-xl border border-surface-200 bg-surface-50/60 p-3 sm:grid-cols-[1fr_140px]">
      <div>
        <label className="label flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-brand-600" /> Installer</label>
        <select className="input h-10 text-sm" value={value.installerId} disabled={locked}
          onChange={e => onChange({ ...value, installerId: e.target.value })}>
          <option value="">Not assigned yet</option>
          {installers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Installer gets (₦)</label>
        <input type="number" min={0} className="input h-10 text-sm" disabled={locked || !value.installerId}
          placeholder={String(fallback)} value={value.pay}
          onChange={e => onChange({ ...value, pay: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })} />
      </div>
      <p className="text-[11px] text-surface-500 sm:col-span-2">
        {locked ? 'This job has already been paid out, so its installer and pay are locked.'
          : value.installerId ? `Shows on their Earnings page now; adds to what they're owed when the job is done. Leave the pay empty for ${formatCurrency(fallback)} (${pct ?? 60}% of the fee).`
          : 'Pick the installer now, or later from the order list.'}
      </p>
    </div>
  )
}
