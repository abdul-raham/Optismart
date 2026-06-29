import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout/AppShell'
import type { UserRole } from '@/types'

// Public
import { LandingPage } from '@/pages/public/LandingPage'

// Auth pages
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'

// Shared / loading
import { FullPageLoader } from '@/components/shared/FullPageLoader'

// Admin pages
import { AdminDashboard } from '@/pages/admin/Dashboard'
import { AdminOrders } from '@/pages/admin/Orders'
import { AdminProducts } from '@/pages/admin/Products'
import { AdminPayments } from '@/pages/admin/Payments'
import { AdminUsers } from '@/pages/admin/Users'
import { AdminExpenses } from '@/pages/admin/Expenses'
import { AdminInstallers } from '@/pages/admin/Installers'
import { AdminAnalytics } from '@/pages/admin/Analytics'

// DSA pages
import { DSADashboard } from '@/pages/dsa/Dashboard'
import { DSALeads } from '@/pages/dsa/Leads'
import { DSAOrders } from '@/pages/dsa/Orders'
import { DSAInstallerBooking } from '@/pages/dsa/InstallerBooking'
import { DSACommissions } from '@/pages/dsa/Commissions'
import { DSAReminders } from '@/pages/dsa/Reminders'

// Installer pages
import { InstallerDashboard } from '@/pages/installer/Dashboard'
import { InstallerJobs } from '@/pages/installer/Jobs'
import { InstallerSchedule } from '@/pages/installer/Schedule'

// Reseller pages
import { ResellerDashboard } from '@/pages/reseller/Dashboard'
import { ResellerOrders } from '@/pages/reseller/Orders'

// ProNet pages
import { ProNetDashboard } from '@/pages/pronet/Dashboard'
import { ProNetLessons } from '@/pages/pronet/Lessons'
import { ProNetQuiz } from '@/pages/pronet/Quiz'
import { ProNetEbooks } from '@/pages/pronet/Ebooks'
import { ProNetCertificate } from '@/pages/pronet/Certificate'
import { ProductCatalog } from '@/pages/products/ProductCatalog'

// Settings
import { SettingsPage } from '@/pages/settings/Settings'

// ---- GUARDS ----

function RequireAuth({ roles }: { roles?: UserRole[] }) {
  const { isAuthenticated, isLoading, role } = useAuthStore()

  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  if (roles && role && !roles.includes(role)) return <Navigate to="/app" replace />

  return <Outlet />
}

function RedirectByRole() {
  const { role, isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />

  const destinations: Record<UserRole, string> = {
    super_admin: '/app/admin',
    admin:       '/app/admin',
    dsa:         '/app/dsa',
    installer:   '/app/installer',
    reseller:    '/app/reseller',
  }
  return <Navigate to={destinations[role!] ?? '/app/admin'} replace />
}

function RedirectToRoleSection({ section }: { section: 'dashboard' | 'leads' | 'orders' | 'installers' | 'products' | 'analytics' }) {
  const { role, isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />

  const paths: Record<UserRole, Partial<Record<typeof section, string>>> = {
    super_admin: {
      dashboard: '/app/admin',
      orders: '/app/admin/orders',
      installers: '/app/admin/installers',
      products: '/app/admin/products',
      analytics: '/app/admin/analytics',
    },
    admin: {
      dashboard: '/app/admin',
      orders: '/app/admin/orders',
      installers: '/app/admin/installers',
      products: '/app/admin/products',
      analytics: '/app/admin/analytics',
    },
    dsa: {
      dashboard: '/app/dsa',
      leads: '/app/dsa/leads',
      orders: '/app/dsa/orders',
      installers: '/app/dsa/installers',
    },
    installer: {
      dashboard: '/app/installer',
      orders: '/app/installer/jobs',
      installers: '/app/installer/jobs',
    },
    reseller: {
      dashboard: '/app/reseller',
      orders: '/app/reseller/orders',
      products: '/app/reseller',
    },
  }

  return <Navigate to={paths[role!]?.[section] ?? '/app'} replace />
}

// ---- ROUTER ----

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/auth/login"           element={<LoginPage />} />
      <Route path="/auth/register"        element={<RegisterPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* App root redirect */}
      <Route path="/app" element={<RedirectByRole />} />
      <Route path="/app/dashboard" element={<RedirectToRoleSection section="dashboard" />} />
      <Route path="/app/leads" element={<RedirectToRoleSection section="leads" />} />
      <Route path="/app/orders" element={<RedirectToRoleSection section="orders" />} />
      <Route path="/app/installers" element={<RedirectToRoleSection section="installers" />} />
      <Route path="/app/analytics" element={<RedirectToRoleSection section="analytics" />} />

      {/* Protected — all inside AppShell */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>

          {/* Admin + Super Admin */}
          <Route element={<RequireAuth roles={['admin', 'super_admin']} />}>
            <Route path="/app/admin"            element={<AdminDashboard />} />
            <Route path="/app/admin/orders"     element={<AdminOrders />} />
            <Route path="/app/admin/products"   element={<AdminProducts />} />
            <Route path="/app/admin/payments"   element={<AdminPayments />} />
            <Route path="/app/admin/users"      element={<AdminUsers />} />
            <Route path="/app/admin/expenses"   element={<AdminExpenses />} />
            <Route path="/app/admin/installers" element={<AdminInstallers />} />
            <Route path="/app/admin/analytics"  element={<AdminAnalytics />} />
          </Route>

          {/* DSA */}
          <Route element={<RequireAuth roles={['dsa']} />}>
            <Route path="/app/dsa"            element={<DSADashboard />} />
            <Route path="/app/dsa/leads"      element={<DSALeads />} />
            <Route path="/app/dsa/orders"     element={<DSAOrders />} />
            <Route path="/app/dsa/installers" element={<DSAInstallerBooking />} />
            <Route path="/app/dsa/commission" element={<DSACommissions />} />
            <Route path="/app/dsa/reminders"  element={<DSAReminders />} />
          </Route>

          {/* Installer */}
          <Route element={<RequireAuth roles={['installer']} />}>
            <Route path="/app/installer"          element={<InstallerDashboard />} />
            <Route path="/app/installer/jobs"     element={<InstallerJobs />} />
            <Route path="/app/installer/schedule" element={<InstallerSchedule />} />
          </Route>

          {/* Reseller */}
          <Route element={<RequireAuth roles={['reseller']} />}>
            <Route path="/app/reseller"        element={<ResellerDashboard />} />
            <Route path="/app/reseller/orders" element={<ResellerOrders />} />
          </Route>

          {/* ProNet — accessible to all roles */}
          <Route path="/app/products"             element={<ProductCatalog />} />
          <Route path="/app/training"             element={<ProNetDashboard />} />
          <Route path="/app/training/lessons"     element={<ProNetLessons />} />
          <Route path="/app/training/quiz"        element={<ProNetQuiz />} />
          <Route path="/app/training/ebooks"      element={<ProNetEbooks />} />
          <Route path="/app/training/certificate" element={<ProNetCertificate />} />

          {/* Settings — all roles */}
          <Route path="/app/settings" element={<SettingsPage />} />

        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
