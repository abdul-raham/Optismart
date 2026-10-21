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
  Sparkles,
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
  desc: string
  perk: string
  icon: React.ElementType
  color: string
}

const ROLES: RoleOption[] = [
  {
    id: 'dsa',
    title: 'Direct Sales Agent (DSA)',
    tagline: 'Earn ₦5,000 per camera sold',
    desc: 'Capture leads, place customer orders, track automatic commissions, and climb the sales leaderboard.',
    perk: 'Instant commission on delivery',
    icon: Target,
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'installer',
    title: 'Certified Installer',
    tagline: 'Technical hardware installation',
    desc: 'Receive customer installation jobs in your area, update job statuses, and manage monthly technician payouts.',
    perk: 'Direct job assignments & payouts',
    icon: Wrench,
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'reseller',
    title: 'Merchant & Reseller',
    tagline: 'Bulk purchases & wholesale rates',
    desc: 'Access tiered product pricing, purchase cameras in quantity, and manage wholesale supply directly.',
    perk: 'Tiered wholesale pricing',
    icon: Package,
    color: 'from-emerald-500 to-teal-600',
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
          ? 'Step 1 of 2: Choose your role in the OptiSmart ecosystem'
          : step === 'details'
          ? `Step 2 of 2: Enter your details for ${selectedRoleObj?.title}`
          : 'Your account is under administrative review'
      }
      activeTab="register"
    >
      <AnimatePresence mode="wait">
        
        {/* ================= STEP 1: SELECT ROLE ================= */}
        {step === 'role' && (
          <motion.div
            key="role"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.25 }}
            className="space-y-3.5"
          >
            <div className="space-y-2.5">
              {ROLES.map((item) => {
                const Icon = item.icon
                const selected = role === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setRole(item.id)}
                    type="button"
                    className={`group w-full relative flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                      selected
                        ? 'border-brand-500 bg-brand-50/70 shadow-sm ring-2 ring-brand-500/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                        selected
                          ? 'bg-gradient-to-br from-brand-600 to-cyan-500 text-white shadow-md'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="block font-bold text-sm text-slate-900">
                          {item.title}
                        </span>
                        {selected ? (
                          <CheckCircle2 className="h-4 w-4 text-brand-600 flex-shrink-0" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-slate-300 group-hover:border-slate-400" />
                        )}
                      </div>
                      <p className="text-xs text-brand-700 font-semibold mt-0.5">
                        {item.tagline}
                      </p>
                      <p className="text-xs text-slate-500 font-normal mt-1 leading-snug">
                        {item.desc}
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
              className="relative mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 font-bold text-sm text-white shadow-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Continue to Personal Details</span>
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </motion.div>
        )}

        {/* ================= STEP 2: DETAILS FORM ================= */}
        {step === 'details' && (
          <motion.form
            key="details"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleRegister}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => setStep('role')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Role Selection
              </button>

              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700 border border-brand-200">
                {selectedRoleObj?.title}
              </span>
            </div>

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

            <InputShell label="Full name" icon={User}>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="e.g. John Adebayo"
              />
            </InputShell>

            <InputShell label="Phone number" icon={Phone}>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, '') })}
                className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="+234 800 000 0000"
              />
            </InputShell>

            <InputShell label="Email address" icon={Mail}>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-12 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="name@company.com"
              />
            </InputShell>

            <InputShell label="Create password" icon={Lock}>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-12 w-full bg-transparent pl-12 pr-12 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                placeholder="At least 6 characters"
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
                  <span>Submitting application...</span>
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
            className="text-center py-4 space-y-4"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900">Application Submitted!</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                We've received your request to join as a <strong className="text-slate-800">{selectedRoleObj?.title}</strong>. An administrator will verify your credentials and approve your portal access shortly.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs text-left space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> What happens next?
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                You'll receive a confirmation email once your account is active. You will then be able to log in with your password.
              </p>
            </div>

            <Link
              to="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-6 font-bold text-xs text-white shadow-sm hover:bg-slate-800 transition-colors w-full"
            >
              Back to Sign In
            </Link>
          </motion.div>
        )}

      </AnimatePresence>
    </AuthLayout>
  )
}
