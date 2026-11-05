import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Users, Search, Mail, Ban, CheckCircle2, User, Phone, ExternalLink, AlertTriangle, UserPlus, X, Copy } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { TableSkeleton } from '@/components/shared/Skeletons'
import { PushCoverage } from '@/components/shared/PushCoverage'
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

  const me = useAuthStore(state => state.user)
  const canManage = me?.role === 'super_admin' || (me?.role === 'admin' && Boolean(me?.can_manage_users))
  const isSuper = me?.role === 'super_admin'
  const ASSIGNABLE = isSuper ? ['super_admin', 'admin', 'dsa', 'installer', 'reseller', 'outlet'] : ['dsa', 'installer', 'reseller', 'outlet']
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '', role: 'dsa' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true); setAddError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin-users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(addForm) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'The account could not be created')
      setCreated({ email: json.email, password: json.password })
      setAddForm({ full_name: '', email: '', phone: '', role: 'dsa' })
      fetchUsers()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'The account could not be created')
    } finally { setAdding(false) }
  }

  const changeRole = async (userId: string, role: string) => {
    const { error } = await supabase.from('users').update({ role, updated_at: new Date().toISOString() }).eq('id', userId)
    if (error) { alert(error.message.includes('super admin') || error.message.includes('administrator') || error.message.includes('own role') ? error.message : 'Could not change the role'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
  }

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
            supabase.from('orders').select('dsa_id, status, created_at, delivered_at').in('dsa_id', dsaIds).eq('status', 'delivered').gte('delivered_at', `${currentMonthStr}-01T00:00:00+01:00`),
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
        {canManage && (
          <button onClick={() => { setShowAdd(true); setCreated(null); setAddError('') }} className="btn-primary h-10 px-4 text-sm font-semibold flex items-center gap-2 self-start sm:self-auto">
            <UserPlus className="w-4 h-4" /> Add user
          </button>
        )}
      </div>

      <PushCoverage />

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
                        {canManage && u.id !== me?.id && (isSuper || !['admin', 'super_admin'].includes(u.role)) ? (
                          <select value={u.role} onClick={e => e.stopPropagation()} onChange={e => changeRole(u.id, e.target.value)} aria-label={`Role for ${u.full_name}`}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${getRoleColor(u.role)}`}>
                            {Array.from(new Set([u.role, ...ASSIGNABLE])).map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRoleColor(u.role)}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        )}
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

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm" onClick={() => !adding && setShowAdd(false)} />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-surface-900">{created ? 'Account created' : 'Add a user'}</h2>
                <button onClick={() => setShowAdd(false)} aria-label="Close" className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100"><X className="h-5 w-5" /></button>
              </div>
              {created ? (
                <div className="space-y-4">
                  <p className="text-sm text-surface-600">Share these details privately. They can change the password after signing in (Settings → password).</p>
                  <div className="space-y-2 rounded-2xl bg-surface-50 p-4 text-sm">
                    <p><span className="text-surface-500">Email:</span> <strong className="select-all">{created.email}</strong></p>
                    <p><span className="text-surface-500">Temporary password:</span> <strong className="select-all font-mono">{created.password}</strong></p>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(`Email: ${created.email}\nPassword: ${created.password}`).catch(() => {}) }} className="btn-outline flex w-full items-center justify-center gap-2"><Copy className="h-4 w-4" /> Copy details</button>
                  <p className="text-xs text-surface-400">This password is shown only once. For OptiSmart OS access, also add them in OS → Team.</p>
                </div>
              ) : (
                <form onSubmit={createUser} className="space-y-3">
                  <div><label className="label">Full name *</label><input required className="input" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} /></div>
                  <div><label className="label">Email *</label><input required type="email" className="input" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} /></div>
                  <div><label className="label">Phone</label><input type="tel" className="input" placeholder="080..." value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} /></div>
                  <div><label className="label">Role *</label>
                    <select className="input" value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                      {ASSIGNABLE.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  {addError && <p className="rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">{addError}</p>}
                  <button type="submit" disabled={adding} className="btn-primary w-full">{adding ? 'Creating…' : 'Create account'}</button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
