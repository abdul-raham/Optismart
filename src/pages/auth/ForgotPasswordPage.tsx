import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout, InputShell } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })

      if (resetError) throw resetError
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout 
      title="Reset Password" 
      subtitle="Enter your email to get a reset link"
    >
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="w-16 h-16 rounded-full bg-success-50 ring-4 ring-success-50/50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-success-600" />
            </div>
            <h3 className="text-2xl font-black text-surface-900 mb-2">Check your email</h3>
            <p className="text-sm font-medium text-surface-500 leading-relaxed">
              We've sent a password reset link to <span className="font-bold text-surface-900">{email}</span>
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleReset} 
            className="space-y-5"
          >
            {error && <div className="p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-xl text-sm font-bold">{error}</div>}

            <InputShell label="Email address" icon={Mail}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400"
                placeholder="name@example.com"
                disabled={loading}
              />
            </InputShell>

            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="submit" disabled={loading} className="btn-primary w-full h-12 text-sm mt-4 shadow-brand transition">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Send Reset Link'}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="pt-4 text-center">
        <Link to="/auth/login" className="inline-flex items-center justify-center gap-1 text-sm font-black text-surface-500 hover:text-brand-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>
    </AuthLayout>
  )
}
