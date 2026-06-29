import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Phone, Mail, Wrench, List, Map as MapIcon } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default leaflet icons in React
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})
import { formatDate } from '@/lib/utils'

interface Installer {
  id: string
  auth_id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  created_at: string
  lat?: number
  lng?: number
}

export function AdminInstallers() {
  const [installers, setInstallers] = useState<Installer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  useEffect(() => {
    fetchInstallers()
  }, [])

  const fetchInstallers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          installer_profiles (lat, lng)
        `)
        .eq('role', 'installer')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      const mappedInstallers = (data || []).map(u => ({
        ...u,
        lat: u.installer_profiles?.[0]?.lat,
        lng: u.installer_profiles?.[0]?.lng
      }))
      
      setInstallers(mappedInstallers as Installer[])
    } catch (err) {
      console.error('Error fetching installers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredInstallers = installers.filter(i => 
    i.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    i.email?.toLowerCase().includes(search.toLowerCase()) ||
    i.phone?.includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Installers</h1>
          <p className="text-sm text-surface-500 mt-1">Manage and view all registered installers.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card overflow-hidden flex flex-col"
      >
        <div className="p-5 border-b border-surface-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search installers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-surface-200 bg-surface-50 text-sm focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
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
              </button>
            </div>
            <div className="text-sm font-medium text-surface-500 hidden sm:block">
              {filteredInstallers.length} {filteredInstallers.length === 1 ? 'Installer' : 'Installers'}
            </div>
          </div>
        </div>

        {viewMode === 'map' ? (
          <div className="h-[600px] w-full bg-surface-50 relative z-0">
            <MapContainer center={[6.5244, 3.3792]} zoom={11} scrollWheelZoom={false} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredInstallers.map(installer => installer.lat && installer.lng && (
                <Marker key={installer.id} position={[installer.lat, installer.lng]}>
                  <Popup>
                    <div className="p-1">
                      <p className="font-bold text-sm mb-1">{installer.full_name}</p>
                      <p className="text-xs text-surface-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {installer.phone || 'N/A'}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-50/50">
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Installer</th>
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Contact</th>
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-surface-400 text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      Loading installers...
                    </div>
                  </td>
                </tr>
              ) : filteredInstallers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-surface-400 text-sm">
                    <Wrench className="w-8 h-8 text-surface-300 mx-auto mb-3" />
                    No installers found.
                  </td>
                </tr>
              ) : (
                filteredInstallers.map((installer) => (
                  <tr key={installer.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm">
                          {installer.full_name?.substring(0, 2).toUpperCase() || 'IN'}
                        </div>
                        <div>
                          <div className="font-semibold text-surface-900">{installer.full_name || 'Unknown User'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-surface-600">
                        <Mail className="w-4 h-4 text-surface-400" />
                        {installer.email}
                      </div>
                      {installer.phone && (
                        <div className="flex items-center gap-2 text-sm text-surface-600">
                          <Phone className="w-4 h-4 text-surface-400" />
                          {installer.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        installer.status === 'active' 
                          ? 'bg-success-50 text-success-700' 
                          : 'bg-warning-50 text-warning-700'
                      }`}>
                        {installer.status === 'active' ? 'Active' : 'Pending'}
                      </span>
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
