import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Search, MapPin, Phone, Mail, Wrench } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Installer {
  id: string
  auth_id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  created_at: string
}

export function AdminInstallers() {
  const [installers, setInstallers] = useState<Installer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchInstallers()
  }, [])

  const fetchInstallers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'installer')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setInstallers(data || [])
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
          <div className="text-sm font-medium text-surface-500">
            {filteredInstallers.length} {filteredInstallers.length === 1 ? 'Installer' : 'Installers'}
          </div>
        </div>

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
      </motion.div>
    </div>
  )
}
