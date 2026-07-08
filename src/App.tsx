import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from './router'
import { useAuthStore } from './stores/authStore'
import { FullPageLoader } from './components/shared/FullPageLoader'
import { PWAReloadPrompt } from './components/shared/PWAReloadPrompt'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const [minDelayPassed, setMinDelayPassed] = useState(false)

  useEffect(() => {
    initialize()
    
    // Enforce a minimum 1.5 second loading screen delay
    const timer = setTimeout(() => {
      setMinDelayPassed(true)
    }, 1500)
    
    return () => clearTimeout(timer)
  }, [initialize])

  if (isInitializing || !minDelayPassed) return <FullPageLoader />

  return (
    <BrowserRouter>
      <AppRouter />
      <PWAReloadPrompt />
    </BrowserRouter>
  )
}
