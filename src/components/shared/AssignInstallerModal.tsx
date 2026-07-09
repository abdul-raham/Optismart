import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, User, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'

interface AssignInstallerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  order: any | null
}

export function AssignInstallerModal({ isOpen, onClose, onSuccess, order }: AssignInstallerModalProps) {
  const [installers, setInstallers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [selectedInstallerId, setSelectedInstallerId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && order?.id) {
      fetchInstallers()
      
      // Default to tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setScheduledDate(tomorrow.toISOString().split('T')[0])
    }
  }, [isOpen, order])

  const fetchInstallers = async () => {
    setFetching(true)
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'installer')
        .eq('status', 'active')
        
      if (data) {
        setInstallers(data)
        if (data.length > 0) setSelectedInstallerId(data[0].id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setFetching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!selectedInstallerId) throw new Error('Please select an installer')
      if (!scheduledDate) throw new Error('Please select a date')

      const { error: insertError } = await supabase.from('installer_jobs').insert({
        installer_id: selectedInstallerId,
        order_id: order?.id,
        scheduled_date: new Date(scheduledDate).toISOString(),
        status: 'assigned'
      })

      if (insertError) throw insertError

      const assignedInstaller = installers.find(i => i.id === selectedInstallerId)
      if (assignedInstaller && order) {
        if (assignedInstaller.email) {
          sendEmail('job_assigned', {
            installerEmail: assignedInstaller.email,
            installerName: assignedInstaller.full_name,
            orderNumber: order.order_number,
            customerName: order.customer_name,
            location: order.customer_address
          }).catch(console.error)
        }
        
        sendWebPush(
          selectedInstallerId,
          'New Installation Job',
          `You have been assigned to order ${order.order_number} for ${order.customer_name}.`,
          '/app/installer/jobs'
        ).catch(console.error)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to assign installer')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-surface-100 bg-surface-50">
            <h2 className="text-xl font-bold text-surface-900">Assign Installer</h2>
            <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 text-sm font-semibold text-danger-700 bg-danger-50 border border-danger-100 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1.5">Select Installer</label>
                <div className="relative">
                  <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <select disabled={fetching} value={selectedInstallerId} onChange={e => setSelectedInstallerId(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition-all appearance-none bg-white">
                    {fetching ? <option>Loading...</option> : installers.map(i => (
                      <option key={i.id} value={i.id}>{i.full_name} ({i.email})</option>
                    ))}
                    {installers.length === 0 && !fetching && (
                      <option disabled value="">No active installers found</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1.5">Scheduled Date</label>
                <input required type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-surface-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm transition-all" />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-bold text-surface-700 hover:bg-surface-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading || installers.length === 0} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-brand flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
