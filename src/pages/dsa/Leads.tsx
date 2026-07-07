import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { UserPlus, Target, TrendingUp, MoreVertical, Search, Plus, X, Phone, Mail, MapPin, Calendar, Clock, Banknote } from 'lucide-react'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'
import { formatDate } from '@/lib/utils'
import type { Lead } from '@/types'

export function DSALeads() {
  const { user } = useAuthStore()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    location: '',
    temperature: 'warm',
    notes: '',
  })

  useEffect(() => {
    if (user?.id) {
      fetchLeads()
    }
  }, [user?.id])

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('dsa_id', user?.id)
        .order('created_at', { ascending: false })
      
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
        setForm({ customer_name: '', phone: '', email: '', location: '', temperature: 'warm', notes: '' })
      }
    } catch (err) {
      console.error('Error creating lead:', err)
      alert('Failed to create lead')
    } finally {
      setSubmitting(false)
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getTempColor(lead.temperature)}`}>
                        {getPriorityLabel(lead.temperature)}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(lead.status)} mt-1 inline-block`}>
                        {lead.status}
                    </span>
                  </div>
                  <button className="text-surface-400 hover:text-surface-900 p-1 rounded-md hover:bg-surface-50 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
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
                    <button className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">
                      Convert to Order
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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
