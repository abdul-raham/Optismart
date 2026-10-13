import { useEffect, useMemo } from 'react'
import { MapPin, AlertTriangle } from 'lucide-react'

export interface Branch { id: string; name: string; address?: string | null }
export interface BranchStock { product_id: string; location_id: string; quantity: number }

/** Choose the branch an order ships from, with live stock for the selected product.
 *  Defaults to the branch holding the most stock; the choice is saved on the order and used at delivery. */
export function BranchPicker({ productId, quantity, branches, stock, value, onChange, label = 'Ships from (branch)' }: {
  productId: string
  quantity: number
  branches: Branch[]
  stock: BranchStock[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  const rows = useMemo(() => branches
    .map(b => ({ ...b, available: Number(stock.find(s => s.location_id === b.id && s.product_id === productId)?.quantity || 0) }))
    .sort((a, b) => b.available - a.available || a.name.localeCompare(b.name)), [branches, stock, productId])
  const need = Math.max(1, quantity || 1)
  const best = rows.find(r => r.available >= need)

  useEffect(() => {
    if (!productId) return
    const current = rows.find(r => r.id === value)
    if (!current && best) onChange(best.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, best?.id])

  if (!productId) return null
  const chosen = rows.find(r => r.id === value)
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        <select className="input pl-10" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Decide at delivery</option>
          {rows.map(r => (
            <option key={r.id} value={r.id}>
              {r.name} — {r.available} in stock{r.available < need ? ' (not enough)' : ''}
            </option>
          ))}
        </select>
      </div>
      {!best ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No branch has {need} in stock. You can still place the order; restock or transfer before delivery.
        </p>
      ) : chosen && chosen.available < need ? (
        <p className="mt-1.5 text-[11px] font-medium text-amber-700">{chosen.name} has only {chosen.available}. {best.name} has {best.available}.</p>
      ) : chosen ? (
        <p className="mt-1.5 text-[11px] text-surface-500">Stock is deducted from {chosen.name} when the order is delivered.</p>
      ) : null}
    </div>
  )
}
