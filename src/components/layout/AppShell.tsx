import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNavBar } from './MobileNavBar'
import { useUIStore } from '@/stores/uiStore'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { InstallPWA } from '@/components/pwa/InstallPWA'
import { NotificationPrompt } from '@/components/shared/NotificationPrompt'

export function AppShell() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <div className="flex h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f8fafc_44%,#eef7fb_100%)]">
      <InstallPWA />
      <NotificationPrompt />
      
      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <motion.div
        className="flex-1 flex flex-col overflow-hidden md:ml-[calc(var(--sidebar-width)+24px)] transition-all duration-300"
        style={{
          '--sidebar-width': sidebarCollapsed ? '72px' : '260px'
        } as any}
      >
        <Topbar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            className="p-4 pb-28 md:p-8 max-w-[1600px] mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </motion.div>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <MobileNavBar />
      </div>
    </div>
  )
}
