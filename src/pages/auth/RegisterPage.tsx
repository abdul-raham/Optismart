import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, Package, Phone, Target, User, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout, InputShell } from './AuthLayout'

type RegistrationStep = 'role' | 'details' | 'success'
type JoinRole = 'dsa' | 'installer' | 'reseller'

const roles: { id: JoinRole; title: string; desc: string; icon: React.ElementType }[] = [
  { id: 'dsa', title: 'Sales Agent', desc: 'Leads, orders, commission.', icon: Target },
  { id: 'installer', title: 'Installer', desc: 'Field jobs and schedules.', icon: Wrench },
  { id: 'reseller', title: 'Reseller', desc: 'Bulk orders and pricing.', icon: Package },
]

export function RegisterPage() {
  const [step, setStep] = useState<RegistrationStep>('role')
  const [role, setRole] = useState<JoinRole | ''>('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName, phone: form.phone, role } },
      })

      if (signUpError) {
        if (signUpError.status === 429 || signUpError.message?.toLowerCase().includes('rate limit')) {
          throw new Error('Too many sign-up attempts. Please wait a few minutes before trying again, or contact your admin to be added manually.')
        }
        if (signUpError.message?.toLowerCase().includes('email')) {
          throw new Error('There was an issue with this email address. Please use a different one or contact support.')
        }
        throw signUpError
      }
      setStep('success')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Apply" subtitle="Request role-based portal access">
      <AnimatePresence mode="wait">
        {step === 'role' && (
          <motion.div key="role" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-4">
            <div className="grid gap-3">
              {roles.map((item) => {
                const Icon = item.icon
                const selected = role === item.id
                return (
                  <button key={item.id} onClick={() => setRole(item.id)} type="button" className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${selected ? 'border-brand-400 bg-brand-50 shadow-sm ring-1 ring-brand-400/50' : 'border-surface-200 bg-white hover:border-brand-200 hover:bg-surface-50'}`}>
                    <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-white text-brand-600 shadow-sm' : 'bg-surface-100 text-surface-500'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-surface-900">{item.title}</span>
                      <span className="block text-xs font-medium text-surface-500">{item.desc}</span>
                    </span>
                    {selected && <CheckCircle2 className="h-5 w-5 text-brand-600" />}
                  </button>
                )
              })}
            </div>

            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="button" onClick={() => setStep('details')} disabled={!role} className="btn-primary h-12 w-full text-sm mt-4 shadow-brand transition disabled:cursor-not-allowed disabled:opacity-50">
              Continue <ArrowRight className="ml-2 inline h-4 w-4" />
            </motion.button>
          </motion.div>
        )}

        {step === 'details' && (
          <motion.form key="details" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} onSubmit={handleRegister} className="space-y-4">
            <button type="button" onClick={() => setStep('role')} className="flex items-center gap-1 text-sm font-bold text-surface-500 hover:text-brand-600 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {error && <div className="rounded-xl border border-danger-100 bg-danger-50 p-3 text-sm font-bold text-danger-600">{error}</div>}

            <InputShell label="Full name" icon={User}>
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400" placeholder="Full name" />
            </InputShell>
            <InputShell label="Phone" icon={Phone}>
              <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, '') })} className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400" placeholder="+234..." />
            </InputShell>
            <InputShell label="Email" icon={Mail}>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400" placeholder="name@example.com" />
            </InputShell>
            <InputShell label="Password" icon={Lock}>
              <input required minLength={8} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-12 w-full bg-transparent pl-12 pr-12 text-sm font-semibold text-surface-900 outline-none placeholder:text-surface-400" placeholder="Minimum 8 characters" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-600 transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </InputShell>

            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="submit" disabled={loading} className="btn-primary h-12 w-full text-sm mt-4 shadow-brand transition">
              {loading ? <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Submit application'}
            </motion.button>
          </motion.form>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-600 ring-4 ring-success-50/50">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-surface-900">Application received</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-surface-500">Your application has been received. An admin will review your details and activate your portal access soon.</p>
            <Link to="/auth/login" className="btn-primary mt-8 h-12 w-full">
              Return to sign in
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {step !== 'success' && (
        <p className="pt-4 text-center text-sm font-semibold text-surface-500">
          Already approved? <Link to="/auth/login" className="font-black text-brand-600 underline-offset-4 hover:underline">Sign in</Link>
        </p>
      )}
    </AuthLayout>
  )
}
