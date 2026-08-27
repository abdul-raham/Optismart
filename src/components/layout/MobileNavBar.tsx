import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { LayoutDashboard, Target, ShoppingBag, UserCheck, Settings, BookOpen, Menu, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { NAV_ITEMS } from './Sidebar'

// A simplified nav specifically for mobile bottom dock
// We pick the most important 4-5 tabs for each role
const MOBILE_NAV_ITEMS: Record<UserRole, { label: string; href: string; icon: any }[]> = {
  super_admin: [
    { label: 'Home',     href: '/app/admin',          icon: LayoutDashboard },
    { label: 'Orders',   href: '/app/admin/orders',   icon: ShoppingBag },
    { label: 'Users',    href: '/app/admin/users',    icon: UserCheck },
    { label: 'Settings', href: '/app/settings',       icon: Settings },
  ],
  admin: [
    { label: 'Home',     href: '/app/admin',          icon: LayoutDashboard },
    { label: 'Orders',   href: '/app/admin/orders',   icon: ShoppingBag },
    { label: 'Users',    href: '/app/admin/users',    icon: UserCheck },
    { label: 'Settings', href: '/app/settings',       icon: Settings },
  ],
  dsa: [
    { label: 'Home',   href: '/app/dsa',        icon: LayoutDashboard },
    { label: 'Leads',  href: '/app/dsa/leads',  icon: Target },
    { label: 'Orders', href: '/app/dsa/orders', icon: ShoppingBag },
    { label: 'Learn',  href: '/app/training',   icon: BookOpen },
    { label: 'Profile',href: '/app/settings',   icon: Settings },
  ],
  installer: [
    { label: 'Home',   href: '/app/installer',      icon: LayoutDashboard },
    { label: 'Jobs',   href: '/app/installer/jobs', icon: Target },
    { label: 'Learn',  href: '/app/training',       icon: BookOpen },
    { label: 'Profile',href: '/app/settings',       icon: Settings },
  ],
  reseller: [
    { label: 'Home',   href: '/app/reseller',        icon: LayoutDashboard },
    { label: 'Orders', href: '/app/reseller/orders', icon: ShoppingBag },
    { label: 'Learn',  href: '/app/training',        icon: BookOpen },
    { label: 'Profile',href: '/app/settings',        icon: Settings },
  ],
}

export function MobileNavBar() {
  const { role } = useAuthStore()
  const location = useLocation()
  const [showMore, setShowMore] = useState(false)
  const navItems = role ? MOBILE_NAV_ITEMS[role] : []

  if (!navItems.length) return null

  const isActive = (href: string) => {
    if (href === '/app/admin' || href === '/app/dsa' || href === '/app/installer' || href === '/app/reseller') {
      return location.pathname === href
    }
    return location.pathname.startsWith(href)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <AnimatePresence>
        {showMore && (role === 'admin' || role === 'super_admin') && (
          <>
            <motion.button type="button" aria-label="Close navigation menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-950/35" onClick={() => setShowMore(false)} />
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="absolute bottom-24 left-4 right-4 max-h-[65vh] overflow-y-auto rounded-2xl border border-surface-200 bg-white p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between px-2 py-1">
                <p className="font-bold text-surface-900">Admin pages</p>
                <button type="button" onClick={() => setShowMore(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100" aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NAV_ITEMS[role].map(item => {
                  const Icon = item.icon
                  return <NavLink key={item.href} to={item.href} onClick={() => setShowMore(false)} className={({ isActive }) => cn('flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold', isActive ? 'bg-brand-50 text-brand-700' : 'text-surface-700 hover:bg-surface-50')}><Icon className="h-5 w-5 shrink-0" />{item.label}</NavLink>
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div className="mx-4 mb-4">
        <div className="bg-white/90 backdrop-blur-xl border border-surface-200/60 shadow-lg rounded-3xl flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <NavLink 
                key={item.href} 
                to={item.href}
                className="flex-1"
              >
                <div className="flex flex-col items-center justify-center p-2 relative">
                  {active && (
                    <motion.div
                      layoutId="mobile-nav-pill"
                      className="absolute inset-0 bg-brand-50 rounded-2xl z-0"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={cn(
                    'w-6 h-6 mb-1 relative z-10 transition-colors',
                    active ? 'text-brand-600' : 'text-surface-400'
                  )} />
                  <span className={cn(
                    'text-[10px] font-semibold relative z-10 transition-colors',
                    active ? 'text-brand-700' : 'text-surface-500'
                  )}>
                    {item.label}
                  </span>
                </div>
              </NavLink>
            )
          })}
          {(role === 'admin' || role === 'super_admin') && (
            <button type="button" onClick={() => setShowMore(current => !current)} className="flex-1" aria-expanded={showMore} aria-label="Open all admin pages">
              <div className="relative flex flex-col items-center justify-center p-2">
                {showMore && <motion.div layoutId="mobile-more-pill" className="absolute inset-0 z-0 rounded-2xl bg-brand-50" />}
                <Menu className={cn('relative z-10 mb-1 h-6 w-6', showMore ? 'text-brand-600' : 'text-surface-400')} />
                <span className={cn('relative z-10 text-[10px] font-semibold', showMore ? 'text-brand-700' : 'text-surface-500')}>More</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
