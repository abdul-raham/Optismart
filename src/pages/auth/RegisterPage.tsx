import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Package,
  Phone,
  Target,
  User,
  Wrench,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout, InputShell } from './AuthLayout'

type RegistrationStep = 'role' | 'details' | 'success'
type JoinRole = 'dsa' | 'installer' | 'reseller'

interface RoleOption {
  id: JoinRole
  title: string
  tagline: string
  icon: React.ElementType
}

const ROLES: RoleOption[] = [
  {
    id: 'dsa',
    title: 'Sales Agent (DSA)',
    tagline: 'Earn ₦5,000 commission per camera sold',
    icon: Target,
  },
  {
    id: 'installer',
    title: 'Certified Installer',
    tagline: 'Hardware installations & technician payouts',
    icon: Wrench,
  },
  {
    id: 'reseller',
    title: 'Merchant & Reseller',
    tagline: 'Bulk purchases & wholesale pricing rates',
    icon: Package,
  },
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

    if (!form.fullName || !form.email || !form.phone || !form.password) {
      setError('Please fill in all required fields.')
      return
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
            phone: form.phone.trim(),
            role
          }
        },
      })

      if (signUpError) {
        if (signUpError.status === 429 || signUpError.message?.toLowerCase().includes('rate limit')) {
          throw new Error('Too many sign-up attempts. Please wait a few moments or contact admin.')
        }
        if (signUpError.message?.toLowerCase().includes('email')) {
          throw new Error('There was an issue with this email. Please use a different email address.')
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

  const selectedRoleObj = ROLES.find((r) => r.id === role)

  return (
    <AuthLayout
      title={step === 'success' ? 'Application Received' : 'Apply for Access'}
      subtitle={
        step === 'role'
          ? 'Step 1 of 2: Select your role'
          : step === 'details'
          ? `Step 2 of 2: Details for ${selectedRoleObj?.title}`
          : 'Your account is under administrative review'
      }
    >
      <AnimatePresence mode="wait">
        
        {/* ================= STEP 1: SELECT ROLE ================= */}
        {step === 'role' && (
          <motion.div
            key="role"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="space-y-2">
              {ROLES.map((item) => {
                const Icon = item.icon
                const selected = role === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setRole(item.id)}
                    type="button"
                    className={`group w-full relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer ${
                      selected
                        ? 'border-brand-500 bg-brand-50/70 shadow-xs ring-2 ring-brand-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
                        selected
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="block font-bold text-sm text-slate-900 leading-tight">
                          {item.title}
                        </span>
                        {selected ? (
                          <CheckCircle2 className="h-4 w-4 text-brand-600 flex-shrink-0 ml-1" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-slate-300 group-hover:border-slate-400 flex-shrink-0 ml-1" />
                        )}
                      </div>
                      <p className="text-xs text-brand-700 font-semibold mt-0.5 leading-tight">
                        {item.tagline}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              type="button"
              onClick={() => setStep('details')}
              disabled={!role}
              className="relative mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 font-bold text-sm text-white shadow-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-brand-700"
            >
              <span>Continue to Personal Details</span>
              <ArrowRight className="h-4 w-4" />
            </motion.button>

            <div className="pt-2 text-center">
              <p className="text-xs font-medium text-slate-500">
                Already have an account?{' '}
                <Link
                  to="/auth/login"
                  className="font-bold text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        )}

        {/* ================= STEP 2: DETAILS FORM ================= */}
        {step === 'details' && (
          <motion.form
            key="details"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleRegister}
            className="space-y-3"
          >
            <div className="flex items-center justify-between pb-0.5">
              <button
                type="button"
                onClick={() => setStep('role')}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>

              <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-200">
                {selectedRoleObj?.title}
              </span>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700"
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-rose-500 mt-0.5" />
                  <div className="flex-1 leading-tight">{error}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <InputShell label="Full name" icon={User}>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="h-10 w-full bg-transparent pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="e.g. John Adebayo"
              />
            </InputShell>

            <InputShell label="Phone number" icon={Phone}>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, '') })}
                className="h-10 w-full bg-transparent pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="+234 800 000 0000"
              />
            </InputShell>

            <InputShell label="Email address" icon={Mail}>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-10 w-full bg-transparent pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="name@company.com"
              />
            </InputShell>

            <InputShell label="Password" icon={Lock}>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-10 w-full bg-transparent pl-10 pr-10 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </InputShell>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={loading}
              className="relative mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 font-bold text-sm text-white shadow-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-brand-700"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Submitting...</span>
                </div>
              ) : (
                <>
                  <span>Submit Application</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </motion.form>
        )}

        {/* ================= STEP 3: SUCCESS CONFIRMATION ================= */}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-2 space-y-3"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-4 ring-emerald-500/10">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Application Submitted!</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                We've received your request to join as a <strong className="text-slate-800">{selectedRoleObj?.title}</strong>. An administrator will verify your profile and approve your access shortly.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-left space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> What's next?
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                You'll receive a confirmation once your account is active, and can then log in using your password.
              </p>
            </div>

            <Link
              to="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 font-bold text-xs text-white shadow-xs hover:bg-slate-800 transition-colors w-full"
            >
              Back to Sign In
            </Link>
          </motion.div>
        )}

      </AnimatePresence>
    </AuthLayout>
  )
}
