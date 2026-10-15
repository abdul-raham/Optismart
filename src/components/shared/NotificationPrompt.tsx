import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Share, PlusSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { pushState, registerPush, type PushState } from '@/lib/pushSubscription'

/** Notifications are required: asks on every load until allowed, re-registers quietly after that,
 *  and if they were blocked shows how to turn them back on. */
export function NotificationPrompt() {
  const { user } = useAuthStore()
  const [show, setShow] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (!user) return
    const state = pushState()
    // Already allowed: make sure this phone is saved to this person (also refreshes it after a reinstall).
    if (state === 'granted') { registerPush(false); return }
    if (state === 'denied') { setBlocked(true); return }
    if (state === 'default' || state === 'needs-install') {
      const timer = setTimeout(() => setShow(state), 1200)
      return () => clearTimeout(timer)
    }
  }, [user?.id])

  const later = () => setShow(null)  // only offered on iPhone Safari, where push needs the Home Screen app
  const enable = async () => {
    setBusy(true)
    const ok = await registerPush(true)
    setBusy(false)
    if (ok) setShow(null)
    else if (pushState() === 'denied') { setShow(null); setBlocked(true) }
    else setFailed(true)
  }

  return (
    <>
    {blocked && (
      <div className="fixed inset-x-0 top-0 z-[90] bg-rose-600 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-lg sm:text-sm">
        Notifications are blocked on this device. Open your browser&apos;s site settings for this page (the 🔒 or ⓘ next to the address), set <strong>Notifications → Allow</strong>, then reload.
        <button onClick={() => window.location.reload()} className="ml-2 rounded-md bg-white/20 px-2 py-0.5 font-bold hover:bg-white/30">Reload</button>
      </div>
    )}
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600"><Bell className="h-7 w-7" /></div>
              <h3 className="mb-2 text-lg font-bold text-surface-900">Turn on notifications</h3>
              {show === 'needs-install' ? (
                <>
                  <p className="mb-4 text-sm text-surface-500">On iPhone, notifications only work from the Home Screen app. It takes 10 seconds:</p>
                  <ol className="mb-5 space-y-2 text-left text-sm text-surface-700">
                    <li className="flex items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-100 text-xs font-bold">1</span> Tap <Share className="h-4 w-4 text-brand-600" /> <strong>Share</strong> at the bottom of Safari</li>
                    <li className="flex items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-100 text-xs font-bold">2</span> Choose <PlusSquare className="h-4 w-4 text-brand-600" /> <strong>Add to Home Screen</strong></li>
                    <li className="flex items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-100 text-xs font-bold">3</span> Open OptiSmart from the Home Screen and allow notifications</li>
                  </ol>
                  <button onClick={later} className="w-full rounded-xl bg-surface-100 py-3 font-bold text-surface-700 hover:bg-surface-200">Continue for now</button>
                  <p className="mt-2 text-[11px] text-surface-400">You&apos;ll be asked again each time until it&apos;s set up.</p>
                </>
              ) : (
                <>
                  <p className="mb-5 text-sm text-surface-500">Notifications are required on OptiSmart: you get an alert when your orders move, jobs are assigned and commissions or payouts land. Tap below, then choose <strong>Allow</strong>.</p>
                  {failed && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">That didn&apos;t work. Check your connection and try again.</p>}
                  <div className="space-y-2">
                    <button onClick={enable} disabled={busy} className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">
                      {busy ? 'Turning on…' : 'Turn on notifications'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  )
}
