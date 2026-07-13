import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Users, Search, Shield, ShieldAlert, Mail, MoreVertical, Ban, CheckCircle2, ChevronDown, ChevronUp, Settings2, Sliders } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'
import { useAuthStore } from '@/stores/authStore'

interface SystemUser {
  id: string
  email: string
  full_name: string
  role: string
  status: 'active' | 'suspended'
  created_at: string
  commission_threshold?: number
  commission_per_camera?: number
}

interface AdminPermissions {
  user_id: string
  can_view_orders: boolean
  can_manage_orders: boolean
  can_view_payments: boolean
  can_confirm_payments: boolean
  can_view_users: boolean
  can_manage_users: boolean
  can_view_installers: boolean
  can_assign_installers: boolean
  can_view_products: boolean
  can_manage_products: boolean
  can_view_reports: boolean
  can_view_expenses: boolean
}

const DEFAULT_PERMISSIONS: Omit<AdminPermissions, 'user_id'> = {
  can_view_orders: true,
  can_manage_orders: true,
  can_view_payments: true,
  can_confirm_payments: false,
  can_view_users: true,
  can_manage_users: false,
  can_view_installers: true,
  can_assign_installers: true,
  can_view_products: true,
  can_manage_products: false,
  can_view_reports: true,
  can_view_expenses: false,
}

const PERMISSION_LABELS: Record<keyof Omit<AdminPermissions, 'user_id'>, string> = {
  can_view_orders: 'View Orders',
  can_manage_orders: 'Manage Orders',
  can_view_payments: 'View Payments',
  can_confirm_payments: 'Confirm Payments',
  can_view_users: 'View Users',
  can_manage_users: 'Manage Users',
  can_view_installers: 'View Installers',
  can_assign_installers: 'Assign Installers',
  can_view_products: 'View Products',
  can_manage_products: 'Manage Products',
  can_view_reports: 'View Reports',
  can_view_expenses: 'View Expenses',
}

export function AdminUsers() {
  const { user: currentUser, role: currentRole } = useAuthStore()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, AdminPermissions>>({})
  const [savingPerms, setSavingPerms] = useState<string | null>(null)
  const [savingCommission, setSavingCommission] = useState<string | null>(null)
  const [localCommissions, setLocalCommissions] = useState<Record<string, { threshold: number; per_camera: number }>>({})

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) {
        setUsers(data as SystemUser[])
        // Init local commission state
        const cm: Record<string, { threshold: number; per_camera: number }> = {}
        data.forEach((u: any) => {
          cm[u.id] = { threshold: u.commission_threshold ?? 0, per_camera: u.commission_per_camera ?? 5000 }
        })
        setLocalCommissions(cm)
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPermissions = async (userId: string) => {
    const { data } = await supabase
      .from('admin_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    setPermissions(prev => ({
      ...prev,
      [userId]: data ? data as AdminPermissions : { user_id: userId, ...DEFAULT_PERMISSIONS }
    }))
  }

  const handleExpand = (userId: string, role: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null)
    } else {
      setExpandedUser(userId)
      if (role === 'admin') fetchPermissions(userId)
    }
  }

  const togglePermission = (userId: string, key: keyof Omit<AdminPermissions, 'user_id'>) => {
    setPermissions(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [key]: !prev[userId][key] }
    }))
  }

  const savePermissions = async (userId: string) => {
    setSavingPerms(userId)
    try {
      const perms = permissions[userId]
      await supabase.from('admin_permissions').upsert({ ...perms, user_id: userId, updated_at: new Date().toISOString() })
    } catch (err) {
      console.error('Error saving permissions:', err)
      alert('Failed to save permissions')
    } finally {
      setSavingPerms(null)
    }
  }

  const saveCommission = async (userId: string) => {
    setSavingCommission(userId)
    try {
      const { threshold, per_camera } = localCommissions[userId]
      const { error } = await supabase.from('users')
        .update({ commission_threshold: threshold, commission_per_camera: per_camera })
        .eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, commission_threshold: threshold, commission_per_camera: per_camera } : u))
    } catch (err) {
      console.error('Error saving commission:', err)
      alert('Failed to save commission settings')
    } finally {
      setSavingCommission(null)
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    try {
      const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', userId)
      if (error) throw error
      const updatedUser = users.find(u => u.id === userId)
      if (updatedUser && newStatus === 'active') {
        sendEmail('account_approved', { recipientEmail: updatedUser.email, recipientName: updatedUser.full_name, role: updatedUser.role }).catch(console.error)
        sendWebPush(userId, 'Account Approved', `Your ${updatedUser.role} account has been activated! Welcome to Optismart.`, '/app').catch(console.error)
      }
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u))
    } catch (err) {
      console.error('Error updating user status:', err)
      alert('Failed to update user status')
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const canModifyUser = (targetRole: string) => {
    if (currentRole === 'super_admin') return targetRole !== 'super_admin'
    if (currentRole === 'admin') return !['admin', 'super_admin'].includes(targetRole)
    return false
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'super_admin': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'admin':       return 'bg-rose-100 text-rose-700 border-rose-200'
      case 'dsa':         return 'bg-brand-100 text-brand-700 border-brand-200'
      case 'installer':   return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'reseller':    return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default:            return 'bg-surface-100 text-surface-700 border-surface-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">User Management</h1>
          <p className="text-sm text-surface-500 mt-1">Manage roles, commissions, permissions and accounts.</p>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
          {['all', 'super_admin', 'admin', 'dsa', 'installer', 'reseller'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                roleFilter === r ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'bg-surface-50 text-surface-500 hover:bg-surface-100'
              }`}
            >{r}</button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none w-full transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="glass-card h-[400px] animate-pulse bg-surface-50/50" />
      ) : filteredUsers.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">No users found</h3>
          <p className="text-surface-500 max-w-md">Try adjusting your search or role filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredUsers.map(u => (
              <motion.div
                key={u.id} layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-card relative overflow-hidden transition-colors ${u.status === 'suspended' ? 'opacity-70 bg-surface-50' : 'hover:border-brand-200'}`}
              >
                {/* Card Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-sm ${u.status === 'suspended' ? 'bg-surface-300' : 'bg-gradient-to-br from-brand-500 to-cyan-400'}`}>
                        {u.full_name?.charAt(0) || u.email?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-surface-900">{u.full_name || 'No Name'}</h3>
                        <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {u.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getRoleColor(u.role)}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                    {u.status === 'suspended' && (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-danger-50 text-danger-600 border border-danger-200 flex items-center gap-1">
                        <Ban className="w-3 h-3" /> Suspended
                      </span>
                    )}
                  </div>

                  <div className="pt-4 border-t border-surface-100 flex items-center justify-between">
                    <span className="text-xs text-surface-400 font-medium">Joined {formatDate(u.created_at)}</span>
                    <div className="flex items-center gap-2">
                      {/* Expand panel — for DSA (commission) or Admin (permissions) */}
                      {(u.role === 'dsa' || (u.role === 'admin' && currentRole === 'super_admin')) && (
                        <button
                          onClick={() => handleExpand(u.id, u.role)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition-colors flex items-center gap-1.5"
                        >
                          {u.role === 'dsa' ? <Sliders className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                          {expandedUser === u.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                      {canModifyUser(u.role) && u.id !== currentUser?.id ? (
                        <button
                          onClick={() => toggleUserStatus(u.id, u.status)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                            u.status === 'active'
                              ? 'bg-white border-surface-200 text-danger-600 hover:border-danger-200 hover:bg-danger-50'
                              : 'bg-white border-surface-200 text-success-600 hover:border-success-200 hover:bg-success-50'
                          }`}
                        >
                          {u.status === 'active' ? <><Ban className="w-3.5 h-3.5" /> Suspend</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Reactivate</>}
                        </button>
                      ) : (
                        <button disabled className="text-xs font-bold px-3 py-1.5 rounded-lg border border-surface-200 bg-surface-100 text-surface-400 opacity-50 cursor-not-allowed flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" /> Restricted
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Panel */}
                <AnimatePresence>
                  {expandedUser === u.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-surface-100 overflow-hidden"
                    >
                      <div className="p-5 bg-surface-50/60">
                        {/* DSA: Commission Settings */}
                        {u.role === 'dsa' && (
                          <div>
                            <h4 className="text-sm font-bold text-surface-700 mb-3 flex items-center gap-2">
                              <Sliders className="w-4 h-4 text-brand-500" /> Commission Settings
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-semibold text-surface-600 mb-1 block">
                                  Camera Threshold
                                  <span className="font-normal text-surface-400 ml-1">(set 0 = earn from sale #1)</span>
                                </label>
                                <input
                                  type="number" min={0}
                                  value={localCommissions[u.id]?.threshold ?? 0}
                                  onChange={e => setLocalCommissions(prev => ({ ...prev, [u.id]: { ...prev[u.id], threshold: Number(e.target.value) } }))}
                                  className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-surface-600 mb-1 block">
                                  Commission per Camera (₦)
                                </label>
                                <input
                                  type="number" min={0}
                                  value={localCommissions[u.id]?.per_camera ?? 5000}
                                  onChange={e => setLocalCommissions(prev => ({ ...prev, [u.id]: { ...prev[u.id], per_camera: Number(e.target.value) } }))}
                                  className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                              </div>
                              <button
                                onClick={() => saveCommission(u.id)}
                                disabled={savingCommission === u.id}
                                className="w-full py-2 text-sm font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
                              >
                                {savingCommission === u.id ? 'Saving...' : 'Save Commission Settings'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Admin: Permissions (super_admin only) */}
                        {u.role === 'admin' && currentRole === 'super_admin' && permissions[u.id] && (
                          <div>
                            <h4 className="text-sm font-bold text-surface-700 mb-3 flex items-center gap-2">
                              <Shield className="w-4 h-4 text-purple-500" /> Access Permissions
                            </h4>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {(Object.keys(PERMISSION_LABELS) as Array<keyof Omit<AdminPermissions, 'user_id'>>).map(key => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer text-xs">
                                  <div
                                    onClick={() => togglePermission(u.id, key)}
                                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${permissions[u.id][key] ? 'bg-brand-500' : 'bg-surface-300'}`}
                                  >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${permissions[u.id][key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                  </div>
                                  <span className="text-surface-600 font-medium">{PERMISSION_LABELS[key]}</span>
                                </label>
                              ))}
                            </div>
                            <button
                              onClick={() => savePermissions(u.id)}
                              disabled={savingPerms === u.id}
                              className="w-full py-2 text-sm font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-60"
                            >
                              {savingPerms === u.id ? 'Saving...' : 'Save Permissions'}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
