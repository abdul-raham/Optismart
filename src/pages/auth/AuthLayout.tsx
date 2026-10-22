import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Lock } from 'lucide-react'
import optismartLogo from '@/assets/optismart-logo.png'
import authBg from '@/assets/auth-bg.webp'

// 32px blurred preview (~180 bytes) shown instantly while the full background loads
const AUTH_BG_PLACEHOLDER =
  'data:image/webp;base64,UklGRq4AAABXRUJQVlA4IKIAAAAwBQCdASogABUAPu1krU+ppSQiMBgIATAdiWkAEgAEaA9zZuWG8VKdJAzjluaex2w1wAD9/ztJn3RdxoWEM8Jgp16cPEXxHCfuVW5eZ2z5gbQnlNCOWMatfHN+3LhNpZMcpFTG+pQ84sbDwXpxogP67ZqIOoNvf57gZh2JJlq85jh8I0E9C67dpS2vV9ZXYW3OPvmVlRw5Ou5aAb4EgvSAAAA='

// Start fetching the background as soon as this module is evaluated
if (typeof window !== 'undefined') {
  const preload = new Image()
  preload.src = authBg
}

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const [bgLoaded, setBgLoaded] = useState(false)

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden flex items-center justify-center p-4 sm:p-6 bg-slate-950 select-none">
      
      {/* ============================================================
          FULL-SCREEN BACKGROUND IMAGE WITH CINEMATIC VIGNETTE
          ============================================================ */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Instant blurred placeholder */}
        <img
          src={AUTH_BG_PLACEHOLDER}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center scale-110 blur-xl filter brightness-[0.4]"
        />
        <img
          src={authBg}
          alt="OptiSmart Surveillance"
          decoding="async"
          fetchPriority="high"
          onLoad={() => setBgLoaded(true)}
          className={`relative w-full h-full object-cover object-center scale-105 filter brightness-[0.4] contrast-[1.1] transition-opacity duration-500 ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Soft vignette overlays to ensure depth and contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/75" />
        <div className="absolute inset-0 bg-brand-950/20 backdrop-blur-[2px]" />
      </div>

      {/* ============================================================
          CENTER FLOATING CARD (FITS 100% IN VIEWPORT, NO WINDOW SCROLL)
          ============================================================ */}
      <div className="relative z-10 w-full max-w-[420px] max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl border border-white/25 bg-white/95 sm:bg-white/90 p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-2xl ring-1 ring-black/5 animate-fade-up">
        
        {/* Top Logo & Headings */}
        <div className="text-center mb-5 shrink-0">
          <Link to="/" className="inline-block hover:opacity-85 transition-opacity">
            <img
              src={optismartLogo}
              alt="OptiSmart"
              className="h-9 w-auto mx-auto object-contain filter drop-shadow-xs"
            />
          </Link>
          <h1 className="mt-3.5 text-2xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
            {title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
            {subtitle}
          </p>
        </div>

        {/* Scrollable form area only if screen height is very small */}
        <div className="overflow-y-auto pr-0.5 -mr-0.5 custom-scrollbar">
          {children}
        </div>

        {/* Card Footer: Security Badge */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Enterprise Role Guard</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Lock className="h-3 w-3" />
            <span>256-bit Encrypted</span>
          </div>
        </div>

      </div>

    </div>
  )
}

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
    <label className="block text-left">
      <div className="flex items-center justify-between mb-1.5">
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          {label}
        </span>
        {hint && <span className="text-xs font-medium text-slate-500">{hint}</span>}
      </div>
      <div className="relative block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all duration-150 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 hover:border-slate-300">
        <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        {children}
      </div>
    </label>
  )
}
