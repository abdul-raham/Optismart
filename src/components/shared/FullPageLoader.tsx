import { motion, AnimatePresence } from 'framer-motion'

import optismartLogo from '@/assets/optismart-logo.png'

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-cyan-500/5 to-transparent backdrop-blur-[2px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-400/10 blur-[80px] rounded-full pointer-events-none" />
      </div>

      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 mb-8"
      >
        <img src={optismartLogo} alt="OptiSmart" className="h-12 sm:h-16 w-auto drop-shadow-xl" />
      </motion.div>
      
      <div className="relative z-10 flex flex-col items-center">
        <h2 className="text-lg font-bold text-surface-900 tracking-tight mb-4">Loading Portal</h2>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -8, 0], opacity: [0.2, 1, 0.2], scale: [1, 1.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
              className="w-2.5 h-2.5 rounded-full bg-brand-500 shadow-sm"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── CINEMATIC INTRO for the public website ──────────────────────────────────
export function SplashLoader({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050810] overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Animated grid */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      {/* Glow behind logo */}
      <motion.div
        className="absolute w-[500px] h-[500px] bg-brand-600/30 blur-[120px] rounded-full pointer-events-none"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* Logo SVG — drawing itself */}
      <motion.div
        className="relative z-10 w-28 h-28 sm:w-40 sm:h-40"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl">
          {/* BG square */}
          <motion.rect
            width="64" height="64" rx="18"
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          {/* Cyan chevron — slides in from top */}
          <motion.path
            d="M4 22 42 6v14H20v31H4V22Z"
            fill="#10aee5"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
          {/* First signal arc */}
          <motion.path
            d="M39 31c-11 3-19 12-19 24"
            fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.0, ease: 'easeInOut', delay: 0.7 }}
          />
          {/* Second signal arc */}
          <motion.path
            d="M47 39c-7 2-12 8-12 16"
            fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: 'easeInOut', delay: 1.0 }}
          />
          {/* Dot — pops in */}
          <motion.circle
            cx="49" cy="52" r="5" fill="white"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 1], opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.6 }}
          />
        </motion.svg>
      </motion.div>

      {/* Brand name */}
      <motion.div
        className="relative z-10 mt-8 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.2, ease: 'easeOut' }}
      >
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-[-0.03em]">
          Opti<span className="text-brand-400">Smart</span>
        </h1>
        <p className="text-sm text-white/30 font-semibold tracking-widest uppercase mt-1">Portal</p>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 h-[2px] rounded-full bg-white/10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
      >
        <motion.div
          className="h-full bg-brand-400 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.4, delay: 1.4, ease: 'easeInOut' }}
          onAnimationComplete={onDone}
        />
      </motion.div>
    </motion.div>
  )
}
