import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Mail, AlertCircle } from 'lucide-react'
import { requestPasswordResetEmail } from '@/lib/email'
import { AuthLayout, InputShell } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    try {
      await requestPasswordResetEmail(email)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={success ? 'Check your inbox' : 'Forgot password?'}
      subtitle={
        success
          ? 'We sent you a direct password reset link'
          : "Enter your email and we'll send you a reset link"
      }
    >
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-3 space-y-4"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 ring-4 ring-brand-500/10">
              <Mail className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900">Recovery Link Sent</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                We've sent a direct password reset link to <strong className="text-slate-800">{email}</strong>. Please open the newest email in your inbox or spam folder.
              </p>
            </div>

            <div className="pt-1 space-y-2">
              <Link
                to="/auth/login"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 font-bold text-xs text-white shadow-xs hover:bg-slate-800 transition-colors w-full"
              >
                Return to Sign In
              </Link>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
              >
                Didn't get it? Send again
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleReset}
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

            <InputShell label="Registered Email" icon={Mail}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="name@company.com"
                disabled={loading}
              />
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
                  <span>Sending reset link...</span>
                </div>
              ) : (
                <>
                  <span>Send Recovery Link</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>

            <div className="pt-2 text-center">
              <Link
                to="/auth/login"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
