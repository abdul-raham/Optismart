// @ts-ignore
import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'

export function PWAReloadPrompt() {
  // `needRefresh` is true when a new service worker is waiting to be installed
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: any) {
      // If we want to poll for updates occasionally:
      // r && setInterval(() => r.update(), 60 * 60 * 1000) 
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setNeedRefresh(false)
  }

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-surface-900 text-white rounded-2xl shadow-2xl p-5 border border-surface-800"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <RefreshCw className="w-5 h-5 text-brand-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">New Update Available</h3>
              <p className="text-sm text-surface-400 mb-4 leading-relaxed">
                A new version of the OptiSmart portal has been pushed. Click reload to apply the latest features and bug fixes.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    updateServiceWorker(true)
                    window.location.reload()
                  }}
                  className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-bold py-2 px-4 rounded-xl transition-colors text-sm"
                >
                  Reload Now
                </button>
                <button
                  onClick={close}
                  className="px-4 py-2 rounded-xl text-surface-400 hover:text-white hover:bg-surface-800 transition-colors text-sm font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
