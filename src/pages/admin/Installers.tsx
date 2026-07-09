import { useEffect, useState, useRef } from 'react'
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

// Distinct colors for each installer marker
const MARKER_COLORS = ['#0A74FF', '#e11d48', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#15803d']

function makeIcon(color: string, initials: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}"/>
      <circle cx="18" cy="18" r="12" fill="white" opacity="0.95"/>
      <text x="18" y="23" text-anchor="middle" font-size="10" font-weight="800" font-family="Inter,sans-serif" fill="${color}">${initials}</text>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  })
}

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
  color: string
}

function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 1.2 })
  }, [target, map])
  return null
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
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const markerRefs = useRef<Record<string, L.Marker>>({})

  useEffect(() => { fetchInstallers() }, [])

  const fetchInstallers = async () => {
    setLoading(true)
    try {
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

      const mapped: Installer[] = (users ?? []).map((u, idx) => {
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
          location: (p?.location && p.location !== 'Not set') ? p.location : null,
          color: MARKER_COLORS[idx % MARKER_COLORS.length],
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

  const handleFlyTo = (installer: Installer) => {
    if (!installer.lat || !installer.lng) return
    setFlyTarget({ lat: installer.lat, lng: installer.lng })
    // open popup after fly
    setTimeout(() => {
      markerRefs.current[installer.id]?.openPopup()
    }, 1300)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Installers</h1>
        <p className="text-sm text-surface-500 mt-1">Manage and view all registered installers.</p>
      </div>

      {!loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-surface-100 text-surface-600">{installers.length} Total</span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-success-50 text-success-700">{installers.filter(i => i.status === 'active').length} Active</span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700">{installers.filter(i => i.is_available).length} Available Now</span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {withLocation.length} Sharing Location
          </span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden flex flex-col">
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
              <MapIcon className="w-4 h-4" /> Map
              {withLocation.length > 0 && (
                <span className="bg-brand-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{withLocation.length}</span>
              )}
            </button>
          </div>
        </div>

        {viewMode === 'map' ? (
          <div className="flex h-[500px] sm:h-[600px] relative">
            {/* Side panel */}
            <div className={`${
              panelOpen ? 'w-64' : 'w-0'
            } flex-shrink-0 border-r border-surface-100 overflow-hidden bg-white transition-all duration-300 absolute sm:relative z-10 h-full`}>
              <div className="w-64">
                <div className="p-3 border-b border-surface-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">
                    {withLocation.length} on map · click to locate
                  </p>
                  <button onClick={() => setPanelOpen(false)} className="text-surface-400 hover:text-surface-700 sm:hidden">
                    ✕
                  </button>
                </div>
                <div className="divide-y divide-surface-50 overflow-y-auto" style={{ maxHeight: 'calc(100% - 44px)' }}>
                  {filtered.map(installer => (
                    <button
                      key={installer.id}
                      onClick={() => installer.lat && installer.lng ? handleFlyTo(installer) : undefined}
                      className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors ${
                        installer.lat && installer.lng
                          ? 'hover:bg-surface-50 cursor-pointer'
                          : 'opacity-40 cursor-default'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style={{ backgroundColor: installer.color }}
                      >
                        {installer.full_name?.substring(0, 2).toUpperCase() || 'IN'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-surface-900 truncate">{installer.full_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${installer.is_available ? 'bg-success-500' : 'bg-surface-300'}`} />
                          <span className="text-xs text-surface-500">{installer.is_available ? 'Available' : 'Offline'}</span>
                          {installer.lat && installer.lng && (
                            <MapPin className="w-3 h-3 text-orange-500 flex-shrink-0" />
                          )}
                        </div>
                        {installer.location && (
                          <p className="text-[10px] text-surface-400 truncate mt-0.5">{installer.location}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative z-0">
              {!panelOpen && (
                <button
                  onClick={() => setPanelOpen(true)}
                  className="absolute top-3 left-3 z-[999] bg-white shadow-md rounded-lg px-3 py-1.5 text-xs font-bold text-surface-700 flex items-center gap-1.5 hover:bg-surface-50"
                >
                  <List className="w-3.5 h-3.5" /> Installers
                </button>
              )}
              {withLocation.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                  <MapPin className="w-10 h-10 text-surface-300 mb-3" />
                  <p className="text-sm font-bold text-surface-500">No installers have shared their location yet.</p>
                </div>
              )}
              <MapContainer center={[9.082, 8.6753]} zoom={6} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds installers={filtered} />
                <FlyTo target={flyTarget} />
                {withLocation.map(installer => (
                  <Marker
                    key={installer.id}
                    position={[installer.lat!, installer.lng!]}
                    icon={makeIcon(installer.color, installer.full_name?.substring(0, 2).toUpperCase() || 'IN')}
                    ref={ref => { if (ref) markerRefs.current[installer.id] = ref }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[160px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ backgroundColor: installer.color }}>
                            {installer.full_name?.substring(0, 2).toUpperCase()}
                          </div>
                          <p className="font-bold text-sm">{installer.full_name}</p>
                        </div>
                        {installer.phone && <p className="text-xs text-gray-500 mb-1">📞 {installer.phone}</p>}
                        {installer.location && <p className="text-xs text-gray-500 mb-2">📍 {installer.location}</p>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${installer.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {installer.is_available ? '● Available' : '○ Offline'}
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
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
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ backgroundColor: installer.color }}
                          >
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
                          <div className="space-y-1">
                            {installer.location && (
                              <p className="text-xs text-surface-600 font-medium">{installer.location}</p>
                            )}
                            <button
                              onClick={() => { setViewMode('map'); setPanelOpen(true); setTimeout(() => handleFlyTo(installer), 100) }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full hover:bg-orange-100 transition-colors"
                            >
                              <MapPin className="w-3 h-3" /> View on Map
                            </button>
                          </div>
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
