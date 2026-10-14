import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, X, ArrowRight, Check } from 'lucide-react'

/** The rest of a What's New card, shown on the page it points to (…?guide=<key>). */
export const PAGE_GUIDES: Record<string, { title: string; steps: string[] }> = {
  money: {
    title: 'Recording the money on an order',
    steps: [
      'Open an order with the ✎ Edit button.',
      'Under **Money**, fill in **Amount remitted**: what the delivery agent handed back to us for this order.',
      'Fill in **Delivery fee**: what we paid to get it delivered. Pick who delivered it under **Delivered by**.',
      'If it needs installation, tick **Installation needed**, enter the fee, then **pick the installer** and what they get. They see it on their Earnings page straight away.',
      'Save. The order now shows order total, remitted, installation and delivery side by side.',
    ],
  },
  agents: {
    title: 'Adding delivery agents',
    steps: [
      'Tap **Add agent**, then type their name and phone (area is optional).',
      'They do **not** get a login or dashboard. This list is only so we can pick them on an order.',
      'On any order, choose them under **Delivered by** and enter the delivery fee.',
      'This page then adds up, per agent, how many orders they delivered, the fees we paid and the money they remitted.',
    ],
  },
  payouts: {
    title: 'Paying installers and resetting their balance',
    steps: [
      'Each installer’s **Owed** balance grows by their pay for every job they finish.',
      'The installer sees the same number on their Earnings page, so you both agree on what is owed.',
      '**After you have paid them**, come here and tap **Mark as paid** on their row. Add a note such as the transfer reference.',
      'Their balance **resets to ₦0**, the payout is saved in their history, and they get a notification.',
      'Only pay first, then mark as paid. A payout cannot be undone from the app.',
    ],
  },
}

/** Bold the **marked** parts of a guide line. */
export function GuideText({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => i % 2 ? <strong key={i} className="font-bold text-surface-900">{part}</strong> : part)}</>
}

export function GuideTip({ guideKey }: { guideKey: string }) {
  const [params, setParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const guide = PAGE_GUIDES[guideKey]
  const open = params.get('guide') === guideKey && !!guide
  const close = () => { params.delete('guide'); setParams(params, { replace: true }); setStep(0) }
  if (!guide) return null
  const last = step === guide.steps.length - 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          className="glass-card overflow-hidden border-l-4 border-l-brand-500">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><BookOpen className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Guide · step {step + 1} of {guide.steps.length}</p>
                <button onClick={close} aria-label="Close guide" className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700"><X className="h-4 w-4" /></button>
              </div>
              <h3 className="mt-0.5 text-sm font-bold text-surface-900">{guide.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-surface-600"><GuideText text={guide.steps[step]} /></p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex gap-1">
                  {guide.steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-brand-500' : 'w-1.5 bg-surface-200'}`} />)}
                </div>
                <div className="flex gap-2">
                  {step > 0 && <button onClick={() => setStep(step - 1)} className="btn-outline h-8 px-3 text-xs">Back</button>}
                  <button onClick={() => (last ? close() : setStep(step + 1))} className="btn-primary flex h-8 items-center gap-1 px-3 text-xs">
                    {last ? <>Done <Check className="h-3.5 w-3.5" /></> : <>Next <ArrowRight className="h-3.5 w-3.5" /></>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
