import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, Sliders, Clock, ShoppingBag, Calendar, BarChart3, ShieldCheck, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const CURRENT_RELEASE_VERSION = 'v2.0_aug_2026'

export function SystemUpdateModal() {
  const { user } = useAuthStore()
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

  if (!isOpen) return null

  const newFeatures = [
    {
      icon: Clock,
      color: 'text-amber-500 bg-amber-50 border-amber-200',
      title: 'DSA 7-Day Performance Clock & Inactivity Pipeline',
      description: 'Automated Day 4 warnings to agents, Day 5 underperformance alerts to admins, and Day 7 auto-suspension with direct deletion prompts & nullify options.'
    },
    {
      icon: ShieldCheck,
      color: 'text-emerald-500 bg-emerald-50 border-emerald-200',
      title: 'Monthly Probation Status Badges',
      description: 'DSAs with under 20 delivered orders per month are automatically flagged as "On Probation" across all dashboards & user lists until target is reached.'
    },
    {
      icon: Sliders,
      color: 'text-brand-500 bg-brand-50 border-brand-200',
      title: 'Dedicated User Profile Workspace',
      description: 'Clicking any user card opens a role-specific workspace (/app/admin/users/:userId) with custom targets, commission rate controls, and date-filtered historical reports.'
    },
    {
      icon: ShoppingBag,
      color: 'text-cyan-500 bg-cyan-50 border-cyan-200',
      title: 'Orders Page Sales Agent (DSA) Filter',
      description: 'Filter orders by specific registered Sales Agents (DSAs) or direct/unregistered orders directly in the Orders toolbar.'
    },
    {
      icon: Calendar,
      color: 'text-purple-500 bg-purple-50 border-purple-200',
      title: 'Custom Date Range Pickers on Reports',
      description: 'Reports page now features From Date and To Date custom range pickers alongside month filters for precise analytics.'
    },
    {
      icon: BarChart3,
      color: 'text-rose-500 bg-rose-50 border-rose-200',
      title: 'Expense Summary Category Breakdown',
      description: '4-card category summary tracking percentage breakdown for Ads, DSA Remittances, Delivery/Waybill, and Operational expenses.'
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
              <Sparkles className="w-4 h-4 text-amber-300" /> Platform Release Update V2.0
            </div>

            <h2 className="text-2xl font-bold tracking-tight">What's New in OptiSmart Portal</h2>
            <p className="text-xs text-white/80 mt-1 font-medium">
              We've deployed major performance tracking, probation automation, and analytics tools. Here's a breakdown of the new features:
            </p>
          </div>

          {/* Feature List */}
          <div className="p-6 overflow-y-auto space-y-4 divide-y divide-surface-100 flex-1">
            {newFeatures.map((feat, idx) => {
              const Icon = feat.icon
              return (
                <div key={idx} className="pt-4 first:pt-0 flex items-start gap-4">
                  <div className={`p-2.5 rounded-2xl border ${feat.color} shrink-0 mt-0.5`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                      {feat.title}
                    </h4>
                    <p className="text-xs text-surface-500 mt-1 leading-relaxed font-medium">
                      {feat.description}
                    </p>
                  </div>
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
