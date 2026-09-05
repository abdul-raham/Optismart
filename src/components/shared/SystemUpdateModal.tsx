import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, Sliders, Clock, ShoppingBag, ShieldCheck, X, ArrowRight, Package, DollarSign, Award, Target, BookOpen, UserCheck, Banknote } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

const ICON_MAP: Record<string, any> = {
  Package,
  ShieldCheck,
  Clock,
  DollarSign,
  Sliders,
  ShoppingBag,
  Award,
  Target,
  BookOpen,
  UserCheck,
  Banknote,
}

const STATIC_RELEASE_VERSION = 'v4.5_sept_2026'

const ROLE_FEATURES: Record<string, Array<{ icon: any; color: string; title: string; description: string; route: string }>> = {
  dsa: [
    {
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      title: 'Automated ₦5,000 Commission Credit',
      description: 'Your ₦5,000 commission per camera is calculated & credited to your account automatically the instant an order is marked delivered!',
      route: '/app/dsa/commission'
    },
    {
      icon: Banknote,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      title: 'My Commissions Real-Time Dashboard',
      description: 'View total earnings, pending payout balances, and complete line-by-line commission records per order.',
      route: '/app/dsa/commission'
    },
    {
      icon: Award,
      color: 'text-amber-500 bg-amber-50 border-amber-200',
      title: 'Live Global DSA Sales Leaderboard',
      description: 'Track your global rank, delivered order count, and revenue performance live against other Sales Agents.',
      route: '/app/dsa/leaderboard'
    },
    {
      icon: Target,
      color: 'text-brand-600 bg-brand-50 border-brand-200',
      title: 'Streamlined Lead & Order Submissions',
      description: 'Capture prospective customers, schedule follow-up reminders, and log customer orders with instant email receipts.',
      route: '/app/dsa/leads'
    },
    {
      icon: BookOpen,
      color: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      title: 'ProNet Training & Certificate Catalog',
      description: 'Access video lessons, technical guides, ebooks, and earn your official OptiSmart Sales & Technical Certificate.',
      route: '/app/training'
    }
  ],

  admin: [
    {
      icon: UserCheck,
      color: 'text-brand-600 bg-brand-50 border-brand-200',
      title: 'Dual Admin + Personal DSA Sales Rights',
      description: 'Post orders and leads directly under your own name as a sales agent while maintaining full Admin administrative control & earning commissions.',
      route: '/app/admin/orders'
    },
    {
      icon: Sparkles,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      title: 'Targeted Interactive Account Upgrade Prompt',
      description: 'Promoted users receive an interactive login choice modal to consolidate duplicate accounts into 1 primary profile with zero data loss.',
      route: '/app/admin/users'
    },
    {
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      title: 'Fail-Safe Automated Commission Engine',
      description: 'Database-level trigger calculates and logs ₦5,000/camera commissions automatically whenever any order status changes to Delivered.',
      route: '/app/admin/commissions'
    },
    {
      icon: Package,
      color: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      title: 'Physical Inventory Count Override',
      description: 'Directly set exact shelf inventory counts per branch location with automated audit logging for stock accuracy.',
      route: '/app/admin/products'
    },
    {
      icon: ShieldCheck,
      color: 'text-rose-500 bg-rose-50 border-rose-200',
      title: 'Granular Admin Security Permissions',
      description: 'Custom security toggles for Manage Inventory, Manage Users, Manage Expenses, View Reports, and Delete Records per Admin.',
      route: '/app/admin/users'
    }
  ]
}

export function SystemUpdateModal() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [activeVersion, setActiveVersion] = useState(STATIC_RELEASE_VERSION)
  const [updateTitle, setUpdateTitle] = useState("What's New in OptiSmart Portal")
  const [updateSubtitle, setUpdateSubtitle] = useState("We've deployed new performance, automation, and tracking tools tailored for your role:")
  const [featuresList, setFeaturesList] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    checkForUpdates()
  }, [user])

  const checkForUpdates = async () => {
    if (!user) return

    const role = user.role || 'dsa'
    const isAdmin = role === 'admin' || role === 'super_admin'
    const roleFeatures = isAdmin ? ROLE_FEATURES.admin : (ROLE_FEATURES[role] || ROLE_FEATURES.dsa)

    try {
      // 1. Try to fetch the latest active release update from Supabase public.system_updates table
      const { data, error } = await supabase
        .from('system_updates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        const latestDbUpdate = data[0]
        const dbVersion = latestDbUpdate.version_tag
        const seenVersion = localStorage.getItem(`optismart_release_version_${user.id}`)

        if (seenVersion !== dbVersion) {
          setActiveVersion(dbVersion)
          if (latestDbUpdate.title) setUpdateTitle(latestDbUpdate.title)
          if (latestDbUpdate.subtitle) setUpdateSubtitle(latestDbUpdate.subtitle)

          if (Array.isArray(latestDbUpdate.features)) {
            const mapped = latestDbUpdate.features.map((f: any) => ({
              ...f,
              icon: ICON_MAP[f.icon] || Package
            }))
            setFeaturesList(mapped)
          } else {
            setFeaturesList(roleFeatures)
          }
          setIsOpen(true)
          return
        }
      }
    } catch (err) {
      console.warn('Could not query dynamic system_updates table, using role features fallback:', err)
    }

    // Fallback to role-tailored static features check
    const seenVersion = localStorage.getItem(`optismart_release_version_${user.id}`)
    if (seenVersion !== STATIC_RELEASE_VERSION) {
      setActiveVersion(STATIC_RELEASE_VERSION)
      setFeaturesList(roleFeatures)
      setIsOpen(true)
    }
  }

  const handleDismiss = () => {
    if (user?.id) {
      localStorage.setItem(`optismart_release_version_${user.id}`, activeVersion)
    }
    setIsOpen(false)
  }

  const handleNavigateToFeature = (route: string) => {
    handleDismiss()
    navigate(route)
  }

  if (!isOpen) return null

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
              <Sparkles className="w-4 h-4 text-amber-300" /> Release {activeVersion}
            </div>

            <h2 className="text-2xl font-bold tracking-tight">{updateTitle}</h2>
            <p className="text-xs text-white/80 mt-1 font-medium leading-relaxed">
              {updateSubtitle}
            </p>
          </div>

          {/* Feature List */}
          <div className="p-6 overflow-y-auto space-y-3 flex-1">
            {featuresList.map((feat, idx) => {
              const Icon = typeof feat.icon === 'function' ? feat.icon : (ICON_MAP[feat.icon] || Package)
              const defaultRoute = user?.role === 'dsa' ? '/app/dsa' : '/app/admin'
              return (
                <div
                  key={idx}
                  onClick={() => handleNavigateToFeature(feat.route || defaultRoute)}
                  className="p-3.5 rounded-2xl border border-surface-200/80 bg-white hover:bg-brand-50/40 hover:border-brand-300 transition-all cursor-pointer group flex items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl border ${feat.color || 'text-brand-600 bg-brand-50 border-brand-200'} shrink-0 mt-0.5`}>
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
            <span className="text-xs font-semibold text-surface-500">OptiSmart Portal • Role-Based Updates</span>
            <button
              onClick={handleDismiss}
              className="btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2 shadow-brand"
            >
              <CheckCircle2 className="w-4 h-4" /> Got it! Explore Features
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
