import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { device, pushState, registerPush, type PushState } from '@/lib/pushSubscription'
import { NotificationHelp } from './NotificationHelp'

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
    if (state === 'default' || state === 'needs-install' || state === 'in-app' || state === 'unsupported') {
      const timer = setTimeout(() => setShow(state), 1200)
      return () => clearTimeout(timer)
    }
  }, [user?.id])

  const later = () => setShow(null)
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
    {(blocked || (show === null && pushState() !== 'granted')) && (
      <button onClick={() => setShow(pushState())} className="relative z-[90] flex w-full items-center gap-3 bg-surface-900 px-4 py-2.5 text-left text-white">
        <BellOff className="h-5 w-5 shrink-0 text-amber-400" />
        <span className="min-w-0 flex-1 text-xs font-semibold sm:text-sm">{blocked ? 'Notifications are blocked on this device.' : 'Notifications are off on this device.'} You&apos;ll miss order and payment alerts.</span>
        <span className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold">{blocked ? 'How to fix' : 'Turn on'}</span>
      </button>
    )}
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600"><Bell className="h-7 w-7" /></div>
              <h3 className="mb-2 text-lg font-bold text-surface-900">{show === 'denied' ? 'Notifications are blocked' : 'Turn on notifications'}</h3>
              {show === 'default' ? (
                <>
                  <p className="mb-4 text-sm text-surface-500">You get an alert when your orders move, jobs are assigned and commissions or payouts land.</p>
                  <p className="mb-4 rounded-xl bg-surface-50 p-3 text-sm text-surface-800">Tap the button, then choose <strong>Allow</strong> on the message that pops up.</p>
                  {failed && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">That didn&apos;t work. Check your connection and try again.</p>}
                  <button onClick={enable} disabled={busy} className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">
                    {busy ? 'Turning on…' : 'Turn on notifications'}
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm text-surface-500">{show === 'denied' ? 'Notifications were blocked. Turn them back on like this:' : 'Notifications need one more step on this phone:'}</p>
                  <div className="mb-5"><NotificationHelp state={show} device={device()} /></div>
                  {show === 'denied' && <button onClick={() => window.location.reload()} className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700">Check again</button>}
                  {show === 'in-app' && <a href={window.location.href} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-bold text-white"><ExternalLink className="h-4 w-4" /> Open in browser</a>}
                </>
              )}
              <button onClick={later} className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-surface-500 hover:bg-surface-100">Not now</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  )
}
