import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Wrench, MapPin, Navigation } from 'lucide-react'
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

  // Haversine distance in km
  function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

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
      const [usersRes, profilesRes] = await Promise.all([
        supabase.from('users').select('id, full_name, email').eq('role', 'installer').eq('status', 'active'),
        supabase.from('installer_profiles').select('user_id, lat, lng, location, is_available')
      ])

      const profileMap = new Map((profilesRes.data ?? []).map(p => [p.user_id, p]))

      // Geocode customer address to get lat/lng for distance calc
      let customerLat: number | null = null
      let customerLng: number | null = null
      if (order?.customer_address) {
        try {
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(order.customer_address)}&format=json&limit=1`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const geoData = await geo.json()
          if (geoData[0]) { customerLat = parseFloat(geoData[0].lat); customerLng = parseFloat(geoData[0].lon) }
        } catch { /* ignore */ }
      }

      const merged = (usersRes.data ?? []).map(u => {
        const p = profileMap.get(u.id)
        const lat = p?.lat ?? null
        const lng = p?.lng ?? null
        const dist = (lat && lng && customerLat && customerLng)
          ? haversine(customerLat, customerLng, lat, lng)
          : null
        return { ...u, lat, lng, location: (p?.location && p.location !== 'Not set') ? p.location : null, is_available: p?.is_available ?? false, dist }
      })

      // Sort: installers with distance first (ascending), then those without
      merged.sort((a, b) => {
        if (a.dist !== null && b.dist !== null) return a.dist - b.dist
        if (a.dist !== null) return -1
        if (b.dist !== null) return 1
        return 0
      })

      setInstallers(merged)
      if (merged.length > 0) setSelectedInstallerId(merged[0].id)
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

      // Update order status to processing so the Assign button disappears
      await supabase.from('orders').update({ status: 'processing' }).eq('id', order?.id)

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
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
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
                <label className="block text-sm font-bold text-surface-700 mb-1.5 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4" /> Select Installer
                  {order?.customer_address && <span className="text-xs font-normal text-surface-400 ml-1">— sorted by distance to customer</span>}
                </label>
                {fetching ? (
                  <div className="flex items-center gap-2 text-sm text-surface-400 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading installers...
                  </div>
                ) : installers.length === 0 ? (
                  <p className="text-sm text-surface-400">No active installers found.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {installers.map(i => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => setSelectedInstallerId(i.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                          selectedInstallerId === i.id
                            ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                            : 'border-surface-200 hover:border-surface-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-surface-900 truncate">{i.full_name}</p>
                            <p className="text-xs text-surface-400 truncate">{i.email}</p>
                            {i.location && (
                              <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-orange-500 flex-shrink-0" />
                                {i.location}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {i.dist !== null ? (
                              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Navigation className="w-3 h-3" />
                                {i.dist < 1 ? `${(i.dist * 1000).toFixed(0)}m` : `${i.dist.toFixed(1)}km`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-surface-400">No location</span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              i.is_available ? 'bg-success-50 text-success-700' : 'bg-surface-100 text-surface-400'
                            }`}>
                              {i.is_available ? '● Available' : '○ Offline'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
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
