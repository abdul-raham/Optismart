import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type NextClose = { month: string; due_at: string; open_orders: number }

/** Orders pages: when the month closes and how many open orders it will cancel (yours, or everyone's for admins).
 * Shown from 7 days before a close, and only while there are open orders it would cancel. */
export function MonthCloseBanner({ admin }: { admin?: boolean }) {
  const [next, setNext] = useState<NextClose | null>(null)
  useEffect(() => {
    supabase.rpc('next_month_close').then(({ data }) => setNext(((data as NextClose[] | null) || [])[0] ?? null))
  }, [])
  if (!next || !next.open_orders) return null
  const due = new Date(next.due_at)
  const daysLeft = (due.getTime() - Date.now()) / 86400000
  if (daysLeft > 7 || daysLeft < 0) return null
  const when = due.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
  const month = new Date(`${next.month}T12:00:00Z`).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${daysLeft < 1 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <CalendarClock className={`mt-0.5 h-5 w-5 shrink-0 ${daysLeft < 1 ? 'text-red-600' : 'text-amber-600'}`} />
      <div className="text-sm">
        <p className="font-bold text-surface-900">{month} closes {when}</p>
        <p className="mt-0.5 text-surface-700">
          {next.open_orders} {admin ? 'orders are' : `of your orders ${next.open_orders === 1 ? 'is' : 'are'}`} still not marked delivered.
          {admin
            ? ' Mark the delivered ones with the day they were delivered; at the close the rest are cancelled and the month is locked.'
            : ' Ask an admin to mark the delivered ones (with the day they were delivered) before then; the rest will be cancelled. A cancelled order that was really delivered can be restored later.'}
        </p>
      </div>
    </div>
  )
}
