import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import optismartLogo from '@/assets/optismart-logo.png'
import cameraImg from '../../../ChatGPT Image Jun 29, 2026, 11_03_39 AM.png'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left side: branding & image (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-50 border-r border-surface-200 flex-col">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-cyan-500/5 to-transparent backdrop-blur-[2px]" />
          <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: 'linear-gradient(rgba(10,116,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(10,116,255,.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>
        
        {/* Logo at Top */}
        <div className="relative z-10 p-8 xl:px-12 xl:pt-10 pb-0">
          <Link to="/">
            <img src={optismartLogo} alt="OptiSmart" className="h-10 w-auto hover:opacity-80 transition-opacity" />
          </Link>
        </div>

        
        {/* Shifted up content */}
        <div className="relative z-10 px-8 xl:px-12 pt-6 max-w-xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 text-xs font-bold text-brand-700 mb-6 shadow-sm">
              <ShieldCheck className="h-4 w-4" /> Secure Enterprise Portal
            </div>
            
            <h1 className="text-4xl font-black text-surface-900 tracking-tight leading-tight">
              Manage your <span className="text-brand-600">CCTV operations</span> with precision.
            </h1>

            {/* Camera with Blur/Focus Animation */}
            <motion.div 
              initial={{ filter: 'blur(20px)', opacity: 0, scale: 1.1 }}
              animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="my-8 relative"
            >
              <div className="absolute inset-0 bg-brand-500/10 blur-2xl rounded-full translate-y-4 translate-x-4" />
              <img src={cameraImg} alt="Camera product" className="w-full max-w-[200px] h-auto relative z-10 object-contain drop-shadow-xl" loading="eager" />
            </motion.div>

            <p className="text-lg font-medium text-surface-500 leading-relaxed">
              Join the ecosystem of dealers, installers, and resellers streamlining their security business.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right side: form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative overflow-y-auto">
        <div className="absolute top-0 right-0 p-4 sm:p-6 lg:hidden">
          <Link to="/">
            <img src={optismartLogo} alt="OptiSmart" className="h-6 sm:h-8 w-auto opacity-80 hover:opacity-100 transition-opacity" />
          </Link>
        </div>
        
        <div className="w-full max-w-[420px] space-y-6 sm:space-y-8 mt-8 sm:mt-12 lg:mt-24">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-black tracking-tight text-surface-900">{title}</h2>
            <p className="mt-2 text-sm font-medium text-surface-500">{subtitle}</p>
          </div>
          
          {children}
        </div>
      </div>
    </div>
  )
}

export function InputShell({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-surface-700">{label}</span>
      <span className="relative block overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm transition-all focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 hover:border-surface-300">
        <Icon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-400" />
        {children}
      </span>
    </label>
  )
}
