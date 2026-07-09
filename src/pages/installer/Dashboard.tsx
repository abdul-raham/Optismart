import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Power, Wrench, CheckCircle2, Banknote, MapPin, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/shared/StatCard'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'
import type { InstallerJob, InstallerProfile } from '@/types'

interface JobRow extends InstallerJob {
  orders?: {
    order_number: string
    customer_name: string
    customer_address: string
  }
}

export function InstallerDashboard() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<InstallerProfile | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [sharingLocation, setSharingLocation] = useState(false)

  useEffect(() => {
    if (user?.id) fetchData(user.id)
  }, [user?.id])

  // Auto-prompt location share if no coords yet
  useEffect(() => {
    if (!loading && !profile?.lat) {
      shareLocation()
    }
  }, [loading])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const [profileRes, jobsRes] = await Promise.all([
        supabase.from('installer_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase
          .from('installer_jobs')
          .select('*, orders ( order_number, customer_name, customer_address )')
          .eq('installer_id', userId)
          .order('scheduled_date', { ascending: true }),
      ])

      setProfile((profileRes.data as InstallerProfile) ?? null)
      setJobs((jobsRes.data ?? []) as JobRow[])
    } catch (err) {
      console.error('Error fetching installer dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleAvailability = async () => {
    if (!user?.id) return
    setToggling(true)
    try {
      const newAvailability = profile ? !profile.is_available : true
      const { data, error } = await supabase
        .from('installer_profiles')
        .upsert({ 
          user_id: user.id, 
          is_available: newAvailability,
          location: profile?.location ?? 'Not set'
        }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error
      setProfile(data as InstallerProfile)
    } catch (err) {
      console.error('Error updating availability:', err)
      alert('Failed to update availability.')
    } finally {
      setToggling(false)
    }
  }

  const shareLocation = () => {
    if (!user?.id) return
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser")
      return
    }

    setSharingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lng } = position.coords

          // Reverse geocode to get a human-readable location name
          let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
              { headers: { 'Accept-Language': 'en' } }
            )
            const geo = await res.json()
            const a = geo.address || {}
            const street = [a.house_number, a.road || a.street].filter(Boolean).join(' ')
            const area = a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.city
            const city = a.city || a.town || a.county
            locationName = [street, area && city && area !== city ? `${area}, ${city}` : area || city].filter(Boolean).join(', ') || geo.display_name?.split(',').slice(0, 3).join(',').trim() || locationName
          } catch { /* keep coords as fallback */ }

          const { error } = await supabase
            .from('installer_profiles')
            .upsert({ 
              user_id: user.id,
              lat,
              lng,
              location: locationName,
              is_available: profile?.is_available ?? false,
            }, { onConflict: 'user_id' })

          if (error) throw error
          setProfile(prev => prev ? { ...prev, lat, lng, location: locationName } : prev)
          alert(`Location shared! ${locationName}`)
        } catch (err) {
          console.error('Error sharing location:', err)
          alert('Failed to share location.')
        } finally {
          setSharingLocation(false)
        }
      },
      (error) => {
        console.error("Geolocation error:", error)
        alert("Unable to retrieve your location. Please check your browser permissions.")
        setSharingLocation(false)
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    )
  }

  const handleUpdateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('installer_jobs').update({ status: newStatus }).eq('id', jobId)
      if (error) throw error
      if (user?.id) fetchData(user.id)
    } catch (err) {
      console.error('Error updating job status:', err)
      alert('Failed to update job status')
    }
  }

  const activeJobs = jobs.filter((job) => ['assigned', 'accepted', 'en_route', 'installed'].includes(job.status))
  const completedJobs = jobs.filter((job) => job.status === 'completed')
  const earnings = completedJobs.reduce((sum, job) => sum + Number(job.commission_amount ?? 0), 0)
  const nextJob = activeJobs[0]

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="glass-card h-36 animate-pulse bg-surface-100/60" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mandatory location prompt banner */}
      {!profile?.lat && !loading && (
        <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-black text-orange-800">Location sharing is required</p>
            <p className="text-sm text-orange-600 mt-0.5">You must share your location to receive job assignments. Please allow location access when prompted.</p>
          </div>
          <button
            onClick={shareLocation}
            disabled={sharingLocation}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-5 py-2.5 text-sm font-black transition flex-shrink-0"
          >
            {sharingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {sharingLocation ? 'Getting location...' : 'Share My Location'}
          </button>
        </div>
      )}
      <div className="glass-card overflow-hidden p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-surface-500">Installer workspace</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-surface-900">Hi, {user?.full_name?.split(' ')[0] ?? 'Installer'}</h1>
            <p className="mt-1 text-sm text-surface-500">{profile?.location ?? 'Location not set'} field coverage</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={shareLocation} 
              disabled={sharingLocation} 
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition bg-brand-50 text-brand-700 hover:bg-brand-100"
            >
              {sharingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Share Location
            </button>
            <button onClick={toggleAvailability} disabled={toggling} className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition ${profile?.is_available ? 'bg-success-50 text-success-700 hover:bg-success-100' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
              <Power className="h-4 w-4" />
              {profile?.is_available ? 'Available' : 'Offline'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title="Active Jobs" value={activeJobs.length} icon={Wrench} color="brand" delay={0.05} />
        <StatCard title="Completed" value={completedJobs.length} icon={CheckCircle2} color="success" delay={0.1} />
        <StatCard title="Earnings" value={formatCurrency(earnings)} icon={Banknote} color="warning" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h2 className="text-lg font-black text-surface-900">Next job</h2>
          {nextJob ? (
            <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
              <p className="text-sm font-black text-brand-700">{nextJob.orders?.order_number}</p>
              <h3 className="mt-2 text-xl font-black text-surface-900">{nextJob.orders?.customer_name}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-surface-600">{nextJob.orders?.customer_address}</p>
              <div className="mt-4 flex items-center gap-2 text-sm font-bold text-brand-700">
                <CalendarDays className="h-4 w-4" />
                {formatDate(nextJob.scheduled_date)}
              </div>
              <button 
                onClick={() => handleUpdateJobStatus(nextJob.id, 'completed')}
                className="mt-4 w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
              >
                Mark as Completed
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-surface-200 p-8 text-center">
              <Wrench className="mx-auto h-8 w-8 text-surface-300" />
              <p className="mt-3 text-sm font-bold text-surface-500">No active job right now.</p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card overflow-hidden">
          <div className="border-b border-surface-100 p-5">
            <h2 className="text-lg font-black text-surface-900">Recent assignments</h2>
          </div>
          <div className="divide-y divide-surface-100">
            {jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-bold text-surface-900">{job.orders?.customer_name}</p>
                  <p className="mt-0.5 text-xs font-semibold text-surface-500">{job.orders?.order_number}</p>
                </div>
                <span className="badge-gray capitalize">{job.status.replace('_', ' ')}</span>
              </div>
            ))}
            {jobs.length === 0 && <div className="p-8 text-center text-sm font-semibold text-surface-500">No assignments yet.</div>}
          </div>
        </motion.div>
      </div>

      <MobileDashboardNav />
    </div>
  )
}
