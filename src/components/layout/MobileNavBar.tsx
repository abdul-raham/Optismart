import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Target, ShoppingBag, UserCheck, Settings, BookOpen } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

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
    { label: 'Profile',href: '/app/settings',        icon: Settings },
  ],
}

export function MobileNavBar() {
  const { role } = useAuthStore()
  const location = useLocation()
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
        </div>
      </div>
    </div>
  )
}
