import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface InstallerJob {
  id: string
  scheduled_date: string
  status: string
  orders: {
    order_number: string
    customer_name: string
    customer_address: string
  }
}

export function InstallerSchedule() {
  const { user } = useAuthStore()
  const [jobs, setJobs] = useState<InstallerJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) fetchSchedule()
  }, [user?.id])

  const fetchSchedule = async () => {
    try {
      const { data } = await supabase
        .from('installer_jobs')
        .select(`
          id, scheduled_date, status,
          orders ( order_number, customer_name, customer_address )
        `)
        .eq('installer_id', user?.id)
        .in('status', ['assigned', 'accepted', 'en_route', 'installed'])
        .order('scheduled_date', { ascending: true })

      if (data) setJobs(data as any[])
    } catch (err) {
      console.error('Error fetching schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Your Schedule</h1>
          <p className="text-sm text-surface-500 mt-1">Upcoming installation appointments.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => <div key={i} className="glass-card h-32 animate-pulse bg-surface-100/50" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Calendar className="mx-auto w-12 h-12 text-brand-300 mb-4" />
          <h3 className="text-lg font-bold text-surface-900 mb-2">Schedule Clear</h3>
          <p className="text-surface-500">You have no upcoming appointments.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job, idx) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-5 border-l-4 border-l-brand-500"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-surface-900">{job.orders?.customer_name}</h3>
                <span className="badge-brand text-xs font-bold uppercase">{job.status.replace('_', ' ')}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-surface-600">
                  <Calendar className="w-4 h-4 text-surface-400" />
                  {formatDate(job.scheduled_date)}
                </div>
                <div className="flex items-center gap-2 text-sm text-surface-600">
                  <MapPin className="w-4 h-4 text-surface-400" />
                  {job.orders?.customer_address}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
