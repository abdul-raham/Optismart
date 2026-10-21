import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  Video,
  Truck,
  TrendingUp,
  Radio,
  CheckCircle2,
  Lock,
  ChevronRight,
  Sparkles,
  Zap,
  Globe2
} from 'lucide-react'
import optismartLogo from '@/assets/optismart-logo.png'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
  activeTab?: 'login' | 'register'
}

const HIGHLIGHTS = [
  {
    id: 'hardware',
    badge: 'Smart Security Hub',
    title: 'Enterprise CCTV & Solar AI Cameras',
    desc: 'Multi-branch physical stock tracking, SD memory allocation, and real-time device health monitoring.',
    icon: Video,
    tag: 'Hardware & IoT',
    metrics: [
      { label: 'Active Coverage', val: '22+ States' },
      { label: 'Hardware Uptime', val: '99.98%' },
    ],
    card: {
      title: 'OptiSmart Dual-Lens 4K Solar',
      subtitle: 'Node #CAM-LAG-048 · Live Hub: Lagos HQ',
      status: 'Online · Streaming',
      badge: 'Dual PTZ + PIR',
      detail1: 'Battery: 99% (Solar Charge)',
      detail2: 'Storage: 128GB High-Endurance',
    }
  },
  {
    id: 'sales',
    badge: 'Automated Earnings',
    title: 'Seamless ₦5,000 DSA Commission Trigger',
    desc: 'Instant database calculation and crediting the exact moment an order is confirmed delivered.',
    icon: TrendingUp,
    tag: 'Agent Growth',
    metrics: [
      { label: 'DSA Payout Rate', val: '100% On Time' },
      { label: 'Per Camera', val: '₦5,000 Instant' },
    ],
    card: {
      title: 'Commission Auto-Credit',
      subtitle: 'Order #ORD-MVGQG0H3 · Delivered',
      status: 'Credited to Wallet',
      badge: '+₦5,000 Earned',
      detail1: 'Agent: Direct Sales Team',
      detail2: 'Live Rank: #1 on Global Leaderboard',
    }
  },
  {
    id: 'logistics',
    badge: 'Nationwide Logistics',
    title: 'End-to-End Waybill & Remittance Control',
    desc: 'Full dispatch visibility across 22 state courier hubs with real-time cash-on-delivery reconciliation.',
    icon: Truck,
    tag: 'Supply Chain',
    metrics: [
      { label: 'Courier Hubs', val: '22 Delivery Partners' },
      { label: 'Waybill Speed', val: '24-48h Delivery' },
    ],
    card: {
      title: 'Waybill Dispatch Pipeline',
      subtitle: 'Courier: Smile Logistics · Kaduna Branch',
      status: 'Dispatched · In Transit',
      badge: 'Waybill #WB-9482',
      detail1: 'Order Value: ₦139,800',
      detail2: 'Remittance Mode: Direct Pay-on-Delivery',
    }
  }
]

export function AuthLayout({ children, title, subtitle, activeTab }: AuthLayoutProps) {
  const [activeHighlight, setActiveHighlight] = useState(0)
  const location = useLocation()

  // Auto-rotate highlights every 7s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHighlight((prev) => (prev + 1) % HIGHLIGHTS.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  const current = HIGHLIGHTS[activeHighlight]
  const isLoginPage = activeTab === 'login' || location.pathname.includes('/login')
  const isRegisterPage = activeTab === 'register' || location.pathname.includes('/register')

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/70 via-slate-50 to-slate-100/80 flex overflow-x-hidden antialiased selection:bg-brand-500 selection:text-white">
      
      {/* ============================================================
          LEFT HERO: APPLE-STYLE HARDWARE & PLATFORM SHOWCASE (DESKTOP)
          ============================================================ */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white shadow-2xl">
        
        {/* Ambient atmospheric lighting orbs */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-500/20 blur-[130px]" />
        <div className="pointer-events-none absolute top-1/2 -right-32 h-[450px] w-[450px] rounded-full bg-cyan-400/15 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/15 blur-[130px]" />

        {/* Subtle geometric grid layer */}
        <div 
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ 
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)', 
            backgroundSize: '32px 32px' 
          }} 
        />

        {/* Top Header: Logo + Status Pill */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-3 transition-opacity">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur-md shadow-md group-hover:scale-105 transition-transform">
              <img src={optismartLogo} alt="OptiSmart" className="h-full w-auto object-contain filter drop-shadow" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white block leading-none">
                Opti<span className="text-brand-400">Smart</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Enterprise Operations
              </span>
            </div>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-semibold text-slate-300 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            System Operational · 2026.4
          </div>
        </div>

        {/* Middle: Dynamic Interactive Showcase */}
        <div className="relative z-10 my-auto py-8 max-w-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Category Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-bold text-brand-300 backdrop-blur-sm shadow-inner">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>{current.badge}</span>
                <span className="text-white/30">·</span>
                <span className="text-slate-300">{current.tag}</span>
              </div>

              {/* Title & Description */}
              <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-white leading-tight">
                {current.title}
              </h1>
              <p className="text-base font-normal text-slate-300/90 leading-relaxed max-w-lg">
                {current.desc}
              </p>

              {/* Floating Glassmorphic Hardware Card */}
              <div className="relative mt-8 pt-2">
                {/* Glow behind card */}
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500/20 to-cyan-500/20 blur-xl rounded-3xl" />
                
                <div className="relative rounded-3xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/10">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-lg shadow-brand-500/30">
                        <current.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base tracking-tight leading-snug">
                          {current.card.title}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          {current.card.subtitle}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {current.card.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 text-xs">
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Spec Detail</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block">{current.card.detail1}</span>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                      <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Status Node</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block">{current.card.detail2}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Metric Pills */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                {current.metrics.map((m, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">{m.label}</span>
                    <span className="text-lg font-black text-white">{m.val}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Carousel Navigation Bar */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex items-center gap-2">
            {HIGHLIGHTS.map((h, idx) => (
              <button
                key={h.id}
                onClick={() => setActiveHighlight(idx)}
                className={`group relative h-2.5 rounded-full transition-all duration-300 ${
                  activeHighlight === idx 
                    ? 'w-10 bg-gradient-to-r from-brand-400 to-cyan-400' 
                    : 'w-2.5 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Switch to ${h.title}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Lock className="h-3.5 w-3.5 text-brand-400" />
            <span>256-bit TLS Encrypted Session</span>
          </div>
        </div>
      </div>

      {/* ============================================================
          RIGHT SIDE: MODERN APPLE-INSPIRED AUTH CARD
          ============================================================ */}
      <div className="w-full lg:w-[48%] xl:w-[45%] flex flex-col justify-between p-4 sm:p-8 lg:p-12 xl:p-16 relative overflow-y-auto">
        
        {/* Mobile Header (Brand Logo) */}
        <div className="flex items-center justify-between lg:hidden pb-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 p-1.5 ring-1 ring-brand-500/20">
              <img src={optismartLogo} alt="OptiSmart" className="h-full w-auto object-contain" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">
              Opti<span className="text-brand-600">Smart</span>
            </span>
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-600 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
          </div>
        </div>

        {/* Center Auth Card Container */}
        <div className="my-auto mx-auto w-full max-w-[440px] py-4">
          
          {/* Fluid Segmented Pill: Sign In / Apply For Access */}
          {(isLoginPage || isRegisterPage) && (
            <div className="mb-6 rounded-2xl bg-slate-200/60 p-1.5 backdrop-blur-md border border-slate-300/40 shadow-inner flex relative">
              <Link
                to="/auth/login"
                className={`relative z-10 flex-1 py-2 text-center text-xs font-bold transition-colors ${
                  isLoginPage ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isLoginPage && (
                  <motion.div
                    layoutId="auth-pill"
                    className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-black/5"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Sign In</span>
              </Link>

              <Link
                to="/auth/register"
                className={`relative z-10 flex-1 py-2 text-center text-xs font-bold transition-colors ${
                  isRegisterPage ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isRegisterPage && (
                  <motion.div
                    layoutId="auth-pill"
                    className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-black/5"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Apply for Access</span>
              </Link>
            </div>
          )}

          {/* Card Glassmorphic Shell */}
          <div className="rounded-3xl border border-white/80 bg-white/80 p-6 sm:p-9 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] backdrop-blur-xl ring-1 ring-slate-900/[0.04]">
            
            {/* Header Titles */}
            <div className="text-left mb-6">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {title}
              </h2>
              <p className="mt-1.5 text-sm font-medium text-slate-500">
                {subtitle}
              </p>
            </div>

            {/* Form Content */}
            {children}
          </div>
        </div>

        {/* Card Footer: Security & Legal */}
        <div className="pt-6 text-center text-xs font-medium text-slate-400 space-y-2">
          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Enterprise Role Guard
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5 text-brand-600" /> Nigeria Operations
            </span>
          </div>
          <p className="text-[11px] text-slate-400/80">
            &copy; {new Date().getFullYear()} OptiSmart Enterprise. All rights reserved.
          </p>
        </div>

      </div>

    </div>
  )
}

/**
 * Enhanced Apple-grade Input Shell
 * - Tactile active focus glow
 * - High-contrast typography & icons
 * - Clean border transition
 */
export function InputShell({
  label,
  icon: Icon,
  hint,
  children
}: {
  label: string
  icon: React.ElementType
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block text-left group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          {label}
        </span>
        {hint && <span className="text-xs font-medium text-slate-500">{hint}</span>}
      </div>

      <div className="relative block overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/60 shadow-xs transition-all duration-200 group-hover:border-slate-300 group-hover:bg-white focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-500/15 focus-within:shadow-sm">
        <Icon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand-600 pointer-events-none" />
        {children}
      </div>
    </label>
  )
}
