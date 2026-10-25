import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'in-app' | 'needs-install' | 'default' | 'denied' | 'granted'
export type Device = 'android' | 'android-app' | 'samsung' | 'iphone-app' | 'iphone-safari' | 'in-app' | 'computer'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true

// Browsers built into other apps (WhatsApp, Facebook, Instagram…) can't show notifications.
const isInAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(navigator.userAgent)

export function device(): Device {
  if (isInAppBrowser()) return 'in-app'
  if (isIos()) return isStandalone() ? 'iphone-app' : 'iphone-safari'
  if (/SamsungBrowser/i.test(navigator.userAgent)) return 'samsung'
  if (/android/i.test(navigator.userAgent)) return isStandalone() ? 'android-app' : 'android'
  return 'computer'
}

/** Can this phone get push notifications, and has the person allowed them? */
export function pushState(): PushState {
  if (isInAppBrowser()) return 'in-app'
  // iPhones only allow web push once the portal is added to the Home Screen.
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  return Notification.permission as PushState
}

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function deviceLabel() {
  const ua = navigator.userAgent
  const os = /android/i.test(ua) ? 'Android' : isIos() ? 'iPhone' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Device'
  const browser = /edg/i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Browser'
  return `${os} · ${browser}${isStandalone() ? ' (app)' : ''}`
}

/** Register this phone for push and save it to the signed-in person. Returns true when it is set up. */
export async function registerPush(askPermission: boolean): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) { console.warn('VITE_VAPID_PUBLIC_KEY is not set'); return false }
  const state = pushState()
  if (state === 'unsupported' || state === 'needs-install' || state === 'denied') return false
  if (state === 'default') {
    if (!askPermission) return false
    if ((await Notification.requestPermission()) !== 'granted') return false
  }
  try {
    const registration = await navigator.serviceWorker.ready
    let sub = await registration.pushManager.getSubscription()
    // A subscription made with an old key cannot receive our pushes; replace it.
    const current = sub?.options?.applicationServerKey
    if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/=+$/, '') !==
        btoa(String.fromCharCode(...keyBytes(VAPID_PUBLIC_KEY))).replace(/=+$/, '')) {
      await sub.unsubscribe()
      sub = null
    }
    if (!sub) sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth, p_device: deviceLabel(),
    })
    if (error) throw error
    return true
  } catch (err) {
    console.error('Push registration failed:', err)
    return false
  }
}

/** Turn push off on this phone. */
export async function unregisterPush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (!sub) return
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
    await sub.unsubscribe()
  } catch (err) {
    console.error('Push removal failed:', err)
  }
}
