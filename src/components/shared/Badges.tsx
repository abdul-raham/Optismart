import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'

const STATUS_MAP: Record<OrderStatus, { label: string; style: string }> = {
  pending: { label: 'Pending Payment', style: 'badge-yellow' },
  confirmed: { label: 'Payment Confirmed', style: 'badge-blue' },
  processing: { label: 'Processing', style: 'badge-purple' },
  dispatched: { label: 'Dispatched', style: 'badge-gray' },
  delivered: { label: 'Delivered', style: 'badge-green' },
  cancelled: { label: 'Cancelled', style: 'badge-red' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_MAP[status] || { label: status, style: 'badge-gray' }
  return (
    <span className={cn(config.style)}>
      {config.label}
    </span>
  )
}
