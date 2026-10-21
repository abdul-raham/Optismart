import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout, InputShell } from './AuthLayout'

export function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.substring(1))
    const errorDesc = hashParams.get('error_description')
    if (errorDesc) {
      setError(errorDesc.replace(/\+/g, ' '))
    }
  }, [location])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        navigate('/app')
      }, 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={success ? 'Password Updated!' : 'New Password'}
      subtitle={
        success
          ? 'Your new credentials have been safely saved'
          : 'Create a secure new password for your portal account'
      }
    >
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4 space-y-4"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900">Success!</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                Your password was reset successfully. Redirecting you to your portal dashboard...
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/app"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-6 font-bold text-xs text-white shadow-sm hover:bg-slate-800 transition-colors w-full"
              >
                Go to Portal Now
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleUpdate}
            className="space-y-4"
          >
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 rounded-2xl border border-rose-200/90 bg-rose-50/80 p-3.5 text-xs font-semibold text-rose-700 shadow-xs"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <InputShell label="New Password" icon={Lock}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="h-12 w-full bg-transparent pl-12 pr-12 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="At least 6 characters"
                disabled={loading}
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
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={loading}
              className="relative mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 font-bold text-sm text-white shadow-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Updating password...</span>
                </div>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
