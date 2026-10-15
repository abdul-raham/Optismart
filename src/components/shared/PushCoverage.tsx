import { useEffect, useState } from 'react'
import { BellRing, BellOff, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

interface Row { user_id: string; full_name: string; email: string; role: string; devices: number; last_seen_at: string | null }

/** Admin: how many people get phone notifications, and who still has to turn them on. */
export function PushCoverage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.rpc('push_notification_status').then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows((data ?? []) as Row[])
    })
  }, [])

  if (error) return null
  if (!rows) return <div className="glass-card h-16 animate-pulse" />
  const on = rows.filter(r => r.devices > 0)
  const off = rows.filter(r => r.devices === 0)
  const pct = rows.length ? Math.round((on.length / rows.length) * 100) : 0

  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-50">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${off.length ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><BellRing className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-surface-900">Phone notifications: {on.length} of {rows.length} people</p>
          <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {off.length > 0 && <span className="hidden text-xs font-semibold text-amber-700 sm:inline">{off.length} not on yet</span>}
        <ChevronDown className={`h-4 w-4 text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-surface-100">
          <p className="bg-surface-50 px-5 py-2 text-[11px] text-surface-500">Everyone is asked each time they open the portal until it&apos;s on. iPhone users must add OptiSmart to their Home Screen first.</p>
          <ul className="divide-y divide-surface-100">
            {[...off, ...on].map(r => (
              <li key={r.user_id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-surface-900">{r.full_name || r.email}</span>
                  <span className="text-xs capitalize text-surface-500">{r.role.replace('_', ' ')}</span>
                </span>
                {r.devices > 0
                  ? <span className="shrink-0 text-right text-xs font-semibold text-emerald-700">On · {r.devices} device{r.devices === 1 ? '' : 's'}{r.last_seen_at && <span className="block font-normal text-surface-400">seen {formatDate(r.last_seen_at)}</span>}</span>
                  : <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700"><BellOff className="h-3.5 w-3.5" /> Off</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
