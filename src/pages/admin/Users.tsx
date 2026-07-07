import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Users, Search, Shield, ShieldAlert, Mail, MapPin, MoreVertical, Ban, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

import { useAuthStore } from '@/stores/authStore'

interface SystemUser {
  id: string
  email: string
  full_name: string
  role: string
  status: 'active' | 'suspended'
  created_at: string
}

export function AdminUsers() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (data) setUsers(data as SystemUser[])
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
        .update({ status: newStatus })
        .eq('id', userId)

      if (error) throw error
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
    if (currentUser?.role === 'super_admin') {
      return targetRole !== 'super_admin'
    }
    if (currentUser?.role === 'admin') {
      return !['admin', 'super_admin'].includes(targetRole)
    }
    return false
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'super_admin': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'admin': return 'bg-rose-100 text-rose-700 border-rose-200'
      case 'dsa': return 'bg-brand-100 text-brand-700 border-brand-200'
      case 'installer': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'reseller': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default: return 'bg-surface-100 text-surface-700 border-surface-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">User Management</h1>
          <p className="text-sm text-surface-500 mt-1">Manage system roles, permissions, and accounts.</p>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
          {['all', 'dsa', 'installer', 'admin', 'reseller'].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                roleFilter === role ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'bg-surface-50 text-surface-500 hover:bg-surface-100'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            {filteredUsers.map(user => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-card p-5 relative overflow-hidden transition-colors ${user.status === 'suspended' ? 'opacity-70 bg-surface-50' : 'hover:border-brand-200'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-sm ${user.status === 'suspended' ? 'bg-surface-300' : 'bg-gradient-to-br from-brand-500 to-cyan-400'}`}>
                      {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-surface-900">{user.full_name || 'No Name'}</h3>
                      <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {user.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getRoleColor(user.role)}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                  {user.status === 'suspended' && (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-danger-50 text-danger-600 border border-danger-200 flex items-center gap-1">
                      <Ban className="w-3 h-3" /> Suspended
                    </span>
                  )}
                </div>

                <div className="pt-4 border-t border-surface-100 flex items-center justify-between">
                  <span className="text-xs text-surface-400 font-medium">
                    Joined {formatDate(user.created_at)}
                  </span>
                  
                  {canModifyUser(user.role) && user.id !== currentUser?.id ? (
                    <button 
                      onClick={() => toggleUserStatus(user.id, user.status)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                        user.status === 'active' 
                          ? 'bg-white border-surface-200 text-danger-600 hover:border-danger-200 hover:bg-danger-50'
                          : 'bg-white border-surface-200 text-success-600 hover:border-success-200 hover:bg-success-50'
                      }`}
                    >
                      {user.status === 'active' ? (
                        <><Ban className="w-3.5 h-3.5" /> Suspend</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Reactivate</>
                      )}
                    </button>
                  ) : (
                    <button 
                      disabled
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-surface-200 bg-surface-100 text-surface-400 opacity-50 cursor-not-allowed flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Restricted
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
