import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Target, Search, Plus, X, Phone, Mail, MapPin, Clock, Trash2, Bell, MessageCircle, User, BellOff, StickyNote } from 'lucide-react'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 50
const STATUSES = ['new', 'contacted', 'converted', 'lost'] as const
const STATUS_STYLE: Record<string, string> = {
  new: 'bg-brand-50 text-brand-700',
  contacted: 'bg-indigo-50 text-indigo-700',
  converted: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-surface-100 text-surface-500',
}
const PRIORITY: Record<string, { label: string; dot: string }> = {
  hot: { label: 'High', dot: 'bg-rose-500' },
  warm: { label: 'Medium', dot: 'bg-amber-400' },
  cold: { label: 'Low', dot: 'bg-sky-400' },
}
const today = () => new Date().toISOString().slice(0, 10)
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '234')}`

const EMPTY_FORM = { customer_name: '', phone: '', email: '', location: '', temperature: 'warm', notes: '', follow_up_date: '', follow_up_interval_days: 0 }

export function DSALeads() {
  const { user, role } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = role !== 'dsa'
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [dueOnly, setDueOnly] = useState(false)
  const [dsaFilter, setDsaFilter] = useState('all')
  const [dsas, setDsas] = useState<{ id: string; full_name: string }[]>([])
  const [page, setPage] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [openLead, setOpenLead] = useState<any | null>(null)
  const sequence = useRef(0)

  useEffect(() => {
    if (location.search.includes('new=true') || location.pathname.endsWith('/new-lead')) setIsModalOpen(true)
  }, [location])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(0) }, [debouncedSearch, statusFilter, priorityFilter, dueOnly, dsaFilter])

  useEffect(() => {
    if (isAdmin) supabase.from('users').select('id, full_name').eq('role', 'dsa').order('full_name').then(({ data }) => setDsas(data ?? []))
  }, [isAdmin])

  // Everything except status is applied here; status is added for the list only, so the tab counts stay right.
  const withFilters = (q: any) => {
    if (!isAdmin) q = q.eq('dsa_id', user?.id)
    else if (dsaFilter !== 'all') q = q.eq('dsa_id', dsaFilter)
    if (priorityFilter !== 'all') q = q.eq('temperature', priorityFilter)
    if (dueOnly) q = q.lte('follow_up_date', today()).eq('follow_up_stopped', false).not('status', 'in', '(converted,lost)')
    const term = debouncedSearch.replace(/[%,()*]/g, ' ').trim()
    if (term) q = q.or(`customer_name.ilike.%${term}%,phone.ilike.%${term}%,location.ilike.%${term}%,email.ilike.%${term}%`)
    return q
  }

  const fetchLeads = async () => {
    if (!user?.id) return
    const seq = ++sequence.current
    try {
      const from = page * PAGE_SIZE
      const head = () => withFilters(supabase.from('leads').select('id', { count: 'exact', head: true }))
      let list = withFilters(supabase.from('leads').select('*, dsa:users(full_name)', { count: 'exact' }))
      if (statusFilter !== 'all') list = list.eq('status', statusFilter)
      const [res, all, ...per] = await Promise.all([
        list.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1),
        head(),
        ...STATUSES.map(st => head().eq('status', st)),
      ])
      if (res.error) throw res.error
      if (seq !== sequence.current) return
      setLeads(res.data ?? [])
      setMatchCount(res.count ?? 0)
      setCounts(Object.fromEntries([['all', all.count ?? 0], ...STATUSES.map((st, i) => [st, per[i].count ?? 0])]))
    } catch (err) {
      console.error('Error fetching leads:', err)
    } finally {
      if (seq === sequence.current) setLoading(false)
    }
  }
  useEffect(() => { fetchLeads() }, [user?.id, page, debouncedSearch, statusFilter, priorityFilter, dueOnly, dsaFilter])

  const patchLead = (id: string, changes: any) => {
    setLeads(ls => ls.map(l => l.id === id ? { ...l, ...changes } : l))
    setOpenLead((o: any) => (o?.id === id ? { ...o, ...changes } : o))
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase.from('leads').insert([{
        dsa_id: user.id, customer_name: form.customer_name, phone: form.phone, email: form.email || null,
        location: form.location || null, temperature: form.temperature, notes: form.notes || null,
        follow_up_date: form.follow_up_date || null, follow_up_interval_days: form.follow_up_interval_days || 0, status: 'new',
      }]).select().single()
      if (error) throw error
      if (data) {
        sendEmail('new_lead', { dsaEmail: user.email, dsaName: user.full_name, customerName: form.customer_name }, { onError: e => console.warn('Email failed:', e) })
        sendWebPush(user.id, 'Lead Captured', `Successfully saved ${form.customer_name} to your pipeline.`, '/app/dsa/leads').catch(console.warn)
        setIsModalOpen(false)
        setForm(EMPTY_FORM)
        fetchLeads()
      }
    } catch (err) {
      console.error('Error creating lead:', err)
      alert('Failed to create lead')
    } finally {
      setSubmitting(false)
    }
  }

  const setStatus = async (lead: any, status: string) => {
    const prev = lead.status
    patchLead(lead.id, { status })
    const { error } = await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (error) { patchLead(lead.id, { status: prev }); alert(`Could not change status: ${error.message}`) }
    else fetchLeads()
  }

  const stopReminders = async (lead: any) => {
    const { error } = await supabase.from('leads').update({ follow_up_stopped: true }).eq('id', lead.id)
    if (error) return alert('Failed to stop reminders')
    patchLead(lead.id, { follow_up_stopped: true })
  }

  const remindDSA = async (lead: any) => {
    if (!lead.dsa_id) return
    try {
      await sendWebPush(lead.dsa_id, 'Lead Follow-up Reminder',
        `Admin reminded you to follow up with ${lead.customer_name}. Please check your pending leads.`, '/app/dsa/leads')
      alert(`Reminder sent to ${lead.dsa?.full_name || 'the sales agent'}`)
    } catch {
      alert('Failed to send reminder')
    }
  }

  const deleteLead = async (lead: any) => {
    if (!window.confirm(`Delete the lead for ${lead.customer_name}?`)) return
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    if (error) return alert('Failed to delete lead')
    setOpenLead(null)
    fetchLeads()
  }

  const followUp = (lead: any) => {
    if (!lead.follow_up_date) return null
    if (lead.follow_up_stopped || ['converted', 'lost'].includes(lead.status)) return { text: formatDate(lead.follow_up_date), cls: 'text-surface-400' }
    const d = lead.follow_up_date.slice(0, 10)
    if (d < today()) return { text: `Overdue · ${formatDate(lead.follow_up_date)}`, cls: 'font-semibold text-rose-600' }
    if (d === today()) return { text: 'Today', cls: 'font-semibold text-amber-700' }
    return { text: formatDate(lead.follow_up_date), cls: 'text-surface-700' }
  }

  const filtersOn = !!search || statusFilter !== 'all' || priorityFilter !== 'all' || dueOnly || dsaFilter !== 'all'
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); setDueOnly(false); setDsaFilter('all') }
  const pageFrom = page * PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(matchCount / PAGE_SIZE))

  const StatusSelect = ({ lead }: { lead: any }) => (
    <select value={lead.status} onClick={e => e.stopPropagation()} onChange={e => setStatus(lead, e.target.value)}
      className={`cursor-pointer appearance-none rounded-full border-0 py-1 pl-2.5 pr-6 text-xs font-bold capitalize outline-none focus:ring-2 focus:ring-brand-500/30 ${STATUS_STYLE[lead.status] || STATUS_STYLE.new}`}
      style={{ backgroundImage: 'none' }} aria-label="Lead status">
      {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
    </select>
  )
  const Priority = ({ t }: { t: string }) => (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-700">
      <span className={`h-2 w-2 rounded-full ${PRIORITY[t]?.dot || 'bg-surface-300'}`} /> {PRIORITY[t]?.label || t}
    </span>
  )

  return (
    <div className="relative space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-surface-900">
            Leads <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-sm font-bold text-surface-600">{counts.all ?? 0}</span>
          </h1>
          <p className="mt-1 text-sm text-surface-500">{isAdmin ? 'Every prospect your sales agents are working on.' : 'Your prospects. Follow up and turn them into orders.'}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary flex h-10 items-center gap-1.5 px-4 text-sm"><Plus className="h-4 w-4" /> New lead</button>
      </div>

      {/* Pipeline */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(['all', ...STATUSES] as string[]).map(st => (
          <button key={st} onClick={() => setStatusFilter(st)}
            className={`rounded-2xl border p-3 text-left transition-colors ${statusFilter === st ? 'border-brand-500 bg-brand-50/60' : 'border-surface-200 bg-white hover:bg-surface-50'}`}>
            <p className={`text-xs font-semibold capitalize ${statusFilter === st ? 'text-brand-700' : 'text-surface-500'}`}>{st === 'all' ? 'All leads' : st}</p>
            <p className="mt-0.5 text-xl font-bold text-surface-900">{counts[st] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="glass-card space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email or location…" className="input h-10 w-full pl-9 text-sm" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-surface-400 hover:text-surface-700"><X className="h-4 w-4" /></button>}
          </div>
          {isAdmin && (
            <div className="relative sm:w-60">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <select value={dsaFilter} onChange={e => setDsaFilter(e.target.value)} className="input h-10 w-full truncate pl-9 text-sm">
                <option value="all">All sales agents</option>
                {dsas.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          {(['all', 'hot', 'warm', 'cold'] as const).map(t => (
            <button key={t} onClick={() => setPriorityFilter(t)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${priorityFilter === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'}`}>
              {t !== 'all' && <span className={`h-2 w-2 rounded-full ${PRIORITY[t].dot}`} />} {t === 'all' ? 'Any priority' : PRIORITY[t].label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-surface-200" />
          <button onClick={() => setDueOnly(!dueOnly)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${dueOnly ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'}`}>
            <Clock className="h-3.5 w-3.5" /> Follow-up due
          </button>
          {filtersOn && <button onClick={clearFilters} className="ml-auto shrink-0 px-2 text-xs font-semibold text-surface-500 hover:text-surface-800">Clear filters</button>}
        </div>
      </div>

      {loading ? (
        <div className="glass-card space-y-3 p-5">{[1, 2, 3, 4].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-100" />)}</div>
      ) : leads.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50"><Target className="h-7 w-7 text-brand-600" /></div>
          <h3 className="mb-1 text-lg font-bold text-surface-900">{filtersOn ? 'No leads match these filters' : 'No leads yet'}</h3>
          <p className="max-w-md text-sm text-surface-500">{filtersOn ? 'Try another search or clear the filters.' : 'Add your first prospect to start building your pipeline.'}</p>
          {filtersOn ? <button onClick={clearFilters} className="btn-outline mt-5 h-9 px-4 text-sm">Clear filters</button>
            : <button onClick={() => setIsModalOpen(true)} className="btn-primary mt-5">Add your first lead</button>}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Desktop */}
          <div className="hidden max-h-[72vh] overflow-auto md:block">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-surface-500">
                  <th className="sticky left-0 top-0 z-30 border-b border-surface-200 bg-surface-50 px-4 py-3">Lead</th>
                  {isAdmin && <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Sales agent</th>}
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Contact</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Priority</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Status</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Follow-up</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const fu = followUp(lead)
                  return (
                    <tr key={lead.id} onClick={() => setOpenLead(lead)} className="group cursor-pointer hover:bg-surface-50 [&>td]:border-b [&>td]:border-surface-100">
                      <td className="sticky left-0 z-10 max-w-[260px] bg-white px-4 py-3 group-hover:bg-surface-50">
                        <p className="truncate font-bold text-surface-900">{lead.customer_name}{lead.source === 'whatsapp' && <span className="ml-1.5 rounded-md bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-emerald-700">WhatsApp</span>}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-surface-500">
                          {lead.location && <><MapPin className="h-3 w-3 shrink-0" />{lead.location} · </>}Added {formatDate(lead.created_at)}
                        </p>
                      </td>
                      {isAdmin && <td className="px-4 py-3 text-surface-700">{lead.dsa?.full_name || '—'}</td>}
                      <td className="px-4 py-3">
                        <p className="text-surface-800">{lead.phone}</p>
                        {lead.email && <p className="max-w-[200px] truncate text-xs text-surface-500">{lead.email}</p>}
                      </td>
                      <td className="px-4 py-3"><Priority t={lead.temperature} /></td>
                      <td className="px-4 py-3"><StatusSelect lead={lead} /></td>
                      <td className="px-4 py-3 text-xs">{fu ? <span className={`flex items-center gap-1 ${fu.cls}`}><Clock className="h-3 w-3" />{fu.text}</span> : <span className="text-surface-400">—</span>}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <a href={`tel:${lead.phone}`} title="Call" className="rounded-lg p-2 text-surface-400 hover:bg-brand-50 hover:text-brand-600"><Phone className="h-4 w-4" /></a>
                          <a href={waLink(lead.phone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="rounded-lg p-2 text-surface-400 hover:bg-emerald-50 hover:text-emerald-600"><MessageCircle className="h-4 w-4" /></a>
                          {isAdmin && lead.dsa_id && !['converted', 'lost'].includes(lead.status) && (
                            <button onClick={() => remindDSA(lead)} title="Remind the sales agent" className="rounded-lg p-2 text-surface-400 hover:bg-amber-50 hover:text-amber-600"><Bell className="h-4 w-4" /></button>
                          )}
                          <button onClick={() => deleteLead(lead)} title="Delete" className="rounded-lg p-2 text-surface-400 hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <ul className="divide-y divide-surface-100 md:hidden">
            {leads.map(lead => {
              const fu = followUp(lead)
              return (
                <li key={lead.id} className="p-4" onClick={() => setOpenLead(lead)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-surface-900">{lead.customer_name}{lead.source === 'whatsapp' && <span className="ml-1.5 rounded-md bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-emerald-700">WhatsApp</span>}</p>
                      <p className="mt-0.5 truncate text-xs text-surface-500">{lead.phone}{lead.location ? ` · ${lead.location}` : ''}</p>
                      {isAdmin && lead.dsa?.full_name && <p className="mt-0.5 text-xs text-surface-500">By {lead.dsa.full_name}</p>}
                    </div>
                    <StatusSelect lead={lead} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs">
                      <Priority t={lead.temperature} />
                      {fu && <span className={`flex items-center gap-1 ${fu.cls}`}><Clock className="h-3 w-3" />{fu.text}</span>}
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <a href={`tel:${lead.phone}`} aria-label="Call" className="grid h-9 w-9 place-items-center rounded-lg border border-surface-200 text-surface-600"><Phone className="h-4 w-4" /></a>
                      <a href={waLink(lead.phone)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-9 w-9 place-items-center rounded-lg border border-surface-200 text-emerald-600"><MessageCircle className="h-4 w-4" /></a>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-surface-100 px-4 py-3 text-sm">
            <span className="text-surface-500">{pageFrom + 1}–{Math.min(pageFrom + PAGE_SIZE, matchCount)} of <strong className="text-surface-800">{matchCount}</strong></span>
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-outline h-9 px-3 text-sm disabled:opacity-40">Previous</button>
              <span className="hidden text-xs text-surface-500 sm:inline">Page {page + 1} of {pageCount}</span>
              <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} className="btn-outline h-9 px-3 text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead details */}
      <AnimatePresence>
        {openLead && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpenLead(null)} className="absolute inset-0 bg-surface-950/40" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
              <header className="flex items-start justify-between gap-3 border-b border-surface-100 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-surface-500">Lead</p>
                  <h2 className="truncate text-lg font-bold text-surface-900">{openLead.customer_name}</h2>
                  <div className="mt-1.5 flex items-center gap-3"><StatusSelect lead={openLead} /><Priority t={openLead.temperature} /></div>
                </div>
                <button onClick={() => setOpenLead(null)} aria-label="Close" className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X className="h-5 w-5" /></button>
              </header>
              <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${openLead.phone}`} className="btn-outline flex h-10 items-center justify-center gap-1.5 text-sm"><Phone className="h-4 w-4" /> Call</a>
                  <a href={waLink(openLead.phone)} target="_blank" rel="noopener noreferrer" className="btn-outline flex h-10 items-center justify-center gap-1.5 text-sm text-emerald-700"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                </div>
                <dl className="divide-y divide-surface-100 rounded-2xl border border-surface-100 px-4">
                  {[
                    [Phone, 'Phone', openLead.phone],
                    [Mail, 'Email', openLead.email],
                    [MapPin, 'Location', openLead.location],
                    [User, 'Sales agent', isAdmin ? openLead.dsa?.full_name : null],
                    [Clock, 'Follow-up', followUp(openLead)?.text + (openLead.follow_up_interval_days ? ` · every ${openLead.follow_up_interval_days} day(s)` : '')],
                  ].filter(([, , v]) => v && !String(v).startsWith('undefined')).map(([Icon, label, value]: any) => (
                    <div key={label} className="flex items-start justify-between gap-4 py-2.5">
                      <dt className="flex items-center gap-1.5 text-surface-500"><Icon className="h-3.5 w-3.5" /> {label}</dt>
                      <dd className="break-all text-right font-semibold text-surface-900">{value}</dd>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-4 py-2.5">
                    <dt className="text-surface-500">Added</dt><dd className="font-semibold text-surface-900">{formatDate(openLead.created_at)}</dd>
                  </div>
                </dl>
                {openLead.notes && (
                  <div className="rounded-2xl border border-surface-100 p-4">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-surface-500"><StickyNote className="h-3.5 w-3.5" /> Notes</p>
                    <p className="whitespace-pre-wrap text-surface-700">{openLead.notes}</p>
                  </div>
                )}
              </div>
              <footer className="flex flex-wrap gap-2 border-t border-surface-100 p-4">
                {!['converted', 'lost'].includes(openLead.status) && (
                  <button onClick={() => navigate(`${isAdmin ? '/app/admin/orders' : '/app/dsa/orders'}?lead=${openLead.id}&new=1`)} className="btn-primary flex h-10 items-center gap-1.5 px-3 text-sm"><Target className="h-4 w-4" /> Convert to order</button>
                )}
                {openLead.follow_up_date && !openLead.follow_up_stopped && !['converted', 'lost'].includes(openLead.status) && (
                  <button onClick={() => stopReminders(openLead)} className="btn-outline flex h-10 items-center gap-1.5 px-3 text-sm"><BellOff className="h-4 w-4" /> Stop reminders</button>
                )}
                {isAdmin && openLead.dsa_id && !['converted', 'lost'].includes(openLead.status) && (
                  <button onClick={() => remindDSA(openLead)} className="btn-outline flex h-10 items-center gap-1.5 px-3 text-sm"><Bell className="h-4 w-4" /> Remind agent</button>
                )}
                <button onClick={() => deleteLead(openLead)} className="ml-auto flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger-600 hover:bg-danger-50"><Trash2 className="h-4 w-4" /> Delete</button>
              </footer>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* New lead */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={() => !submitting && setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-card-xl sm:rounded-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-surface-100 px-6 py-4">
                <h2 className="text-lg font-bold text-surface-900">New lead</h2>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-900"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleCreateLead} className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                  <div>
                    <label className="label">Customer name *</label>
                    <input required className="input" placeholder="e.g. John Smith" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><label className="label">Phone *</label><input required type="tel" className="input" placeholder="080…" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, '') })} /></div>
                    <div><label className="label">Email</label><input type="email" className="input" placeholder="john@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Location / address</label><input className="input" placeholder="e.g. Ikeja, Lagos" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
                  <div>
                    <label className="label">Priority</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['hot', 'warm', 'cold'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setForm({ ...form, temperature: t })}
                          className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-semibold transition-colors ${form.temperature === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
                          <span className={`h-2 w-2 rounded-full ${PRIORITY[t].dot}`} /> {PRIORITY[t].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><label className="label">Next follow-up</label><input type="date" className="input" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} /></div>
                    <div>
                      <label className="label">Remind me</label>
                      <select className="input" value={form.follow_up_interval_days} onChange={e => setForm({ ...form, follow_up_interval_days: parseInt(e.target.value) })}>
                        <option value={0}>Once</option><option value={1}>Every day</option><option value={3}>Every 3 days</option>
                        <option value={7}>Every week</option><option value={14}>Every 2 weeks</option><option value={30}>Every month</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="label">Notes</label><textarea rows={3} className="input resize-none" placeholder="What are they interested in?" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-surface-100 px-6 py-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting} className="btn-outline">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary flex w-32 items-center justify-center">
                    {submitting ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Save lead'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
