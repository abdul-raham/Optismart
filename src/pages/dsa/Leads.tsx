import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { UserPlus, Target, TrendingUp, MoreVertical, Search, Plus, X, Phone, Mail, MapPin, Calendar, Clock, Banknote, Edit2, Trash2, Bell } from 'lucide-react'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'
import { formatDate } from '@/lib/utils'
import type { Lead } from '@/types'

export function DSALeads() {
  const { user, role } = useAuthStore()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    location: '',
    temperature: 'warm',
    notes: '',
    follow_up_date: '',
    follow_up_interval_days: 0,
  })

  useEffect(() => {
    if (user?.id) {
      fetchLeads()
    }
  }, [user?.id])

  const fetchLeads = async () => {
    try {
      let query = supabase
        .from('leads')
        .select('*, dsa:users(full_name)')
        .order('created_at', { ascending: false })
        
      if (role === 'dsa') {
        query = query.eq('dsa_id', user?.id)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      if (data) setLeads(data)
    } catch (err) {
      console.error('Error fetching leads:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          dsa_id: user.id,
          customer_name: form.customer_name,
          phone: form.phone,
          email: form.email,
          location: form.location,
          temperature: form.temperature,
          notes: form.notes,
          follow_up_date: form.follow_up_date || null,
          follow_up_interval_days: form.follow_up_interval_days || 0,
          status: 'new'
        }])
        .select()
        .single()

      if (error) throw error
      if (data) {
        // Trigger email notification in background
        sendEmail('new_lead', {
          dsaEmail: user.email,
          dsaName: user.full_name,
          customerName: form.customer_name
        }, { onError: (e) => console.warn('Email failed:', e) })
        
        sendWebPush(
          user.id,
          'Lead Captured',
          `Successfully saved ${form.customer_name} to your pipeline.`,
          '/app/dsa/leads'
        ).catch(console.warn)

        setLeads([data, ...leads])
        setIsModalOpen(false)
        setForm({ customer_name: '', phone: '', email: '', location: '', temperature: 'warm', notes: '', follow_up_date: '', follow_up_interval_days: 0 })
      }
    } catch (err) {
      console.error('Error creating lead:', err)
      alert('Failed to create lead')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStopReminders = async (leadId: string) => {
    try {
      const { error } = await supabase.from('leads').update({ follow_up_stopped: true }).eq('id', leadId)
      if (error) throw error
      setLeads(leads.map(l => l.id === leadId ? { ...l, follow_up_stopped: true } : l))
    } catch (err) {
      console.error('Error stopping reminders:', err)
      alert('Failed to stop reminders')
    }
  }

  const handleRemindDSA = async (lead: any) => {
    if (!lead.dsa_id) return
    try {
      await sendWebPush(
        lead.dsa_id,
        'Lead Follow-up Reminder',
        `Admin reminded you to follow up with ${lead.customer_name}. Please check your pending leads.`,
        '/app/dsa/leads'
      )
      alert(`Reminder sent to ${lead.dsa?.full_name || 'DSA'}`)
    } catch (err) {
      console.error('Failed to send reminder:', err)
      alert('Failed to send reminder')
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId)
      if (error) throw error
      setLeads(leads.filter(l => l.id !== leadId))
    } catch (err) {
      console.error('Failed to delete lead:', err)
      alert('Failed to delete lead')
    }
  }

  const filteredLeads = leads.filter(l => 
    l.customer_name.toLowerCase().includes(search.toLowerCase()) || 
    l.phone.includes(search)
  )

  const getTempColor = (temp: string) => {
    switch (temp) {
      case 'hot': return 'bg-rose-100 text-rose-700 border-rose-200' // High
      case 'warm': return 'bg-orange-100 text-orange-700 border-orange-200' // Medium
      case 'cold': return 'bg-blue-100 text-blue-700 border-blue-200' // Low
      default: return 'bg-surface-100 text-surface-700 border-surface-200'
    }
  }

  const getPriorityLabel = (temp: string) => {
    switch (temp) {
      case 'hot': return 'High'
      case 'warm': return 'Medium'
      case 'cold': return 'Low'
      default: return temp
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-brand-100 text-brand-700'
      case 'contacted': return 'bg-purple-100 text-purple-700'
      case 'converted': return 'bg-success-100 text-success-700'
      case 'lost': return 'bg-surface-100 text-surface-700'
      default: return 'bg-surface-100 text-surface-700'
    }
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Lead Management</h1>
          <p className="text-sm text-surface-500 mt-1">Track and convert your prospects into paying customers.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search leads..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full sm:w-64 transition-all"
            />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Lead
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="glass-card h-48 animate-pulse bg-surface-100/50" />)}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No leads found</h3>
          <p className="text-surface-500 max-w-md">You haven't added any prospects yet. Start building your pipeline by adding a new lead.</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary mt-6">Add Your First Lead</button>
        </div>
      ) : (
        <>
          {/* Mobile/Tablet Grid View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
            <AnimatePresence>
              {filteredLeads.map((lead) => (
                <motion.div
                  key={lead.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card p-5 group hover:border-brand-200 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-surface-900 group-hover:text-brand-600 transition-colors">{lead.customer_name}</h3>
                        {role !== 'dsa' && lead.dsa?.full_name && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 font-bold ml-2">
                            {lead.dsa.full_name}
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getTempColor(lead.temperature)}`}>
                          {getPriorityLabel(lead.temperature)}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(lead.status)} mt-1 inline-block`}>
                          {lead.status}
                      </span>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setOpenDropdownId(openDropdownId === lead.id ? null : lead.id)}
                        className="text-surface-400 hover:text-surface-900 p-1 rounded-md hover:bg-surface-50 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <AnimatePresence>
                        {openDropdownId === lead.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-surface-100 z-10 py-1"
                          >
                            <a href={`tel:${lead.phone}`} className="w-full text-left px-4 py-2 text-sm text-surface-700 hover:bg-surface-50 hover:text-brand-600 transition-colors flex items-center gap-2">
                              <Phone className="w-4 h-4" /> Call Customer
                            </a>
                            {role !== 'dsa' && lead.dsa_id && (
                              <button onClick={() => { handleRemindDSA(lead); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors flex items-center gap-2">
                                <Bell className="w-4 h-4" /> Remind DSA
                              </button>
                            )}
                            <button onClick={() => { handleDeleteLead(lead.id); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors flex items-center gap-2">
                              <Trash2 className="w-4 h-4" /> Delete Lead
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-surface-600">
                      <Phone className="w-4 h-4 text-surface-400" />
                      <span>{lead.phone}</span>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm text-surface-600">
                        <Mail className="w-4 h-4 text-surface-400" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.location && (
                      <div className="flex items-center gap-2 text-sm text-surface-600">
                        <MapPin className="w-4 h-4 text-surface-400" />
                        <span className="truncate">{lead.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      Added {formatDate(lead.created_at)}
                    </div>
                    {lead.status !== 'converted' && (
                      <div className="flex items-center gap-3">
                        {lead.follow_up_date && !lead.follow_up_stopped && (
                          <button onClick={() => handleStopReminders(lead.id)} className="text-[10px] font-bold text-danger-600 hover:text-danger-700 bg-danger-50 px-2 py-1 rounded transition-colors">
                            Stop Reminders
                          </button>
                        )}
                        <button className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">
                          Convert to Order
                        </button>
                      </div>
                    )}
                  </div>
                  {lead.follow_up_date && (
                    <div className={`mt-3 pt-3 border-t border-surface-100 flex items-center justify-between text-xs ${lead.follow_up_stopped ? 'text-surface-400' : 'text-brand-600 font-medium'}`}>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Follow-up: {formatDate(lead.follow_up_date)}
                      </div>
                      {lead.follow_up_interval_days ? (
                        <span>Every {lead.follow_up_interval_days} days</span>
                      ) : null}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="hidden lg:block glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-surface-50/50 text-surface-500 font-semibold border-b border-surface-100">
                  <tr>
                    <th className="px-4 py-4">Customer</th>
                    {role !== 'dsa' && <th className="px-4 py-4">DSA</th>}
                    <th className="px-4 py-4">Contact</th>
                    <th className="px-4 py-4">Priority</th>
                    <th className="px-4 py-4">Follow-up</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-surface-50/50 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="font-bold text-surface-900">{lead.customer_name}</div>
                        <div className="text-xs text-surface-400 mt-0.5">{formatDate(lead.created_at)}</div>
                      </td>
                      {role !== 'dsa' && (
                        <td className="px-4 py-4">
                          <span className="text-sm font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded">
                            {lead.dsa?.full_name || 'Unknown'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-surface-700 text-sm">
                          <Phone className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" /> {lead.phone}
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-surface-500 text-xs mt-1 max-w-[180px] truncate">
                            <Mail className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" /> {lead.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getTempColor(lead.temperature)}`}>
                          {getPriorityLabel(lead.temperature)}
                        </span>
                        <div className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {lead.follow_up_date ? (
                          <div className={lead.follow_up_stopped ? 'text-surface-400' : 'text-brand-600 font-medium'}>
                            <div className="flex items-center gap-1.5 text-sm">
                              <Clock className="w-3.5 h-3.5" /> {formatDate(lead.follow_up_date)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-surface-400 text-xs italic">None set</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                          {lead.status !== 'converted' && role !== 'dsa' && lead.dsa_id && (
                            <button onClick={() => handleRemindDSA(lead)} className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors">Remind</button>
                          )}
                          <a href={`tel:${lead.phone}`} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors">
                            <Phone className="w-4 h-4" />
                          </a>
                          <button onClick={() => handleDeleteLead(lead.id)} className="p-1.5 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
              onClick={() => !submitting && setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-card-xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50/50">
                <h2 className="text-lg font-bold text-surface-900">Add New Lead</h2>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="text-surface-400 hover:text-surface-900 transition-colors p-1 rounded-md hover:bg-surface-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="p-6 space-y-4">
                <div>
                  <label className="label">Customer Name *</label>
                  <input required type="text" className="input" placeholder="e.g. John Smith" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Phone Number *</label>
                    <input required type="tel" className="input" placeholder="080..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value.replace(/[^\d+]/g, '')})} />
                  </div>
                  <div>
                    <label className="label">Email Address</label>
                    <input type="email" className="input" placeholder="john@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="label">Location / Address</label>
                  <input type="text" className="input" placeholder="Lagos, Nigeria" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                </div>

                <div>
                  <label className="label">Lead Priority</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['hot', 'warm', 'cold'].map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => setForm({...form, temperature: t})}
                        className={`py-2 rounded-lg text-sm font-bold uppercase tracking-wider border-2 transition-all ${form.temperature === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-100 text-surface-400 hover:border-surface-200'}`}
                      >
                        {getPriorityLabel(t)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Next Follow-up Date</label>
                    <input type="date" className="input" value={form.follow_up_date} onChange={e => setForm({...form, follow_up_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Reminder Interval</label>
                    <select className="input" value={form.follow_up_interval_days} onChange={e => setForm({...form, follow_up_interval_days: parseInt(e.target.value)})}>
                      <option value={0}>One-time (No repeat)</option>
                      <option value={1}>Every day</option>
                      <option value={3}>Every 3 days</option>
                      <option value={7}>Every week</option>
                      <option value={14}>Every 2 weeks</option>
                      <option value={30}>Every month</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea rows={3} className="input resize-none" placeholder="Any specific requirements?" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting} className="btn-outline">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary w-32 flex items-center justify-center">
                    {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Lead'}
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
