import { useEffect } from 'react'
import { HardDrive } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BranchStock } from './BranchPicker'

export interface SdCardValue { enabled: boolean; quantity: number; charge: boolean }

/** The 64GB memory card product, found by name so a renamed item still works. */
export function findSdCard<T extends { name: string; is_active?: boolean }>(products: T[]): T | undefined {
  return products.find(p => /memory card|sd card|micro ?sd/i.test(p.name) && p.is_active !== false)
}

/** Tick to add SD cards to the order. They're deducted from the same branch as the cameras on delivery. */
export function SdCardOption({ sdCard, cameraQuantity, branchId, stock, value, onChange }: {
  sdCard?: { id: string; name: string; retail_price: number }
  cameraQuantity: number
  branchId: string
  stock: BranchStock[]
  value: SdCardValue
  onChange: (v: SdCardValue) => void
}) {
  // One card per camera unless someone changed the number.
  useEffect(() => {
    if (value.enabled && value.quantity === 0) onChange({ ...value, quantity: Math.max(1, cameraQuantity) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.enabled])

  if (!sdCard) return null
  const available = branchId ? Number(stock.find(s => s.product_id === sdCard.id && s.location_id === branchId)?.quantity || 0) : null
  const short = value.enabled && available !== null && available < value.quantity
  return (
    <div className={`rounded-xl border p-3 transition-colors ${value.enabled ? 'border-brand-300 bg-brand-50/40' : 'border-surface-200'}`}>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={value.enabled}
          onChange={e => onChange({ ...value, enabled: e.target.checked, quantity: e.target.checked ? Math.max(1, cameraQuantity) : 0 })} />
        <HardDrive className="h-4 w-4 text-brand-600" />
        <span className="flex-1 text-sm font-semibold text-surface-900">Include {sdCard.name.trim().replace(/\s+/g, ' ')}</span>
        {available !== null && <span className="text-[11px] text-surface-500">{available} at this branch</span>}
      </label>
      {value.enabled && (
        <div className="mt-3 flex flex-wrap items-center gap-4 pl-7">
          <label className="flex items-center gap-2 text-xs text-surface-600">
            Cards
            <input type="number" min={1} className="input h-8 w-20 text-sm" value={value.quantity}
              onChange={e => onChange({ ...value, quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-surface-600">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={value.charge}
              onChange={e => onChange({ ...value, charge: e.target.checked })} />
            Charge for it ({formatCurrency(sdCard.retail_price)} each) — leave unticked when it's the free promo card
          </label>
          <p className={`w-full text-[11px] ${short ? 'font-semibold text-amber-700' : 'text-surface-500'}`}>
            {short ? `Only ${available} at this branch — top up before delivery, or choose another branch.`
              : 'Deducted from the same branch as the cameras when the order is delivered.'}
          </p>
        </div>
      )}
    </div>
  )
}
