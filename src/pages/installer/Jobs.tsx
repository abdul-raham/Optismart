import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Wrench, MapPin, Calendar, Clock, CheckCircle2, ChevronRight, Search, Phone } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

interface InstallerJob {
  id: string
  order_id: string
  scheduled_date: string
  status: 'assigned' | 'accepted' | 'en_route' | 'installed' | 'completed' | 'rejected'
  commission_amount: number
  orders: {
    order_number: string
    customer_name: string
    customer_address: string
    customer_phone: string
  }
}

export function InstallerJobs() {
  const { user } = useAuthStore()
  const [jobs, setJobs] = useState<InstallerJob[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  // Installer job status flow
  const statusFlow = {
    assigned: 'accepted',
    accepted: 'en_route',
    en_route: 'installed',
    installed: 'completed',
    completed: null,
    rejected: null
  }

  useEffect(() => {
    if (user?.id) fetchJobs()
  }, [user?.id])

  const fetchJobs = async () => {
    try {
      const { data } = await supabase
        .from('installer_jobs')
        .select(`
          id, order_id, scheduled_date, status, commission_amount,
          orders ( order_number, customer_name, customer_address, customer_phone )
        `)
        .eq('installer_id', user?.id)
        .order('scheduled_date', { ascending: true })

      if (data) setJobs(data as any[])
    } catch (err) {
      console.error('Error fetching jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    setUpdating(jobId)
    try {
      const { error } = await supabase
        .from('installer_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', jobId)

      if (error) throw error
      
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus as any } : j))
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update job status.')
    } finally {
      setUpdating(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned': return <span className="badge-yellow">New Request</span>
      case 'accepted': return <span className="badge-blue">Accepted</span>
      case 'en_route': return <span className="badge-purple">En Route</span>
      case 'installed': return <span className="badge-green">Installed</span>
      case 'completed': return <span className="badge-gray">Verified Done</span>
      case 'rejected': return <span className="badge-red">Declined</span>
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Installation Jobs</h1>
          <p className="text-sm text-surface-500 mt-1">Manage your incoming requests and ongoing field work.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="glass-card h-48 animate-pulse bg-surface-100/50" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No jobs assigned yet</h3>
          <p className="text-surface-500 max-w-md">When a Sales Agent assigns you an installation job, it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {jobs.map(job => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-5 flex flex-col relative overflow-hidden"
              >
                {/* Status indicator bar */}
                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  job.status === 'assigned' ? 'bg-warning-500' :
                  job.status === 'accepted' ? 'bg-blue-500' :
                  job.status === 'en_route' ? 'bg-purple-500' :
                  job.status === 'installed' ? 'bg-success-500' :
                  'bg-surface-200'
                }`} />

                <div className="flex items-start justify-between mb-4 pl-3">
                  <div>
                    <h3 className="font-bold text-surface-900">{job.orders?.customer_name}</h3>
                    <p className="text-xs text-surface-500">Order: {job.orders?.order_number}</p>
                  </div>
                  {getStatusBadge(job.status)}
                </div>

                <div className="space-y-3 mb-6 pl-3">
                  <div className="flex items-start gap-2 text-sm text-surface-600">
                    <MapPin className="w-4 h-4 text-surface-400 flex-shrink-0 mt-0.5" />
                    <span>{job.orders?.customer_address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-surface-600">
                    <Phone className="w-4 h-4 text-surface-400 flex-shrink-0" />
                    <span>{job.orders?.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-surface-600 font-medium">
                    <Calendar className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span className="text-brand-700">Scheduled: {formatDate(job.scheduled_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-surface-600 font-medium border-t border-surface-100 pt-3">
                    <span className="bg-success-50 text-success-700 px-2 py-1 rounded-lg">Fee: {formatCurrency(job.commission_amount)}</span>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-surface-100 flex items-center justify-end gap-2 pl-3">
                  {updating === job.id ? (
                    <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                  ) : job.status === 'assigned' ? (
                    <>
                      <button onClick={() => updateJobStatus(job.id, 'rejected')} className="btn-outline text-xs px-4 py-2 text-danger-600 border-danger-200 hover:bg-danger-50">Reject</button>
                      <button onClick={() => updateJobStatus(job.id, 'accepted')} className="btn-primary text-xs px-4 py-2">Accept Job</button>
                    </>
                  ) : job.status !== 'completed' && job.status !== 'rejected' ? (
                    <button 
                      onClick={() => updateJobStatus(job.id, statusFlow[job.status as keyof typeof statusFlow] as string)} 
                      className="btn-primary w-full flex justify-center py-2.5 text-sm"
                    >
                      Update: {statusFlow[job.status as keyof typeof statusFlow]?.replace('_', ' ').toUpperCase()}
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-surface-400 uppercase">Task Closed</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
