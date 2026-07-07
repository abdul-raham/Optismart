import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout, InputShell } from './AuthLayout'

export function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // If there's an error in the URL hash, display it
    const hashParams = new URLSearchParams(location.hash.substring(1))
    const errorDesc = hashParams.get('error_description')
    if (errorDesc) {
      setError(errorDesc.replace(/\+/g, ' '))
    }
  }, [location])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) throw updateError
      
      setSuccess(true)
      setTimeout(() => {
        navigate('/app/settings')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout 
      title="Create New Password" 
      subtitle="Please enter your new secure password"
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
            <h3 className="text-2xl font-black text-surface-900 mb-2">Password Updated!</h3>
            <p className="text-sm font-medium text-surface-500 leading-relaxed">
              Your password has been successfully reset. Redirecting you...
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleUpdate} 
            className="space-y-5"
          >
            {error && <div className="p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-xl text-sm font-bold">{error}</div>}

            <InputShell label="New Password" icon={Lock}>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400"
                placeholder="Minimum 6 characters"
                disabled={loading}
              />
            </InputShell>

            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="submit" disabled={loading} className="btn-primary w-full h-12 text-sm mt-4 shadow-brand transition">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Update Password'}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
