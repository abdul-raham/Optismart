import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, Sliders, Clock, ShoppingBag, Calendar, BarChart3, ShieldCheck, X, ArrowRight, Package, TrendingUp, DollarSign } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const CURRENT_RELEASE_VERSION = 'v3.1_aug_2026'

export function SystemUpdateModal() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    const isAdmin = user.role === 'admin' || user.role === 'super_admin'
    const seenVersion = localStorage.getItem('optismart_release_version')

    if (isAdmin && seenVersion !== CURRENT_RELEASE_VERSION) {
      setIsOpen(true)
    }
  }, [user])

  const handleDismiss = () => {
    localStorage.setItem('optismart_release_version', CURRENT_RELEASE_VERSION)
    setIsOpen(false)
  }

  const handleNavigateToFeature = (route: string) => {
    handleDismiss()
    navigate(route)
  }

  if (!isOpen) return null

  const newFeatures = [
    {
      icon: Package,
      color: 'text-brand-600 bg-brand-50 border-brand-200',
      title: '🏬 Multi-Branch Inventory & Stock Control',
      description: 'Track camera stock across multiple locations (Lagos HQ, Abuja Branch, PH Depot). Log Stock In, perform inter-branch Stock Transfers, and view stock movement audit logs.',
      route: '/app/admin/products'
    },
    {
      icon: ShieldCheck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      title: '🛡️ Dedicated Admin Probation Review Panel',
      description: 'Clean admin review card on DSA profiles for agents under the 20-order target. Confirm probation or waive targets with distinct, clear buttons.',
      route: '/app/admin/users?highlight=probation'
    },
    {
      icon: Clock,
      color: 'text-amber-500 bg-amber-50 border-amber-200',
      title: '⏳ Day 7 Eviction Action Prompt & Clock Pausing',
      description: 'Automated Day 7 safety suspension with an unmissable Eviction Action Banner for admins to either Reset Window or Delete Account. Suspended accounts are automatically excluded from clock countdowns.',
      route: '/app/admin/users?highlight=performance'
    },
    {
      icon: DollarSign,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      title: '📢 Ad Spend Allocation & Per-DSA Tracking',
      description: 'Assign specific Sales Agents (DSAs) to Advertising & Marketing expenses. View Total Ad Spend Allocation (₦) and Ad Spend Per Delivered Order on DSA profiles.',
      route: '/app/admin/expenses'
    },
    {
      icon: Sliders,
      color: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      title: '📱 Clean Products Toolbar & Mobile Responsiveness',
      description: 'Redesigned Products header with segmented tab bar, prominent search bar, and clean responsive toolbar across all admin pages.',
      route: '/app/admin/products'
    },
    {
      icon: ShoppingBag,
      color: 'text-rose-500 bg-rose-50 border-rose-200',
      title: '📦 Order Fulfillment Stock-Out Integration',
      description: 'Filter orders by Sales Agent. Marking orders DELIVERED automatically deducts camera inventory from selected branch locations.',
      route: '/app/admin/orders'
    }
  ]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl border border-surface-200 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-br from-brand-600 to-cyan-600 text-white relative">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-4 h-4 text-amber-300" /> Platform Release Update V3.0
            </div>

            <h2 className="text-2xl font-bold tracking-tight">What's New in OptiSmart Portal</h2>
            <p className="text-xs text-white/80 mt-1 font-medium">
              We've deployed major performance tracking, probation automation, and analytics tools. Here's a breakdown of the new features:
            </p>
          </div>

          {/* Feature List */}
          <div className="p-6 overflow-y-auto space-y-3 flex-1">
            {newFeatures.map((feat, idx) => {
              const Icon = feat.icon
              return (
                <div
                  key={idx}
                  onClick={() => handleNavigateToFeature(feat.route)}
                  className="p-3.5 rounded-2xl border border-surface-200/80 bg-white hover:bg-brand-50/40 hover:border-brand-300 transition-all cursor-pointer group flex items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl border ${feat.color} shrink-0 mt-0.5`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-surface-900 group-hover:text-brand-600 transition-colors flex items-center gap-1.5">
                        {feat.title}
                      </h4>
                      <p className="text-xs text-surface-500 mt-0.5 leading-relaxed font-medium">
                        {feat.description}
                      </p>
                    </div>
                  </div>

                  <button className="text-xs font-bold text-brand-600 bg-brand-50 group-hover:bg-brand-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-brand-200 transition-all shrink-0 flex items-center gap-1">
                    Try <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-surface-100 bg-surface-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500">OptiSmart Portal • System Update</span>
            <button
              onClick={handleDismiss}
              className="btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2 shadow-brand"
            >
              <CheckCircle2 className="w-4 h-4" /> Got it! Explore New Features
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
