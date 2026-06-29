import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
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
      setError('Enter your email and password.')
      return
    }

    const { error: loginError } = await login(email, password)
    if (loginError) setError(loginError)
    else navigate('/app')
  }

  return (
    <AuthLayout title="Sign in" subtitle="Continue to OptiSmart Portal">
      <form onSubmit={handleLogin} className="space-y-5">
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 rounded-xl border border-danger-100 bg-danger-50 p-3 text-sm font-bold text-danger-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <InputShell label="Email" icon={Mail}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400" placeholder="name@example.com" />
        </InputShell>

        <InputShell label="Password" icon={Lock}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="h-12 w-full bg-transparent pl-12 pr-12 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400" placeholder="Password" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-600 transition-colors">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </InputShell>

        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-surface-400">Secure role-based access</span>
          <Link to="/auth/forgot-password" className="text-brand-600 underline-offset-4 hover:underline">Forgot password?</Link>
        </div>

        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="submit" disabled={isLoading} className="btn-primary h-12 w-full text-base mt-2 shadow-brand">
          {isLoading ? <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <span className="inline-flex items-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></span>}
        </motion.button>

        <p className="text-center text-sm font-semibold text-surface-500 pt-4">
          New to OptiSmart? <Link to="/auth/register" className="font-black text-brand-600 underline-offset-4 hover:underline">Apply now</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
