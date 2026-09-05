import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, UserCheck, Sparkles, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function AccountUpgradeModal() {
  const { user, refreshProfile } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<string>('abisolaidogbe@gmail.com')
  const [secondaryEmail, setSecondaryEmail] = useState<string>('abisolaidogbe484@gmail.com')

  useEffect(() => {
    if (!user) return
    
    // Check if current user is Abisola or has duplicate upgrade accounts pending
    const checkUpgradePending = async () => {
      try {
        const userEmail = user.email?.toLowerCase() || ''
        const userPhone = user.phone || ''

        const isAbisola = 
          userEmail.includes('abisolaidogbe') || 
          userPhone === '07051205864' ||
          user.full_name?.toLowerCase().includes('abisola idogbe')

        if (!isAbisola) return

        // Check if secondary account still exists in users table
        const { data: duplicateUsers } = await supabase
          .from('users')
          .select('id, email, role')
          .or(`email.ilike.%abisolaidogbe%,phone.eq.07051205864`)

        if (duplicateUsers && duplicateUsers.length > 1) {
          const emails = Array.from(new Set(duplicateUsers.map(u => u.email).filter(Boolean)))
          if (emails.length > 1) {
            setSelectedEmail(userEmail)
            setSecondaryEmail(emails.find(e => e.toLowerCase() !== userEmail) || 'abisolaidogbe484@gmail.com')
            setIsOpen(true)
          }
        }
      } catch (err) {
        console.error('Error checking account upgrade status:', err)
      }
    }

    checkUpgradePending()
  }, [user])

  const handleConsolidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmail || !secondaryEmail) return

    setSubmitting(true)
    try {
      // Call Postgres RPC function to consolidate records and delete duplicate
      const { data, error } = await supabase.rpc('consolidate_user_accounts', {
        primary_email: selectedEmail,
        secondary_email: secondaryEmail
      })

      if (error) throw error

      // Refresh store profile
      await refreshProfile()
      setIsOpen(false)
    } catch (err: any) {
      console.error('Failed to consolidate account:', err)
      alert(err.message || 'Error processing account consolidation')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 bg-surface-900/60 backdrop-blur-md" 
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-brand-100 z-10"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-brand-600 to-cyan-600 p-6 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md">
                <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-surface-950 px-2 py-0.5 rounded-full">
                  Account Upgrade
                </span>
                <h2 className="text-xl font-extrabold tracking-tight mt-0.5">Admin + DSA Dual Role</h2>
              </div>
            </div>
            <p className="text-xs text-white/90 leading-relaxed mt-2">
              Congratulations <span className="font-bold underline">{user?.full_name || 'Abisola'}</span>! Your account has been upgraded with full Admin rights while keeping your personal sales & commission privileges.
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleConsolidate} className="p-6 space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
                Select your primary login email:
              </label>
              <p className="text-xs text-surface-600 mb-4">
                Choose which email address you want to retain for signing into your unified Admin profile:
              </p>

              <div className="space-y-3">
                {/* Option 1 */}
                <label 
                  onClick={() => setSelectedEmail('abisolaidogbe@gmail.com')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedEmail === 'abisolaidogbe@gmail.com'
                      ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="primary_email" 
                    value="abisolaidogbe@gmail.com" 
                    checked={selectedEmail === 'abisolaidogbe@gmail.com'}
                    onChange={() => {
                      setSelectedEmail('abisolaidogbe@gmail.com')
                      setSecondaryEmail('abisolaidogbe484@gmail.com')
                    }}
                    className="mt-0.5 text-brand-600 focus:ring-brand-500" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-surface-900 truncate">abisolaidogbe@gmail.com</p>
                    <p className="text-xs text-surface-500 mt-0.5">Original DSA Account Email</p>
                  </div>
                  {selectedEmail === 'abisolaidogbe@gmail.com' && (
                    <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" />
                  )}
                </label>

                {/* Option 2 */}
                <label 
                  onClick={() => setSelectedEmail('abisolaidogbe484@gmail.com')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedEmail === 'abisolaidogbe484@gmail.com'
                      ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="primary_email" 
                    value="abisolaidogbe484@gmail.com" 
                    checked={selectedEmail === 'abisolaidogbe484@gmail.com'}
                    onChange={() => {
                      setSelectedEmail('abisolaidogbe484@gmail.com')
                      setSecondaryEmail('abisolaidogbe@gmail.com')
                    }}
                    className="mt-0.5 text-brand-600 focus:ring-brand-500" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-surface-900 truncate">abisolaidogbe484@gmail.com</p>
                    <p className="text-xs text-surface-500 mt-0.5">Admin Portal Email</p>
                  </div>
                  {selectedEmail === 'abisolaidogbe484@gmail.com' && (
                    <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" />
                  )}
                </label>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">Note:</span> All your past sales, leads, commissions, and performance records will be safely merged into your selected primary account.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-brand flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Consolidating Account...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Upgrade Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
