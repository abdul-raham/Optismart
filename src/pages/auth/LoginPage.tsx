import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { AuthLayout, InputShell } from './AuthLayout'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    const { error: loginError } = await login(email.trim(), password)
    if (loginError) {
      setError(loginError)
    } else {
      navigate('/app')
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your OptiSmart account"
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex items-start gap-2.5 rounded-2xl border border-rose-200/90 bg-rose-50/80 p-3.5 text-xs font-semibold text-rose-700 shadow-xs"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <InputShell label="Email address" icon={Mail}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="email"
            className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
            placeholder="name@company.com"
            required
          />
        </InputShell>

        <InputShell
          label="Password"
          icon={Lock}
          hint={
            <Link
              to="/auth/forgot-password"
              className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
            >
              Forgot?
            </Link>
          }
        >
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
            className="h-12 w-full bg-transparent pl-12 pr-12 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
            placeholder="••••••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </InputShell>

        <motion.button
          whileHover={{ y: -1, boxShadow: '0 8px 24px -4px rgba(10, 116, 255, 0.4)' }}
          whileTap={{ scale: 0.985 }}
          type="submit"
          disabled={isLoading}
          className="relative mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 font-bold text-sm text-white shadow-brand transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden group cursor-pointer"
        >
          {/* Subtle reflection shine */}
          <span className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {isLoading ? (
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>Signing in...</span>
            </div>
          ) : (
            <>
              <span>Sign in to Dashboard</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </motion.button>

        <div className="pt-2 text-center">
          <p className="text-xs font-medium text-slate-500">
            Don't have access yet?{' '}
            <Link
              to="/auth/register"
              className="font-bold text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline"
            >
              Apply for a role
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
