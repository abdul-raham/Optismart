import { Bell, Search, LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { getInitials, formatDate } from '@/lib/utils'
import optismartLogo from '@/assets/optismart-logo.png'
import { supabase } from '@/lib/supabase'

export function Topbar() {
  const { user, logout } = useAuthStore()
  const { notifications, unreadCount, fetchNotifications, markAllRead, addNotification } = useNotificationsStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!user?.id) return

    fetchNotifications(user.id)
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => addNotification(payload.new as any)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchNotifications, addNotification])

  return (
    <header 
      className="h-[68px] mx-4 md:mx-8 mt-3 mb-2 rounded-2xl flex items-center justify-between px-4 md:px-6 z-20 sticky top-3 transition-all duration-300"
      style={{
        backdropFilter: 'blur(24px) saturate(180%)',
        background: 'rgba(255, 255, 255, 0.82)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 10px 30px -10px rgba(15, 23, 42, 0.08), 0 2px 8px -2px rgba(15, 23, 42, 0.04)'
      }}
    >
      
      {/* Search Bar - hidden on mobile, or replaced by a button */}
      <div className="flex-1 max-w-md hidden md:flex items-center relative">
        <Search className="w-4 h-4 text-surface-400 absolute left-3" />
        <input 
          type="text" 
          placeholder="Search orders, leads, or products..." 
          className="w-full bg-white/70 border border-surface-200/80 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all backdrop-blur-md"
        />
        <div className="absolute right-3 flex items-center gap-1">
          <kbd className="hidden lg:inline-block text-[10px] font-mono text-surface-400 bg-white/90 border border-surface-200 px-1.5 py-0.5 rounded shadow-xs">Ctrl</kbd>
          <kbd className="hidden lg:inline-block text-[10px] font-mono text-surface-400 bg-white/90 border border-surface-200 px-1.5 py-0.5 rounded shadow-xs">K</kbd>
        </div>
      </div>

      <div className="md:hidden flex-1 flex items-center gap-2">
        <img src={optismartLogo} alt="OptiSmart" className="h-8 w-auto object-contain" />
        {user?.role && (
          <span className="px-2.5 py-0.5 rounded-full bg-brand-50/80 border border-brand-200/60 text-brand-700 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
            {user.role.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-surface-600 hover:text-surface-900 hover:bg-white/80 rounded-full transition-all border border-transparent hover:border-surface-200/80"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-brand-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setShowNotifications(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-3 w-80 sm:w-96 rounded-2xl p-3 z-40 border border-white/80 shadow-2xl"
                  style={{
                    backdropFilter: 'blur(24px) saturate(180%)',
                    background: 'rgba(255, 255, 255, 0.94)',
                    boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.18)'
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100/80 mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-surface-900 flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-brand-600" /> Notifications ({unreadCount})
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => user?.id && markAllRead(user.id)}
                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-surface-100/60">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-surface-400">No notifications yet.</div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div key={n.id} className={`p-2.5 rounded-xl transition-colors ${n.is_read ? 'opacity-70 bg-transparent' : 'bg-brand-50/50'}`}>
                          <p className="text-xs font-bold text-surface-900">{n.title}</p>
                          <p className="text-xs text-surface-600 mt-0.5 leading-snug">{n.message}</p>
                          <p className="text-[10px] text-surface-400 mt-1 font-medium">{formatDate(n.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="h-6 w-px bg-surface-200/80 hidden md:block"></div>

        {/* User Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 hover:bg-white/80 p-1.5 pr-3 rounded-full transition-all border border-transparent hover:border-surface-200/80 hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold shadow-brand">
              {getInitials(user?.full_name ?? 'U')}
            </div>
            <span className="hidden sm:inline-block text-xs font-bold text-surface-800">{user?.full_name?.split(' ')[0]}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setShowDropdown(false)}
                ></div>
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-3 w-56 rounded-2xl p-2 z-40 border border-white/80 shadow-2xl"
                  style={{
                    backdropFilter: 'blur(24px) saturate(180%)',
                    background: 'rgba(255, 255, 255, 0.92)',
                    boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  <div className="px-4 py-2.5 border-b border-surface-100/80 mb-1">
                    <p className="text-sm font-bold text-surface-900 truncate">{user?.full_name}</p>
                    <p className="text-xs text-surface-500 truncate">{user?.email}</p>
                  </div>
                  
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-surface-700 hover:bg-surface-100/80 hover:text-surface-900 transition-colors">
                    <UserIcon className="w-4 h-4 text-surface-400" />
                    Profile Settings
                  </button>
                  
                  <div className="h-px bg-surface-100/80 my-1"></div>
                  
                  <button 
                    onClick={() => {
                      setShowDropdown(false)
                      logout()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-danger-600 hover:bg-danger-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
