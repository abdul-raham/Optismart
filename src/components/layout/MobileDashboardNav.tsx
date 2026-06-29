import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { NAV_ITEMS } from './Sidebar'

export function MobileDashboardNav() {
  const { role } = useAuthStore()

  if (!role) return null

  // Get nav items, exclude Dashboard since we're already on it
  const navItems = NAV_ITEMS[role].filter(item => item.label !== 'Dashboard')

  return (
    <div className="mt-8 mb-6 md:hidden">
      <h2 className="text-lg font-bold text-surface-900 mb-4 px-1">Quick Access</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {navItems.map((item, i) => {
          const Icon = item.icon
          return (
            <Link key={item.href} to={item.href}>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.95 }}
                className="glass-card p-4 flex flex-col items-center justify-center text-center gap-2 hover:border-brand-300 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-surface-700">{item.label}</span>
              </motion.div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
