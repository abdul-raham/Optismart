import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Users, Search, Mail, Ban, CheckCircle2, User, Phone, ExternalLink, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { TableSkeleton } from '@/components/shared/Skeletons'
import { checkDSAPerformanceWindows } from '@/lib/performanceWatcher'

interface SystemUser {
  id: string
  email: string
  full_name: string
  phone?: string
  role: string
  status: 'active' | 'suspended'
  created_at: string
}

export function AdminUsers() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('highlight') === 'probation' ? 'probation' : 'all'
  )
  const [probationMap, setProbationMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchUsers()
    checkDSAPerformanceWindows().catch(console.error)
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, role, status, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) {
        setUsers(data)

        // Calculate probation status for DSAs in current month
        const now = new Date()
        const currentMonthStr = now.toISOString().slice(0, 7)
        const dsaIds = data.filter(u => u.role === 'dsa').map(u => u.id)

        if (dsaIds.length > 0) {
          const { data: dsaOrders } = await supabase
            .from('orders')
            .select('dsa_id, status, created_at')
            .in('dsa_id', dsaIds)
            .eq('status', 'delivered')
            .gte('created_at', `${currentMonthStr}-01T00:00:00.000Z`)

          const pMap: Record<string, boolean> = {}
          dsaIds.forEach(id => {
            const deliveredCount = dsaOrders?.filter(o => o.dsa_id === id).length || 0
            pMap[id] = deliveredCount < 20
          })
          setProbationMap(pMap)
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus as any } : u))
    } catch (err) {
      console.error('Error toggling status:', err)
      alert('Failed to update status')
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'dsa': return 'bg-cyan-100 text-cyan-800 border-cyan-300'
      case 'installer': return 'bg-amber-100 text-amber-800 border-amber-300'
      default: return 'bg-surface-100 text-surface-700 border-surface-300'
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter

    let matchesStatus = true
    if (statusFilter === 'active') matchesStatus = u.status === 'active'
    if (statusFilter === 'suspended') matchesStatus = u.status === 'suspended'
    if (statusFilter === 'probation') matchesStatus = u.role === 'dsa' && probationMap[u.id] === true

    return matchesSearch && matchesRole && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">User Management</h1>
          <p className="text-sm text-surface-500 mt-1">Manage accounts, performance probation status, and target settings.</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 hide-scrollbar">
          {['all', 'super_admin', 'admin', 'dsa', 'installer', 'reseller'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                roleFilter === r ? 'bg-brand-600 text-white shadow-brand' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {r.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-surface-200 bg-white text-xs font-bold text-surface-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="probation">⚠️ On Probation Only</option>
            <option value="suspended">🔴 Suspended Only</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-surface-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* User Grid Cards */}
      {loading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : filteredUsers.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No users found</h3>
          <p className="text-surface-500 max-w-md text-xs">Try adjusting your search or role filters.</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${searchParams.get('highlight') ? 'animate-feature-glow p-2 rounded-2xl border border-brand-500' : ''}`}>
          <AnimatePresence>
            {filteredUsers.map(u => (
              <motion.div
                key={u.id} layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-card p-5 relative overflow-hidden transition-all flex flex-col justify-between ${
                  u.status === 'suspended' ? 'opacity-70 bg-surface-50' : 'hover:border-brand-300 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Card Header Profile */}
                  <div
                    onClick={() => navigate(`/app/admin/users/${u.id}`)}
                    className="flex items-start justify-between mb-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-sm shrink-0 ${
                        u.status === 'suspended' ? 'bg-surface-400' : 'bg-gradient-to-br from-brand-500 to-cyan-500'
                      }`}>
                        {u.full_name?.charAt(0) || u.email?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-surface-900 group-hover:text-brand-600 transition-colors flex items-center gap-1.5 text-base">
                          {u.full_name || 'No Name'} <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-brand-600" />
                        </h3>
                        <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5 font-medium">
                          <Mail className="w-3.5 h-3.5" /> {u.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getRoleColor(u.role)}`}>
                      {u.role.replace('_', ' ')}
                    </span>

                    {/* Probation Badge for DSA */}
                    {u.role === 'dsa' && (
                      probationMap[u.id] ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> On Probation
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Off Probation
                        </span>
                      )
                    )}

                    {u.status === 'active' ? (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <Ban className="w-3 h-3 text-rose-600" /> Suspended
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="pt-4 border-t border-surface-100 flex items-center justify-between mt-2">
                  <span className="text-xs text-surface-400 font-medium">Joined {formatDate(u.created_at)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/app/admin/users/${u.id}`)}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-brand flex items-center gap-1.5"
                    >
                      <User className="w-3.5 h-3.5" /> View Profile & Report
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
