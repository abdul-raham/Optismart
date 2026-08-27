import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Users, Search, Mail, Ban, CheckCircle2, User, Phone, ExternalLink, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
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
  probation_approval_status?: 'none' | 'pending_confirmation' | 'confirmed_probation' | 'waived'
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
  const [adSpendMap, setAdSpendMap] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchUsers()
    checkDSAPerformanceWindows().catch(console.error)
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, role, status, created_at, probation_approval_status')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) {
        setUsers(data)

        // Calculate probation status for DSAs in current month
        const now = new Date()
        const currentMonthStr = now.toISOString().slice(0, 7)
        const dsaIds = data.filter(u => u.role === 'dsa').map(u => u.id)

        if (dsaIds.length > 0) {
          const [{ data: dsaOrders }, { data: adExpenses }] = await Promise.all([
            supabase.from('orders').select('dsa_id, status, created_at').in('dsa_id', dsaIds).eq('status', 'delivered').gte('created_at', `${currentMonthStr}-01T00:00:00.000Z`),
            supabase.from('expenses').select('dsa_id, amount, category').in('dsa_id', dsaIds),
          ])

          const pMap: Record<string, boolean> = {}
          dsaIds.forEach(id => {
            const deliveredCount = dsaOrders?.filter(o => o.dsa_id === id).length || 0
            pMap[id] = deliveredCount < 20
          })
          setProbationMap(pMap)
          const spendMap: Record<string, number> = {}
          dsaIds.forEach(id => { spendMap[id] = 0 })
          adExpenses?.forEach(expense => {
            if (expense.dsa_id && ['advertising', 'ad_cost', 'marketing'].includes(String(expense.category).toLowerCase())) {
              spendMap[expense.dsa_id] = (spendMap[expense.dsa_id] || 0) + Number(expense.amount || 0)
            }
          })
          setAdSpendMap(spendMap)
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

  const handleUpdateProbation = async (userId: string, status: 'confirmed_probation' | 'waived') => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ probation_approval_status: status, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, probation_approval_status: status } : u))
    } catch (err) {
      console.error('Failed to update probation approval:', err)
      alert('Failed to update probation status')
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
    if (statusFilter === 'probation') matchesStatus = u.role === 'dsa' && u.status === 'active' && (probationMap[u.id] === true || u.probation_approval_status === 'confirmed_probation')

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

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-surface-200 bg-white text-xs font-bold text-surface-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="probation">On Probation Only</option>
            <option value="suspended">Suspended Only</option>
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
            {filteredUsers.map(u => {
              const isActiveDSA = u.role === 'dsa' && u.status === 'active'
              const isOnProbation = isActiveDSA && probationMap[u.id] && u.probation_approval_status !== 'waived'
              const isConfirmedProbation = isActiveDSA && u.probation_approval_status === 'confirmed_probation'
              const isProbationWaived = isActiveDSA && u.probation_approval_status === 'waived'

              return (
                <motion.div
                  key={u.id} layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  onClick={() => navigate(`/app/admin/users/${u.id}`)}
                  className={`glass-card relative overflow-hidden cursor-pointer transition-all group ${
                    u.status === 'suspended' ? 'opacity-60' : 'hover:shadow-md hover:border-brand-300'
                  }`}
                >
                  {/* Probation warning stripe at top */}
                  {isConfirmedProbation && (
                    <div className="bg-rose-500 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> On Confirmed Probation — Low Sales
                    </div>
                  )}
                  {isOnProbation && !isConfirmedProbation && (
                    <div className="bg-amber-400 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Low sales this month — Needs review
                    </div>
                  )}

                  <div className="p-5">
                    {/* Avatar + Identity */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0 ${
                        u.status === 'suspended' ? 'bg-surface-400' : 'bg-gradient-to-br from-brand-500 to-cyan-500'
                      }`}>
                        {u.full_name?.charAt(0) || u.email?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-surface-900 group-hover:text-brand-600 transition-colors text-sm leading-tight truncate flex items-center gap-1">
                          {u.full_name || 'No Name'}
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-brand-500 shrink-0" />
                        </h3>
                        <p className="text-xs text-surface-400 truncate mt-0.5">{u.email}</p>
                      </div>
                    </div>

                    {/* Role + Status row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRoleColor(u.role)}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                        {isProbationWaived && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200">
                            Waived
                          </span>
                        )}
                      </div>
                      {/* Status dot */}
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
                        u.status === 'active' ? 'text-emerald-600' : 'text-rose-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {u.status}
                      </span>
                    </div>

                    {/* Footer: join date + phone */}
                    <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-between text-xs text-surface-400">
                      <span>Joined {formatDate(u.created_at)}</span>
                      {u.phone && (
                        <span className="flex items-center gap-1 font-medium text-surface-500">
                          <Phone className="w-3 h-3" /> {u.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
