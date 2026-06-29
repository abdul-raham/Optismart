import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Bell, Clock, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Lead {
  id: string
  customer_name: string
  phone: string
  follow_up_date: string
  status: string
}

export function DSAReminders() {
  const { user } = useAuthStore()
  const [reminders, setReminders] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) fetchReminders()
  }, [user?.id])

  const fetchReminders = async () => {
    try {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('dsa_id', user?.id)
        .not('follow_up_date', 'is', null)
        .gte('follow_up_date', new Date().toISOString())
        .order('follow_up_date', { ascending: true })
        .limit(20)

      if (data) setReminders(data)
    } catch (err) {
      console.error('Error fetching reminders:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Reminders</h1>
          <p className="text-sm text-surface-500 mt-1">Upcoming follow-ups for your leads.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="glass-card h-32 animate-pulse bg-surface-100/50" />)}
        </div>
      ) : reminders.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="mx-auto w-12 h-12 text-surface-300 mb-4" />
          <h3 className="text-lg font-bold text-surface-900 mb-2">All caught up</h3>
          <p className="text-surface-500">You have no upcoming follow-ups scheduled.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reminders.map((lead, idx) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-5 border-t-4 border-t-brand-500"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-surface-900">{lead.customer_name}</h3>
                <AlertCircle className="w-5 h-5 text-brand-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-surface-600">
                  <Clock className="w-4 h-4 text-surface-400" />
                  {formatDate(lead.follow_up_date)}
                </div>
                <div className="text-sm font-medium text-surface-900 mt-2">
                  Phone: <a href={`tel:${lead.phone}`} className="text-brand-600 hover:underline">{lead.phone}</a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
