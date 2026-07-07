import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X } from 'lucide-react'

export function NotificationPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only show if the browser supports notifications and permission has not been asked yet
    if ('Notification' in window && Notification.permission === 'default') {
      // Small delay so it doesn't pop up instantly on app load
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleEnable = async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        // You could also trigger the service worker registration here if not already done
        console.log('Notifications enabled!')
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error)
    } finally {
      setShow(false)
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-12 sm:items-center">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" 
            onClick={() => setShow(false)} 
          />
          
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <button onClick={() => setShow(false)} className="absolute top-4 right-4 p-2 text-surface-400 hover:bg-surface-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                <Bell className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-bold text-surface-900 mb-2">Turn on Notifications?</h3>
              <p className="text-sm text-surface-500 mb-6">
                Would you like to receive instant notifications when your orders are updated or delivered?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleEnable} 
                  className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-brand transition-colors"
                >
                  Yes, enable notifications
                </button>
                <button 
                  onClick={() => setShow(false)} 
                  className="w-full py-3.5 rounded-xl bg-surface-50 text-surface-600 font-bold hover:bg-surface-100 transition-colors"
                >
                  Not right now
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
