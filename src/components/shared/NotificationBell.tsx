import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { motion } from 'framer-motion'

// Add your VAPID public key here once generated on your backend
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY' 

export function NotificationBell() {
  const { unreadCount, subscribeToWebPush } = useNotifications()
  const [isSubscribing, setIsSubscribing] = useState(false)

  const handleSubscribe = async () => {
    setIsSubscribing(true)
    const success = await subscribeToWebPush(VAPID_PUBLIC_KEY)
    if (success) {
      alert("Push notifications enabled successfully!")
    } else {
      alert("Please allow notifications in your browser settings.")
    }
    setIsSubscribing(false)
  }

  return (
    <button 
      onClick={handleSubscribe}
      disabled={isSubscribing}
      className="relative p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex-shrink-0"
      title="Enable Push Notifications"
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white"
        />
      )}
    </button>
  )
}
