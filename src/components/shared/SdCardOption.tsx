import { useEffect } from 'react'
import { HardDrive } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BranchStock } from './BranchPicker'

export interface SdCardValue { enabled: boolean; productId: string; quantity: number; charge: boolean }
export const SD_DEFAULT: SdCardValue = { enabled: false, productId: '', quantity: 0, charge: false }

interface SdProduct { id: string; name: string; retail_price: number; is_active?: boolean; category?: string }

/** Every active product in the "SD cards" group (older rows without a group are matched by name). */
export function sdCardsOf<T extends SdProduct>(products: T[]): T[] {
  return products.filter(p => p.is_active !== false &&
    (p.category ? p.category === 'sd_card' : /memory card|sd card|micro ?sd/i.test(p.name)))
}
/** Products that are sold as the main item of an order (cameras and accessories, not SD cards). */
export function mainProductsOf<T extends SdProduct>(products: T[]): T[] {
  const sd = new Set(sdCardsOf(products).map(p => p.id))
  return products.filter(p => !sd.has(p.id))
}

/** Tick to add SD cards to the order, pick which card, and they come off the same branch on delivery. */
export function SdCardOption({ sdCards, cameraQuantity, branchId, stock, value, onChange }: {
  sdCards: SdProduct[]
  cameraQuantity: number
  branchId: string
  stock: BranchStock[]
  value: SdCardValue
  onChange: (v: SdCardValue) => void
}) {
  const at = (id: string) => (branchId ? Number(stock.find(s => s.product_id === id && s.location_id === branchId)?.quantity || 0) : null)

  // Default to the card with the most stock at the chosen branch.
  useEffect(() => {
    if (!value.enabled || value.productId || !sdCards.length) return
    const best = [...sdCards].sort((a, b) => (at(b.id) ?? 0) - (at(a.id) ?? 0))[0]
    onChange({ ...value, productId: best.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.enabled, sdCards.length])

  if (!sdCards.length) return null
  const card = sdCards.find(c => c.id === value.productId)
  const available = card ? at(card.id) : null
  const short = value.enabled && available !== null && available < value.quantity
  return (
    <div className={`rounded-xl border p-3 transition-colors ${value.enabled ? 'border-brand-300 bg-brand-50/40' : 'border-surface-200'}`}>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={value.enabled}
          onChange={e => onChange(e.target.checked ? { ...value, enabled: true, quantity: Math.max(1, cameraQuantity) } : { ...SD_DEFAULT })} />
        <HardDrive className="h-4 w-4 text-brand-600" />
        <span className="flex-1 text-sm font-semibold text-surface-900">Add SD card(s)</span>
      </label>
      {value.enabled && (
        <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-[1fr_96px]">
          <select className="input h-9 text-sm" value={value.productId} onChange={e => onChange({ ...value, productId: e.target.value })}>
            {sdCards.map(c => {
              const n = at(c.id)
              return <option key={c.id} value={c.id}>{c.name.trim()}{n !== null ? ` — ${n} at this branch` : ''}</option>
            })}
          </select>
          <input type="number" min={1} className="input h-9 text-sm" aria-label="Number of SD cards" value={value.quantity}
            onChange={e => onChange({ ...value, quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
          <label className="flex items-center gap-2 text-xs text-surface-600 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={value.charge}
              onChange={e => onChange({ ...value, charge: e.target.checked })} />
            Charge for it{card ? ` (${formatCurrency(card.retail_price)} each)` : ''} — leave unticked for the free promo card
          </label>
          <p className={`text-[11px] sm:col-span-2 ${short ? 'font-semibold text-amber-700' : 'text-surface-500'}`}>
            {short ? `Only ${available} at this branch — top up before delivery, or choose another branch.`
              : branchId ? 'Deducted from the same branch as the cameras when the order is delivered.'
              : 'Choose the branch above to see SD card stock.'}
          </p>
        </div>
      )}
    </div>
  )
}
