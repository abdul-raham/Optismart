import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ArrowLeft, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout, InputShell } from './AuthLayout'

type LinkState = 'checking' | 'valid' | 'invalid'

export function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [linkState, setLinkState] = useState<LinkState>('checking')
  const navigate = useNavigate()

  // Verify the recovery link produced a session before showing the form
  useEffect(() => {
    let settled = false
    const settle = (state: LinkState, message?: string) => {
      if (settled) return
      settled = true
      setLinkState(state)
      if (message) setError(message)
    }

    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const queryParams = new URLSearchParams(window.location.search)
    const errorDesc = hashParams.get('error_description') || queryParams.get('error_description')
    if (errorDesc) {
      settle('invalid', errorDesc.replace(/\+/g, ' '))
      return
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) settle('valid')
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) settle('valid')
    })

    // Give the client time to exchange the URL tokens before declaring the link invalid
    const timer = setTimeout(() => settle('invalid', 'This reset link is invalid or has expired.'), 4000)

    return () => {
      clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
  }, [])

  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a number', ok: /\d/.test(password) },
    { label: 'Passwords match', ok: password.length > 0 && password === confirm },
  ]

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => navigate('/app'), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const title = success ? 'Password updated' : linkState === 'invalid' ? 'Link expired' : 'Set new password'
  const subtitle = success
    ? 'Your new password has been saved'
    : linkState === 'invalid'
      ? 'Request a fresh reset link to continue'
      : 'Choose a strong password for your account'

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-2 space-y-4"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-4 ring-emerald-500/10">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
              Your password was reset successfully. Redirecting you to your dashboard...
            </p>
            <Link
              to="/app"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 font-bold text-xs text-white hover:bg-slate-800 transition-colors w-full"
            >
              Go to Dashboard
            </Link>
          </motion.div>
        ) : linkState === 'checking' ? (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-6 text-xs font-semibold text-slate-500"
          >
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
            Verifying your reset link...
          </motion.div>
        ) : linkState === 'invalid' ? (
          <motion.div
            key="invalid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                {error || 'This reset link is invalid or has expired.'} Reset links can only be used once and expire after a short time.
              </div>
            </div>
            <Link
              to="/auth/forgot-password"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 font-bold text-sm text-white shadow-brand"
            >
              Request a new link <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="text-center">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
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
                  className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700"
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
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full bg-transparent pl-12 pr-12 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="At least 8 characters"
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

            <InputShell label="Confirm Password" icon={Lock}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="Re-enter password"
                disabled={loading}
              />
            </InputShell>

            <ul className="grid gap-1 text-[11px] font-semibold">
              {checks.map((c) => (
                <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Check className="h-3.5 w-3.5" /> {c.label}
                </li>
              ))}
            </ul>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={loading}
              className="relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 font-bold text-sm text-white shadow-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Saving...</span>
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
