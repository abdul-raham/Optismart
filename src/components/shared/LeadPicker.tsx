import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, MapPin, MessageCircle, Phone, Search, UserPlus, Users, X } from 'lucide-react'

export type PickerLead = { id: string; customer_name: string; phone: string; email?: string | null; location?: string | null; source?: string | null; dsa_id?: string | null; created_at?: string | null }

const digits = (v: string) => v.replace(/\D/g, '')
// 0803… and 234803… are the same number.
const phoneKey = (v: string) => { const d = digits(v); return d.startsWith('234') ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d }
const ago = (iso?: string | null) => {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Choosing the customer for an order: a clear button that opens a searchable list of the person's own leads. */
export function LeadPicker({ leads, value, onChange, ownerName, title = 'your leads' }: {
  leads: PickerLead[]; value: string; onChange: (leadId: string) => void
  ownerName?: (dsaId: string | null | undefined) => string | undefined; title?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const selected = leads.find(l => l.id === value)

  useEffect(() => { if (open) { setQ(''); setTimeout(() => input.current?.focus(), 150) } }, [open])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return leads
    const num = phoneKey(term)
    return leads.filter(l => l.customer_name.toLowerCase().includes(term) || (l.location || '').toLowerCase().includes(term)
      || (num.length >= 3 && phoneKey(l.phone).includes(num)) || (ownerName?.(l.dsa_id) || '').toLowerCase().includes(term))
  }, [leads, q, ownerName])

  const pick = (id: string) => { onChange(id); setOpen(false) }

  return (
    <>
      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-brand-500 bg-brand-50 p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{selected.customer_name.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-surface-900">{selected.customer_name}</p>
            <p className="truncate text-xs text-surface-600">{selected.phone}{selected.location ? ` · ${selected.location}` : ''}</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-sm">Change</button>
          <button type="button" onClick={() => onChange('')} aria-label="Use a walk-in customer instead" className="shrink-0 rounded-lg p-1.5 text-surface-500 hover:bg-white"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50 p-4 text-left transition hover:border-brand-600 active:scale-[0.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><Search className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-brand-800">Pick a customer from {title}</span>
            <span className="block text-xs text-brand-700">{leads.length} lead{leads.length === 1 ? '' : 's'} · search by name, phone or area</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-brand-600" />
        </button>
      )}
      {!selected && <p className="mt-1.5 text-xs text-surface-500">Picking a lead fills in the customer for you. New customer? Just fill the details below.</p>}

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
              <motion.div role="dialog" aria-modal="true" aria-label="Choose a customer"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[80vh] sm:max-w-lg sm:rounded-3xl">
                <div className="border-b border-surface-100 p-4 pb-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-surface-900">Choose a customer</h3>
                    <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                    <input ref={input} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, phone (080…) or area" autoComplete="off"
                      className="input h-12 rounded-xl pl-10 text-base" />
                  </div>
                  <p className="mt-2 text-xs text-surface-500">{q ? `${results.length} match${results.length === 1 ? '' : 'es'}` : `${leads.length} open lead${leads.length === 1 ? '' : 's'}, newest first`}</p>
                </div>
                <ul className="flex-1 overflow-y-auto overscroll-contain p-2">
                  {results.map(l => (
                    <li key={l.id}>
                      <button type="button" onClick={() => pick(l.id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-surface-50 active:bg-brand-50 ${l.id === value ? 'bg-brand-50' : ''}`}>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-100 text-xs font-bold text-surface-700">{l.customer_name.slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-semibold text-surface-900">{l.customer_name}</span>
                            {l.source === 'whatsapp' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><MessageCircle className="h-3 w-3" />WhatsApp</span>}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-surface-500">
                            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>
                            {l.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{l.location}</span></span>}
                            {ownerName && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{ownerName(l.dsa_id) || 'No DSA'}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-surface-400">{ago(l.created_at)}</span>
                      </button>
                    </li>
                  ))}
                  {!results.length && (
                    <li className="px-4 py-10 text-center text-sm text-surface-500">
                      {leads.length ? <>No lead matches &ldquo;{q}&rdquo;.</> : 'You have no open leads yet.'}
                      <span className="mt-1 block text-xs">Close this and enter the customer as a walk-in.</span>
                    </li>
                  )}
                </ul>
                <div className="border-t border-surface-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <button type="button" onClick={() => pick('')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-100 py-3 text-sm font-bold text-surface-800 hover:bg-surface-200">
                    <UserPlus className="h-4 w-4" /> Walk-in customer (not in my leads)
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

// One or two wrong digits (a typo) still counts as the same number.
const digitsOff = (a: string, b: string) => a.length === b.length ? [...a].filter((c, i) => c !== b[i]).length : Infinity
const words = (v: string) => v.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3)

/** Typed the customer in by hand? If the name or number looks like one of the leads, offer to use that lead, so the
 * order is linked to the WhatsApp chat it came from. */
export function LeadMatchHint({ leads, value, name, phone, onPick }: { leads: PickerLead[]; value: string; name: string; phone: string; onPick: (leadId: string) => void }) {
  const matches = useMemo(() => {
    if (value) return []
    const typed = phoneKey(phone), nameWords = words(name)
    if (typed.length < 10 && !nameWords.length) return []
    return leads
      .map(l => {
        const p = phoneKey(l.phone)
        const off = typed.length >= 10 && p.length >= 10 ? digitsOff(typed.slice(-10), p.slice(-10)) : Infinity
        const leadWords = words(l.customer_name)
        const sameName = nameWords.some(w => leadWords.some(lw => lw === w || (w.length >= 4 && (lw.startsWith(w) || w.startsWith(lw)))))
        const score = off === 0 ? 3 : off <= 2 ? 2 : sameName ? 1 : 0
        return { l, score }
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
  }, [leads, value, name, phone])
  if (!matches.length) return null
  return (
    <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">Is this one of your WhatsApp leads? Linking it counts the order for that chat.</p>
      {matches.map(({ l, score }) => (
        <div key={l.id} className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{l.customer_name.slice(0, 2).toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-surface-900">{l.customer_name}</span>
            <span className="block truncate text-xs text-surface-600">{l.phone}{score === 3 ? ' · same number' : score === 2 ? ' · almost the same number' : ' · similar name'}{l.created_at ? ` · ${ago(l.created_at)}` : ''}</span>
          </span>
          <button type="button" onClick={() => onPick(l.id)} className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">Use this lead</button>
        </div>
      ))}
    </div>
  )
}
