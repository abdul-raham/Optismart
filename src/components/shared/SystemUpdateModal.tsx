import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, ArrowLeft, Check, Package, ShieldCheck, Clock, DollarSign, Sliders, ShoppingBag, Award, Target, BookOpen, UserCheck, Banknote, Truck, Wrench, Receipt, Phone, ClipboardCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { GuideText } from '@/components/shared/GuideTip'

const ICON_MAP: Record<string, any> = {
  Package, ShieldCheck, Clock, DollarSign, Sliders, ShoppingBag, Award, Target, BookOpen, UserCheck, Banknote, Truck, Wrench, Receipt, Phone,
}

const STATIC_RELEASE_VERSION = 'v5.0_oct_2026'

// Each release is remembered separately. (One shared key let the database release and the built-in release
// overwrite each other, so the two popups took turns forever.)
const seenKey = (userId: string) => `optismart_releases_seen_${userId}`
const stepKey = (userId: string, version: string) => `optismart_release_step_${userId}_${version}`
function hasSeen(userId: string, version: string): boolean {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(seenKey(userId)) || '[]')
    return list.includes(version) || localStorage.getItem(`optismart_release_version_${userId}`) === version
  } catch {
    return false
  }
}
function markSeen(userId: string, version: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(seenKey(userId)) || '[]')
    if (!list.includes(version)) localStorage.setItem(seenKey(userId), JSON.stringify([...list, version].slice(-20)))
    localStorage.removeItem(stepKey(userId, version))
  } catch {
    /* storage unavailable: the popup may show again next visit */
  }
}
function savedStep(userId: string, version: string) {
  try { return Number(localStorage.getItem(stepKey(userId, version)) || 0) } catch { return 0 }
}
function saveStep(userId: string, version: string, step: number) {
  try { localStorage.setItem(stepKey(userId, version), String(step)) } catch { /* ignore */ }
}

interface Card { icon: any; tone: string; title: string; lines: string[]; route?: string; cta?: string }

// Short cards, one at a time. **bold** marks the part that must not be missed.
const ROLE_CARDS: Record<string, Card[]> = {
  admin: [
    {
      icon: Receipt, tone: 'bg-brand-50 text-brand-600',
      title: 'Orders now track the money',
      lines: [
        'Every order now holds four amounts: **order total**, **amount remitted** by the delivery agent, **installation fee** and **delivery fee**.',
        'Fill them in from **Edit** on the order, so we always know what came in and what we paid out.',
      ],
      route: '/app/admin/orders?guide=money', cta: 'Show me on Orders',
    },
    {
      icon: Truck, tone: 'bg-indigo-50 text-indigo-600',
      title: 'There is now a place for delivery agents',
      lines: [
        'Add the people who deliver for us: name and phone. **They don’t need a login or dashboard.**',
        'Pick them on an order under **Delivered by** and the page adds up what each one delivered, was paid and remitted.',
      ],
      route: '/app/admin/delivery-agents?guide=agents', cta: 'Go to Delivery agents',
    },
    {
      icon: Wrench, tone: 'bg-emerald-50 text-emerald-600',
      title: 'Pick the installer, then reset after paying',
      lines: [
        'When an order needs installation, enter the fee and **select the installer**. Their earnings add up job by job and they can see it.',
        '**After you pay an installer, go to Installers → Payouts and tap “Mark as paid”.** That resets their balance to ₦0 and keeps the record.',
      ],
      route: '/app/admin/installers?guide=payouts', cta: 'Go to Installer payouts',
    },
  ],
  dsa: [
    {
      icon: ShoppingBag, tone: 'bg-brand-50 text-brand-600',
      title: 'Installation orders: enter the fee',
      lines: [
        'If your customer needs installation, tick **Installation needed** and enter the fee you agreed on the new order.',
        'Need SD cards? Tick **Add SD card(s)** on the same form.',
      ],
      route: '/app/dsa/orders', cta: 'Open My Orders',
    },
    {
      icon: ClipboardCheck, tone: 'bg-indigo-50 text-indigo-600',
      title: 'Admin assigns the installer and delivery',
      lines: [
        'After you submit, **admin picks who installs and who delivers**, and records the delivery fee.',
        'Under My Orders, an installation order shows **Installer assigned** once that is done.',
      ],
      route: '/app/dsa/orders', cta: 'Check my orders',
    },
    {
      icon: Phone, tone: 'bg-rose-50 text-rose-600',
      title: 'Not done yet? Contact admin',
      lines: [
        'If your order still says **No installer yet** close to the delivery date, or hasn’t moved from Pending, **contact admin** with the order number.',
        'Don’t promise the customer a date until admin has assigned it.',
      ],
    },
  ],
  installer: [
    {
      icon: Banknote, tone: 'bg-emerald-50 text-emerald-600',
      title: 'Your earnings add up per job',
      lines: [
        'Every job you are given shows **what you get paid for it**.',
        'When you finish a job, its pay moves into your **Owed** balance on the Earnings page.',
      ],
      route: '/app/installer/earnings', cta: 'Open Earnings',
    },
    {
      icon: Check, tone: 'bg-brand-50 text-brand-600',
      title: 'Admin resets it after paying you',
      lines: [
        'When admin pays you, they mark it as paid. **Your balance goes back to ₦0** and the payment is kept in your history.',
        'You get a notification each time.',
      ],
      route: '/app/installer/earnings', cta: 'See payout history',
    },
    {
      icon: Phone, tone: 'bg-rose-50 text-rose-600',
      title: 'Something not right? Contact admin',
      lines: ['If a finished job is missing or the amount looks wrong, **contact admin** with the order number before the next payout.'],
    },
  ],
}

export function SystemUpdateModal() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [state, setState] = useState<'closed' | 'open' | 'paused'>('closed')
  const [version, setVersion] = useState(STATIC_RELEASE_VERSION)
  const [title, setTitle] = useState("What's new")
  const [cards, setCards] = useState<Card[]>([])
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (user) checkForUpdates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const begin = (v: string, list: Card[], heading?: string) => {
    if (!user || !list.length) return
    setVersion(v)
    setCards(list)
    if (heading) setTitle(heading)
    setStep(Math.min(savedStep(user.id, v), list.length - 1))
    setState('open')
  }

  const checkForUpdates = async () => {
    if (!user) return
    const role = user.role || 'dsa'
    const roleCards = role === 'admin' || role === 'super_admin' ? ROLE_CARDS.admin : (ROLE_CARDS[role] || ROLE_CARDS.dsa)

    try {
      // A release published in the system_updates table takes priority.
      const { data, error } = await supabase.from('system_updates').select('*').eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1)
      const db = !error && data?.[0]
      if (db && !hasSeen(user.id, db.version_tag) && Array.isArray(db.features) && db.features.length) {
        begin(db.version_tag, db.features.map((f: any) => ({
          icon: ICON_MAP[f.icon] || Package, tone: 'bg-brand-50 text-brand-600',
          title: f.title, lines: [f.description].filter(Boolean), route: f.route, cta: f.route ? 'Show me' : undefined,
        })), db.title)
        return
      }
    } catch (err) {
      console.warn('Could not read system_updates, using the built-in release:', err)
    }
    if (!hasSeen(user.id, STATIC_RELEASE_VERSION)) begin(STATIC_RELEASE_VERSION, roleCards)
  }

  const go = (n: number) => { setStep(n); if (user) saveStep(user.id, version, n) }
  const finish = () => { if (user) markSeen(user.id, version); setState('closed') }
  // "Show me" opens the page (where the guide carries on) and parks the cards; the next one is waiting.
  const showMe = (route: string) => {
    const isLast = step === cards.length - 1
    if (isLast) finish()
    else { go(step + 1); setState('paused') }
    navigate(route)
  }

  if (state === 'closed' || !cards.length) return null
  const card = cards[step]
  const Icon = card.icon
  const isLast = step === cards.length - 1

  if (state === 'paused') {
    return (
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onClick={() => setState('open')}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-surface-900 py-2.5 pl-3 pr-4 text-xs font-bold text-white shadow-xl hover:bg-surface-800 md:bottom-6">
        <Sparkles className="h-4 w-4 text-amber-300" /> What&apos;s new · continue {step + 1}/{cards.length} <ArrowRight className="h-3.5 w-3.5" />
      </motion.button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <Sparkles className="h-3.5 w-3.5" /> {title}
          </span>
          <span className="text-xs font-semibold text-surface-400">{step + 1} / {cards.length}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }} className="px-6 pb-2 pt-4">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl ${card.tone}`}><Icon className="h-6 w-6" /></span>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-surface-900">{card.title}</h2>
            <div className="mt-3 space-y-2.5">
              {card.lines.map((line, i) => (
                <p key={i} className="text-sm leading-relaxed text-surface-600"><GuideText text={line} /></p>
              ))}
            </div>
            {card.route && (
              <button onClick={() => showMe(card.route!)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100">
                {card.cta || 'Show me'} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-surface-100 px-6 py-4">
          <div className="flex gap-1.5">
            {cards.map((_, i) => (
              <button key={i} onClick={() => go(i)} aria-label={`Card ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-brand-600' : i < step ? 'w-2 bg-brand-300' : 'w-2 bg-surface-200'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => go(step - 1)} className="btn-outline flex h-10 items-center gap-1 px-3 text-sm">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            <button onClick={() => (isLast ? finish() : go(step + 1))} className="btn-primary flex h-10 items-center gap-1.5 px-5 text-sm font-bold">
              {isLast ? <>Got it <Check className="h-4 w-4" /></> : <>Next <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
