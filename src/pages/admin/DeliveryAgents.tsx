import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, Plus, Phone, MapPin, Pencil, X, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { GuideTip } from '@/components/shared/GuideTip'

interface Agent { id: string; full_name: string; phone: string | null; area: string | null; notes: string | null; is_active: boolean }
interface AgentOrder { delivery_agent_id: string; total_amount: number; delivery_fee: number; amount_remitted: number | null; status: string }

const EMPTY = { full_name: '', phone: '', area: '', notes: '', is_active: true }

/** People who deliver orders. No login: they are only picked on orders so we can track fees and remittances. */
export function AdminDeliveryAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [orders, setOrders] = useState<AgentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Agent | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [a, o] = await Promise.all([
      supabase.from('delivery_agents').select('*').order('full_name'),
      supabase.from('orders').select('delivery_agent_id, total_amount, delivery_fee, amount_remitted, status').not('delivery_agent_id', 'is', null),
    ])
    if (a.error) console.error(a.error)
    setAgents(a.data ?? [])
    setOrders(o.data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const totals = useMemo(() => {
    const m = new Map<string, { count: number; fees: number; remitted: number; due: number }>()
    for (const o of orders) {
      if (o.status === 'cancelled') continue
      const t = m.get(o.delivery_agent_id) || { count: 0, fees: 0, remitted: 0, due: 0 }
      t.count += 1
      t.fees += Number(o.delivery_fee || 0)
      t.remitted += Number(o.amount_remitted || 0)
      t.due += Number(o.total_amount || 0)
      m.set(o.delivery_agent_id, t)
    }
    return m
  }, [orders])

  const open = (a: Agent | 'new') => {
    setEditing(a)
    setForm(a === 'new' ? EMPTY : { full_name: a.full_name, phone: a.phone || '', area: a.area || '', notes: a.notes || '', is_active: a.is_active })
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const row = { full_name: form.full_name.trim(), phone: form.phone.trim() || null, area: form.area.trim() || null, notes: form.notes.trim() || null, is_active: form.is_active }
    const { error } = editing === 'new'
      ? await supabase.from('delivery_agents').insert(row)
      : await supabase.from('delivery_agents').update(row).eq('id', (editing as Agent).id)
    setSaving(false)
    if (error) return alert(error.message)
    setEditing(null)
    load()
  }

  const shown = agents.filter(a => `${a.full_name} ${a.phone || ''} ${a.area || ''}`.toLowerCase().includes(search.toLowerCase()))
  const sum = (k: 'fees' | 'remitted' | 'count') => [...totals.values()].reduce((s, t) => s + t[k], 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900">Delivery agents</h1>
          <p className="mt-1 text-sm text-surface-500">The people who deliver our orders. No login needed: pick them on an order to track fees and money remitted.</p>
        </div>
        <button onClick={() => open('new')} className="btn-primary flex h-10 items-center gap-1.5 px-4 text-sm"><Plus className="h-4 w-4" /> Add agent</button>
      </div>

      <GuideTip guideKey="agents" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Agents', String(agents.filter(a => a.is_active).length)],
          ['Orders delivered', String(sum('count'))],
          ['Delivery fees paid', formatCurrency(sum('fees'))],
          ['Money remitted', formatCurrency(sum('remitted'))],
        ].map(([label, value]) => (
          <div key={label} className="glass-card p-4">
            <p className="text-xs font-semibold text-surface-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-surface-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="border-b border-surface-100 p-4">
          <div className="relative sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents…" className="input h-10 pl-9 text-sm" />
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wider text-surface-500">
                <th className="sticky left-0 top-0 z-30 border-b border-surface-100 bg-surface-50 px-5 py-3">Agent</th>
                <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3">Area</th>
                <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right">Orders</th>
                <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right">Order value</th>
                <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right">Remitted</th>
                <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-5 py-3 text-right">Delivery fees</th>
                <th className="sticky top-0 z-20 border-b border-surface-100 bg-surface-50 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-surface-400">Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center">
                  <Truck className="mx-auto mb-2 h-8 w-8 text-surface-300" />
                  <p className="font-semibold text-surface-700">No delivery agents yet</p>
                  <p className="text-xs text-surface-500">Tap “Add agent” to add the first one.</p>
                </td></tr>
              ) : shown.map(a => {
                const t = totals.get(a.id) || { count: 0, fees: 0, remitted: 0, due: 0 }
                const short = t.due - t.remitted
                return (
                  <tr key={a.id} className="group hover:bg-surface-50">
                    <td className="sticky left-0 z-10 border-b border-surface-100 bg-white px-5 py-3 group-hover:bg-surface-50">
                      <p className="font-bold text-surface-900">{a.full_name} {!a.is_active && <span className="ml-1 rounded bg-surface-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-surface-500">inactive</span>}</p>
                      {a.phone && <a href={`tel:${a.phone}`} className="flex items-center gap-1 text-xs text-surface-500 hover:text-brand-600"><Phone className="h-3 w-3" /> {a.phone}</a>}
                    </td>
                    <td className="border-b border-surface-100 px-5 py-3 text-surface-600">{a.area ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-surface-400" /> {a.area}</span> : '—'}</td>
                    <td className="border-b border-surface-100 px-5 py-3 text-right font-semibold text-surface-900">{t.count}</td>
                    <td className="border-b border-surface-100 px-5 py-3 text-right text-surface-700">{formatCurrency(t.due)}</td>
                    <td className="border-b border-surface-100 px-5 py-3 text-right">
                      <span className="font-semibold text-surface-900">{formatCurrency(t.remitted)}</span>
                      {t.count > 0 && short > 0 && <span className="block text-[11px] font-semibold text-amber-700">{formatCurrency(short)} not yet remitted</span>}
                    </td>
                    <td className="border-b border-surface-100 px-5 py-3 text-right font-semibold text-surface-900">{formatCurrency(t.fees)}</td>
                    <td className="border-b border-surface-100 px-3 py-3 text-right">
                      <button onClick={() => open(a)} aria-label={`Edit ${a.full_name}`} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-950/60 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.form onSubmit={save} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-surface-900">{editing === 'new' ? 'Add delivery agent' : 'Edit delivery agent'}</h2>
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100"><X className="h-5 w-5" /></button>
              </div>
              <div><label className="label">Full name *</label><input required className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label">Phone</label><input type="tel" className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, '') })} /></div>
                <div><label className="label">Area</label><input className="input" placeholder="e.g. Ibadan" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
              </div>
              <div><label className="label">Notes</label><textarea rows={2} className="input resize-none" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              {editing !== 'new' && (
                <label className="flex items-center gap-2 text-sm text-surface-700">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  Active (shows in the “Delivered by” list on orders)
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
                <button disabled={saving} className="btn-primary px-5">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
