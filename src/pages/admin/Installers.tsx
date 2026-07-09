import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Phone, Mail, Wrench, List, Map as MapIcon, Wifi, WifiOff } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { formatDate } from '@/lib/utils'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface Installer {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  created_at: string
  is_available: boolean
  lat: number | null
  lng: number | null
  location: string | null
}

function FitBounds({ installers }: { installers: Installer[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = installers.filter(i => i.lat && i.lng)
    if (pts.length === 0) return
    map.fitBounds(L.latLngBounds(pts.map(i => [i.lat!, i.lng!])), { padding: [40, 40] })
  }, [installers, map])
  return null
}

export function AdminInstallers() {
  const [installers, setInstallers] = useState<Installer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  useEffect(() => { fetchInstallers() }, [])

  const fetchInstallers = async () => {
    setLoading(true)
    try {
      // Query installer_profiles directly and join the user
      const { data: profiles, error: profErr } = await supabase
        .from('installer_profiles')
        .select('user_id, lat, lng, location, is_available')

      const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id, full_name, email, phone, status, created_at')
        .eq('role', 'installer')
        .order('created_at', { ascending: false })

      if (profErr) console.error('profiles error:', profErr)
      if (userErr) throw userErr

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]))

      const mapped: Installer[] = (users ?? []).map(u => {
        const p = profileMap.get(u.id)
        return {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          phone: u.phone,
          status: u.status,
          created_at: u.created_at,
          is_available: p?.is_available ?? false,
          lat: p?.lat ?? null,
          lng: p?.lng ?? null,
          location: p?.location ?? null,
        }
      })

      setInstallers(mapped)
    } catch (err) {
      console.error('Error fetching installers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = installers.filter(i =>
    i.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.email?.toLowerCase().includes(search.toLowerCase()) ||
    i.phone?.includes(search)
  )

  const withLocation = filtered.filter(i => i.lat && i.lng)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Installers</h1>
        <p className="text-sm text-surface-500 mt-1">Manage and view all registered installers.</p>
      </div>

      {/* Summary badges */}
      {!loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-surface-100 text-surface-600">
            {installers.length} Total
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-success-50 text-success-700">
            {installers.filter(i => i.status === 'active').length} Active
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700">
            {installers.filter(i => i.is_available).length} Available Now
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {withLocation.length} Sharing Location
          </span>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden flex flex-col"
      >
        <div className="p-5 border-b border-surface-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search installers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-surface-200 bg-surface-50 text-sm focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
            />
          </div>
          <div className="flex bg-surface-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-surface-500 hover:text-surface-900'}`}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'map' ? 'bg-white text-brand-600 shadow-sm' : 'text-surface-500 hover:text-surface-900'}`}
            >
              <MapIcon className="w-4 h-4" /> Map {withLocation.length > 0 && <span className="bg-brand-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{withLocation.length}</span>}
            </button>
          </div>
        </div>

        {viewMode === 'map' ? (
          <div className="h-[600px] w-full bg-surface-50 relative z-0">
            {withLocation.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                <MapPin className="w-10 h-10 text-surface-300 mb-3" />
                <p className="text-sm font-bold text-surface-500">No installers have shared their location yet.</p>
                <p className="text-xs text-surface-400 mt-1">Installers need to click "Share Location" on their dashboard.</p>
              </div>
            )}
            <MapContainer center={[9.0820, 8.6753]} zoom={6} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds installers={filtered} />
              {withLocation.map(installer => (
                <Marker key={installer.id} position={[installer.lat!, installer.lng!]}>
                  <Popup>
                    <div className="p-1 min-w-[140px]">
                      <p className="font-bold text-sm mb-1">{installer.full_name}</p>
                      <p className="text-xs text-gray-500 mb-1">{installer.phone || 'No phone'}</p>
                      <p className="text-xs mb-1">{installer.location || ''}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${installer.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {installer.is_available ? '● Available' : '○ Offline'}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-surface-50/50">
                  <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Installer</th>
                  <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Contact</th>
                  <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Account</th>
                  <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Availability</th>
                  <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Location</th>
                  <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-surface-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        Loading installers...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-surface-400 text-sm">
                      <Wrench className="w-8 h-8 text-surface-300 mx-auto mb-3" />
                      No installers found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(installer => (
                    <tr key={installer.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {installer.full_name?.substring(0, 2).toUpperCase() || 'IN'}
                          </div>
                          <div className="font-semibold text-surface-900">{installer.full_name || 'Unknown'}</div>
                        </div>
                      </td>
                      <td className="py-4 px-5 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-surface-600">
                          <Mail className="w-4 h-4 text-surface-400 flex-shrink-0" /> {installer.email}
                        </div>
                        {installer.phone && (
                          <div className="flex items-center gap-2 text-sm text-surface-600">
                            <Phone className="w-4 h-4 text-surface-400 flex-shrink-0" /> {installer.phone}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          installer.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                        }`}>
                          {installer.status === 'active' ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          installer.is_available ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-500'
                        }`}>
                          {installer.is_available ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {installer.is_available ? 'Available' : 'Offline'}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        {installer.lat && installer.lng ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">
                            <MapPin className="w-3 h-3" /> Sharing
                          </span>
                        ) : (
                          <span className="text-xs text-surface-400">Not shared</span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-sm text-surface-500">{formatDate(installer.created_at)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
