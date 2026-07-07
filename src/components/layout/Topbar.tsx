import { Bell, Search, LogOut, User as UserIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { getInitials } from '@/lib/utils'
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
    <header className="h-[72px] bg-white/72 backdrop-blur-xl border-b border-white/70 flex items-center justify-between px-4 md:px-8 z-20 sticky top-0">
      
      {/* Search Bar - hidden on mobile, or replaced by a button */}
      <div className="flex-1 max-w-md hidden md:flex items-center relative">
        <Search className="w-4 h-4 text-surface-400 absolute left-3" />
        <input 
          type="text" 
          placeholder="Search orders, leads, or products..." 
          className="w-full bg-surface-50 border border-surface-200 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
        />
        <div className="absolute right-3 flex items-center gap-1">
          <kbd className="hidden lg:inline-block text-[10px] font-mono text-surface-400 bg-white border border-surface-200 px-1.5 py-0.5 rounded">Ctrl</kbd>
          <kbd className="hidden lg:inline-block text-[10px] font-mono text-surface-400 bg-white border border-surface-200 px-1.5 py-0.5 rounded">K</kbd>
        </div>
      </div>

      <div className="md:hidden flex-1 flex items-center gap-2">
        <img src={optismartLogo} alt="OptiSmart" className="h-8 w-auto object-contain" />
        {user?.role && (
          <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
            {user.role.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowDropdown(false)
            }}
            className="relative p-2 text-surface-500 hover:bg-surface-50 hover:text-surface-800 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-danger-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-surface-100 bg-white shadow-card-lg"
                >
                  <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
                    <p className="text-sm font-black text-surface-900">Notifications</p>
                    {unreadCount > 0 && user?.id && (
                      <button onClick={() => markAllRead(user.id)} className="text-xs font-black text-brand-600 hover:text-brand-700">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.slice(0, 8).map((notification) => (
                      <div key={notification.id} className="border-b border-surface-50 px-4 py-3 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2 w-2 rounded-full ${notification.is_read ? 'bg-surface-200' : 'bg-brand-500'}`} />
                          <div>
                            <p className="text-sm font-bold text-surface-900">{notification.title}</p>
                            <p className="mt-0.5 text-xs leading-5 text-surface-500">{notification.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm font-semibold text-surface-500">No notifications yet.</div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="h-6 w-px bg-surface-200 hidden md:block"></div>

        {/* User Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 hover:bg-surface-50 p-1 pr-2 rounded-full transition-colors border border-transparent hover:border-surface-200"
          >
            <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {getInitials(user?.full_name ?? 'U')}
            </div>
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
                  className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-card-lg border border-surface-100 py-2 z-40"
                >
                  <div className="px-4 py-2 border-b border-surface-50 mb-1">
                    <p className="text-sm font-semibold text-surface-900 truncate">{user?.full_name}</p>
                    <p className="text-xs text-surface-500 truncate">{user?.email}</p>
                  </div>
                  
                  <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50 hover:text-surface-900 transition-colors">
                    <UserIcon className="w-4 h-4 text-surface-400" />
                    Profile Settings
                  </button>
                  
                  <div className="h-px bg-surface-50 my-1"></div>
                  
                  <button 
                    onClick={() => {
                      setShowDropdown(false)
                      logout()
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
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
