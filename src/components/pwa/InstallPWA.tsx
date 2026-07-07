import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIosDevice)

    // Detect if already installed/standalone
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    setIsStandalone(standalone)

    // Check if user dismissed previously
    if (localStorage.getItem('pwa-prompt-dismissed') === 'true') {
      setIsDismissed(true)
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    if ((window as any).deferredPWAEvent) {
      setDeferredPrompt((window as any).deferredPWAEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', () => {
      setIsStandalone(true)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  // Hide if already installed, dismissed, or no prompt available (except iOS which doesn't fire the event)
  if (isStandalone || isDismissed) return null
  if (!deferredPrompt && !isIOS) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-28 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 z-[100] bg-white/90 backdrop-blur-xl border border-surface-200 shadow-2xl rounded-2xl p-4"
      >
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-surface-400 hover:text-surface-600 transition-colors bg-surface-50 hover:bg-surface-100 rounded-full p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-surface-100 flex items-center justify-center shrink-0">
            <img src="/fav.png" alt="OptiSmart" className="w-8 h-8 object-contain" />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-sm font-bold text-surface-900 mb-1">Install OptiSmart Portal</h3>
            <p className="text-xs text-surface-500 mb-3 leading-relaxed">
              Install our app on your device for quick access, offline mode, and push notifications.
            </p>
            
            {isIOS && !deferredPrompt ? (
              <p className="text-[11px] font-medium text-surface-600 bg-surface-50 p-2 rounded-lg border border-surface-100">
                To install, tap the <strong className="text-brand-600">Share</strong> button at the bottom of Safari, then select <strong className="text-brand-600">"Add to Home Screen"</strong>.
              </p>
            ) : (
              <button 
                onClick={handleInstallClick}
                className="w-full btn-primary text-xs py-2 shadow-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Install App
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
