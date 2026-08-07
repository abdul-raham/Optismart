import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Banknote, CheckCircle2, Clock, Wrench, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/shared/StatCard'
import { formatCurrency, formatDate } from '@/lib/utils'

export function InstallerEarnings() {
  const { user } = useAuthStore()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) fetchEarnings()
  }, [user?.id])

  const fetchEarnings = async () => {
    try {
      const { data } = await supabase
        .from('installer_jobs')
        .select('*, orders ( order_number, customer_name, total_amount )')
        .eq('installer_id', user?.id)
        .order('scheduled_date', { ascending: false })

      if (data) setJobs(data)
    } catch (err) {
      console.error('Error fetching installer earnings:', err)
    } finally {
      setLoading(false)
    }
  }

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const pendingJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled')

  // Calculate earnings (₦15,000 installation fee per completed job, or custom payout)
  const totalEarned = completedJobs.reduce((sum, j) => sum + (j.payout_amount || 15000), 0)
  const pendingEarned = pendingJobs.reduce((sum, j) => sum + (j.payout_amount || 15000), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Installer Earnings & Payouts</h1>
          <p className="text-sm text-surface-500 mt-1">Track your installation fees and payout records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Payout Earned"
          value={formatCurrency(totalEarned)}
          icon={Banknote}
          color="brand"
        />
        <StatCard
          title="Completed Installations"
          value={completedJobs.length}
          icon={CheckCircle2}
          color="success"
        />
        <StatCard
          title="Pending Payout Value"
          value={formatCurrency(pendingEarned)}
          icon={Clock}
          color="warning"
        />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-brand-600" /> Installation Job Payout Log
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-surface-400">Loading payout records...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="mx-auto w-12 h-12 text-surface-300 mb-3" />
            <h3 className="text-lg font-bold text-surface-900 mb-1">No Payout Records Found</h3>
            <p className="text-surface-500 text-sm">Completed field jobs will populate your earnings history here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-50/70 text-surface-500 text-xs uppercase tracking-wider border-b border-surface-100">
                  <th className="py-3.5 px-5 font-bold">Order #</th>
                  <th className="py-3.5 px-5 font-bold">Customer</th>
                  <th className="py-3.5 px-5 font-bold">Scheduled Date</th>
                  <th className="py-3.5 px-5 font-bold">Status</th>
                  <th className="py-3.5 px-5 font-bold text-right">Fee Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-surface-900">
                      {job.orders?.order_number || 'N/A'}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-surface-700">
                      {job.orders?.customer_name || 'Customer'}
                    </td>
                    <td className="py-3.5 px-5 text-surface-600 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-surface-400" />
                      {formatDate(job.scheduled_date || job.created_at)}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-black text-brand-700">
                      {formatCurrency(job.payout_amount || 15000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
