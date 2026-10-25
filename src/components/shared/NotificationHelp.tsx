import { MoreVertical, Settings, Share, PlusSquare } from 'lucide-react'
import type { Device, PushState } from '@/lib/pushSubscription'

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5 text-left text-sm leading-snug text-surface-800">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
          <span className="min-w-0">{s}</span>
        </li>
      ))}
    </ol>
  )
}

const site = typeof window === 'undefined' ? 'sales.optismart.com.ng' : window.location.host

/** Exactly what to tap on this kind of phone. `deeper` is shown once "Check again" finds it still blocked. */
export function NotificationHelp({ state, device, deeper = false }: { state: PushState; device: Device; deeper?: boolean }) {
  if (state === 'in-app') return <Steps steps={[
    <>You opened OptiSmart inside another app (like WhatsApp), which can&apos;t show notifications.</>,
    <>Tap <MoreVertical className="inline h-4 w-4 text-brand-600" /> or <Share className="inline h-4 w-4 text-brand-600" />, then <strong>Open in Chrome</strong> (or <strong>Open in Safari</strong> on iPhone).</>,
    <>Sign in there and tap <strong>Turn on notifications</strong>.</>,
  ]} />
  if (state === 'needs-install') return <Steps steps={[
    <>Tap <Share className="inline h-4 w-4 text-brand-600" /> <strong>Share</strong> at the bottom of Safari.</>,
    <>Scroll down, choose <PlusSquare className="inline h-4 w-4 text-brand-600" /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</>,
    <>Open <strong>OptiSmart</strong> from your Home Screen, sign in, and tap <strong>Allow</strong> when asked.</>,
  ]} />
  if (state === 'unsupported') return <Steps steps={[
    <>This browser can&apos;t show notifications.</>,
    <>On Android use <strong>Chrome</strong>; on iPhone use <strong>Safari</strong> and add OptiSmart to your Home Screen.</>,
  ]} />
  if (state !== 'denied') return null

  // Blocked. The phone's own notifications can be on while the browser still blocks this one website.
  if (device === 'iphone-app' || device === 'iphone-safari') return <Steps steps={deeper ? [
    <>Press and hold the <strong>OptiSmart</strong> icon on your Home Screen → <strong>Remove App</strong> → <strong>Delete App</strong>.</>,
    <>Open Safari, go to <strong>{site}</strong>, tap <Share className="inline h-4 w-4 text-brand-600" /> → <strong>Add to Home Screen</strong>.</>,
    <>Open it from the new icon, sign in and tap <strong>Allow</strong>. Removing the icon clears the block; your account and data are not affected.</>,
  ] : [
    <>Open the iPhone <Settings className="inline h-4 w-4 text-brand-600" /> <strong>Settings</strong> app → <strong>Notifications</strong>.</>,
    <>Scroll to <strong>OptiSmart</strong> and switch on <strong>Allow Notifications</strong>.</>,
    <>Come back here and tap <strong>Check again</strong>.</>,
  ]} />
  if (device === 'samsung') return <Steps steps={deeper ? [
    <>Tap <strong>☰</strong> (bottom right) → <strong>Settings</strong> → <strong>Sites and downloads</strong> → <strong>Site permissions</strong> → <strong>Notifications</strong>.</>,
    <>Find <strong>{site}</strong> and remove it, or set it to <strong>Allow</strong>.</>,
    <>Check phone <strong>Settings</strong> → <strong>Apps</strong> → <strong>Samsung Internet</strong> → <strong>Notifications</strong> is on.</>,
    <>Come back, tap <strong>Check again</strong>, then <strong>Allow</strong>.</>,
  ] : [
    <>Tap the <strong>🔒</strong> next to the web address at the top.</>,
    <>Tap <strong>Notifications</strong> (or <strong>Permissions</strong>) and set it to <strong>Allow</strong>.</>,
    <>Tap <strong>Check again</strong>.</>,
  ]} />
  if (device === 'android' || device === 'android-app') return <Steps steps={deeper ? [
    device === 'android-app'
      ? <>Press and hold the <strong>OptiSmart</strong> icon → <strong>App info</strong> → <strong>Notifications</strong> → switch <strong>on</strong>.</>
      : <>Open <strong>Chrome</strong> → <MoreVertical className="inline h-4 w-4 text-brand-600" /> → <strong>Settings</strong> → <strong>Site settings</strong> → <strong>Notifications</strong>.</>,
    <>Under <strong>Blocked</strong>, tap <strong>{site}</strong> and choose <strong>Allow</strong>. Not listed? Tap the <strong>🔒</strong> next to the address → <strong>Permissions</strong> → <strong>Reset permissions</strong>.</>,
    <>Check phone <Settings className="inline h-4 w-4 text-brand-600" /> <strong>Settings</strong> → <strong>Apps</strong> → <strong>Chrome</strong> → <strong>Notifications</strong> is on. Chrome itself has to be allowed.</>,
    <>Come back, tap <strong>Check again</strong>, then <strong>Allow</strong>.</>,
  ] : [
    <>Tap the <strong>🔒</strong> (or <strong>ⓘ</strong>) to the left of the web address at the top.</>,
    <>Tap <strong>Permissions</strong> → <strong>Notifications</strong> → <strong>Allow</strong>.</>,
    <>Tap <strong>Check again</strong>.</>,
  ]} />
  return <Steps steps={deeper ? [
    <>Open the browser&apos;s <strong>Settings</strong> → <strong>Privacy</strong> → <strong>Site settings</strong> → <strong>Notifications</strong>.</>,
    <>Remove <strong>{site}</strong> from the blocked list, or set it to <strong>Allow</strong>.</>,
    <>Make sure your computer allows notifications from this browser, then click <strong>Check again</strong>.</>,
  ] : [
    <>Click the <strong>🔒</strong> next to the web address.</>,
    <>Set <strong>Notifications</strong> to <strong>Allow</strong>.</>,
    <>Click <strong>Check again</strong>.</>,
  ]} />
}
