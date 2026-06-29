import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Target, ShoppingBag, Users, Package,
  CreditCard, Receipt, TrendingUp, Wrench, BookOpen,
  FileText, Award, Settings, ChevronLeft, ChevronRight,
  CalendarDays, DollarSign, BarChart3, UserCheck,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { cn, getInitials } from '@/lib/utils'
import type { UserRole } from '@/types'
import optismartLogo from '@/assets/optismart-logo.png'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard',  href: '/app/admin',            icon: LayoutDashboard },
    { label: 'Orders',     href: '/app/admin/orders',     icon: ShoppingBag },
    { label: 'Products',   href: '/app/admin/products',   icon: Package },
    { label: 'Payments',   href: '/app/admin/payments',   icon: CreditCard },
    { label: 'Expenses',   href: '/app/admin/expenses',   icon: Receipt },
    { label: 'Users',      href: '/app/admin/users',      icon: Users },
    { label: 'Installers', href: '/app/admin/installers', icon: Wrench },
    { label: 'Analytics',  href: '/app/admin/analytics',  icon: BarChart3 },
    { label: 'Training',   href: '/app/admin/training',   icon: BookOpen },
    { label: 'Settings',   href: '/app/settings',         icon: Settings },
  ],
  admin: [
    { label: 'Dashboard',  href: '/app/admin',            icon: LayoutDashboard },
    { label: 'Orders',     href: '/app/admin/orders',     icon: ShoppingBag },
    { label: 'Products',   href: '/app/admin/products',   icon: Package },
    { label: 'Payments',   href: '/app/admin/payments',   icon: CreditCard },
    { label: 'Expenses',   href: '/app/admin/expenses',   icon: Receipt },
    { label: 'Users',      href: '/app/admin/users',      icon: Users },
    { label: 'Installers', href: '/app/admin/installers', icon: Wrench },
    { label: 'Analytics',  href: '/app/admin/analytics',  icon: BarChart3 },
    { label: 'Training',   href: '/app/admin/training',   icon: BookOpen },
    { label: 'Settings',   href: '/app/settings',         icon: Settings },
  ],
  dsa: [
    { label: 'Dashboard',  href: '/app/dsa',             icon: LayoutDashboard },
    { label: 'Leads',      href: '/app/dsa/leads',       icon: Target },
    { label: 'Orders',     href: '/app/dsa/orders',      icon: ShoppingBag },
    { label: 'Products',   href: '/app/products',        icon: Package },
    { label: 'Installers', href: '/app/dsa/installers',  icon: UserCheck },
    { label: 'Commission', href: '/app/dsa/commission',  icon: DollarSign },
    { label: 'Reminders',  href: '/app/dsa/reminders',   icon: CalendarDays },
    { label: 'Training',   href: '/app/training',        icon: BookOpen },
    { label: 'Settings',   href: '/app/settings',        icon: Settings },
  ],
  installer: [
    { label: 'Dashboard', href: '/app/installer',          icon: LayoutDashboard },
    { label: 'My Jobs',   href: '/app/installer/jobs',     icon: Wrench },
    { label: 'Products',  href: '/app/products',           icon: Package },
    { label: 'Schedule',  href: '/app/installer/schedule', icon: CalendarDays },
    { label: 'Training',  href: '/app/training',           icon: BookOpen },
    { label: 'Settings',  href: '/app/settings',           icon: Settings },
  ],
  reseller: [
    { label: 'Dashboard', href: '/app/reseller',        icon: LayoutDashboard },
    { label: 'Products',  href: '/app/products',        icon: Package },
    { label: 'Orders',    href: '/app/reseller/orders', icon: ShoppingBag },
    { label: 'Training',  href: '/app/training',        icon: BookOpen },
    { label: 'Settings',  href: '/app/settings',        icon: Settings },
  ],
}

const ROLE_META: Record<UserRole, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin',   color: 'from-purple-600 to-violet-500' },
  admin:       { label: 'Admin',         color: 'from-blue-600 to-cyan-500' },
  dsa:         { label: 'Sales Agent',   color: 'from-orange-500 to-amber-400' },
  installer:   { label: 'Installer',     color: 'from-green-600 to-emerald-400' },
  reseller:    { label: 'Reseller',      color: 'from-rose-500 to-pink-400' },
}

export function Sidebar() {
  const { user, role } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const location = useLocation()
  const navItems = role ? NAV_ITEMS[role] : []
  const meta = role ? ROLE_META[role] : null

  const W = sidebarCollapsed ? 72 : 260

  const isActive = (href: string) => {
    if (href === '/app/admin' || href === '/app/dsa' || href === '/app/installer' || href === '/app/reseller') {
      return location.pathname === href
    }
    return location.pathname.startsWith(href)
  }

  return (
    <motion.aside
      animate={{ width: W }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-3 top-3 bottom-3 h-[calc(100%-24px)] z-30 flex flex-col overflow-hidden rounded-[24px]"
      style={{
        width: W,
        backdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(226,232,240,0.9)',
        boxShadow: '0 20px 60px -28px rgba(15,23,42,0.28)',
      }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-surface-100/80 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-surface-100 overflow-hidden">
            <img src="/fav.png" alt="OptiSmart" className="w-8 h-8 object-contain" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <img src={optismartLogo} alt="OptiSmart" className="h-8 w-auto object-contain" />
                <p className="text-[10px] text-surface-400 font-semibold tracking-widest uppercase whitespace-nowrap">Portal</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Role badge */}
      <AnimatePresence>
        {!sidebarCollapsed && meta && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2.5 border-b border-surface-100/80"
          >
            <span className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-white',
              `bg-gradient-to-r ${meta.color}`
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
              {meta.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto scrollbar-hidden">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <NavLink key={item.href} to={item.href}>
              <motion.div
                whileHover={{ x: sidebarCollapsed ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'sidebar-link relative',
                  active && 'active',
                  sidebarCollapsed && 'justify-center px-0 py-2.5'
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-brand-50 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon className={cn(
                  'w-[18px] h-[18px] flex-shrink-0 relative z-10',
                  active ? 'text-brand-600' : 'text-surface-400'
                )} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm relative z-10 whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {active && !sidebarCollapsed && (
                  <motion.div
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0 relative z-10"
                    layoutId="sidebar-dot"
                  />
                )}
              </motion.div>
            </NavLink>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-surface-100/80 p-3">
        <div className={cn('flex items-center gap-3 px-1 py-1.5 rounded-xl hover:bg-surface-100 cursor-pointer transition-colors', sidebarCollapsed && 'justify-center')}>
          <div className={cn(
            'w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold',
            `bg-gradient-to-br ${meta?.color ?? 'from-blue-500 to-cyan-400'}`
          )}>
            {getInitials(user?.full_name ?? 'U')}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden flex-1 min-w-0"
              >
                <p className="text-sm font-semibold text-surface-800 truncate">{user?.full_name ?? 'User'}</p>
                <p className="text-[11px] text-surface-400 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-white border border-surface-200
                   flex items-center justify-center text-surface-400 hover:text-brand-600
                   hover:border-brand-300 shadow-sm transition-all z-40"
      >
        {sidebarCollapsed
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <ChevronLeft className="w-3.5 h-3.5" />
        }
      </button>
    </motion.aside>
  )
}
