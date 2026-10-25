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

/** Exactly what to tap on this kind of phone to get notifications working. */
export function NotificationHelp({ state, device }: { state: PushState; device: Device }) {
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
  if (device === 'android') return <Steps steps={[
    <>Tap the <strong>🔒</strong> (or <strong>ⓘ</strong>) to the left of the web address at the top.</>,
    <>Tap <strong>Permissions</strong> → <strong>Notifications</strong> → <strong>Allow</strong>.</>,
    <>If it&apos;s still off: phone <Settings className="inline h-4 w-4 text-brand-600" /> <strong>Settings</strong> → <strong>Apps</strong> → <strong>Chrome</strong> → <strong>Notifications</strong> → on.</>,
    <>Tap <strong>Check again</strong>.</>,
  ]} />
  if (device === 'iphone-app' || device === 'iphone-safari') return <Steps steps={[
    <>Open the iPhone <Settings className="inline h-4 w-4 text-brand-600" /> <strong>Settings</strong> app → <strong>Notifications</strong>.</>,
    <>Find <strong>OptiSmart</strong> and switch on <strong>Allow Notifications</strong>.</>,
    <>Come back and tap <strong>Check again</strong>.</>,
  ]} />
  return <Steps steps={[
    <>Click the <strong>🔒</strong> next to the web address.</>,
    <>Set <strong>Notifications</strong> to <strong>Allow</strong>.</>,
    <>Click <strong>Check again</strong>.</>,
  ]} />
}
