import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, Mail, MapPin, Package, HardDrive, Warehouse, Truck, Wrench, User, Calendar, Edit2, StickyNote, Banknote } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { OrderStatusBadge } from './Badges'
import { defaultInstallerPay } from './InstallerPicker'
import type { Order } from '@/types'

type Named = { id: string; name?: string; full_name?: string }

/** Everything about one order on a side panel: product, branch, customer, money, installer and delivery. */
export function OrderDetailsDrawer({ order, onClose, onEdit, products, branches, installers, agents, job }: {
  order: Order | null
  onClose: () => void
  onEdit?: (o: Order) => void
  products: Named[]
  branches: Named[]
  installers: Named[]
  agents: Named[]
  job?: { installer_id: string; commission_amount: number | null; status: string; payout_id: string | null }
}) {
  const nameOf = (list: Named[], id?: string | null) => (id ? list.find(x => x.id === id) : undefined)
  const o = order as any
  const product = order && nameOf(products, order.product_id)
  const sd = order && nameOf(products, o.accessory_product_id)
  const branch = order && nameOf(branches, o.fulfillment_location_id)
  const agent = order && nameOf(agents, order.delivery_agent_id)
  const installer = job && nameOf(installers, job.installer_id)
  const balance = order && order.amount_remitted != null ? Number(order.total_amount) - Number(order.amount_remitted) : null
  const editable = order && order.status !== 'cancelled'

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-surface-500">{label}</span>
      <span className="text-right font-semibold text-surface-900">{children}</span>
    </div>
  )
  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-surface-100 p-4">
      <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-surface-500"><Icon className="h-3.5 w-3.5" /> {title}</h3>
      <div className="divide-y divide-surface-100">{children}</div>
    </section>
  )

  return (
    <AnimatePresence>
      {order && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-surface-950/40 backdrop-blur-[2px]" />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-surface-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold text-surface-500">Order</p>
                <h2 className="text-lg font-bold text-surface-900">{order.order_number}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-xs text-surface-500">Placed {formatDate(order.created_at)}</span>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-700"><X className="h-5 w-5" /></button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <Section icon={User} title="Customer">
                <Row label="Name">{order.customer_name}</Row>
                {order.customer_phone && <Row label="Phone"><a href={`tel:${order.customer_phone}`} className="inline-flex items-center gap-1 text-brand-600"><Phone className="h-3 w-3" />{order.customer_phone}</a></Row>}
                {order.customer_email && <Row label="Email"><span className="inline-flex items-center gap-1 break-all"><Mail className="h-3 w-3 shrink-0" />{order.customer_email}</span></Row>}
                <Row label="Address"><span className="inline-flex items-start gap-1"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{order.customer_address || '—'}</span></Row>
                <Row label="Sales agent">{order.dsa?.full_name || order.unregistered_dsa_name || 'Direct'}</Row>
              </Section>

              <Section icon={Package} title="What was ordered">
                <Row label="Product">{product?.name || 'Unknown product'}</Row>
                <Row label="Quantity">{order.quantity} × {formatCurrency(order.unit_price)}</Row>
                {sd && <Row label="SD card"><span className="inline-flex items-center gap-1"><HardDrive className="h-3 w-3" />{o.accessory_quantity} × {sd.name}{Number(o.accessory_price) > 0 ? ` (${formatCurrency(o.accessory_price)} each)` : ' (free)'}</span></Row>}
                <Row label="Ships from"><span className="inline-flex items-center gap-1"><Warehouse className="h-3 w-3" />{branch?.name || 'Branch not chosen'}</span></Row>
                {o.stock_untracked && <Row label="Stock">Delivered without stock deduction</Row>}
              </Section>

              <Section icon={Banknote} title="Money">
                <Row label="Order total"><span className="text-base">{formatCurrency(order.total_amount)}</span></Row>
                <Row label="Amount remitted">{order.amount_remitted != null ? formatCurrency(order.amount_remitted) : <span className="font-normal text-surface-400">Not yet</span>}</Row>
                {balance !== null && balance !== 0 && (
                  <Row label={balance > 0 ? 'Still to remit' : 'Over-remitted'}><span className={balance > 0 ? 'text-amber-700' : 'text-emerald-700'}>{formatCurrency(Math.abs(balance))}</span></Row>
                )}
                <Row label="Installation fee">{order.installation_needed ? formatCurrency(order.installation_price) : <span className="font-normal text-surface-400">No installation</span>}</Row>
                <Row label="Delivery fee">{formatCurrency(order.delivery_fee || 0)}</Row>
              </Section>

              <Section icon={Truck} title="Delivery">
                <Row label="Delivered by">{agent?.full_name || <span className="font-normal text-surface-400">Not set</span>}</Row>
                <Row label="Expected">{order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '—'}</Row>
                {order.delivered_at && <Row label="Delivered">{formatDate(order.delivered_at)}</Row>}
              </Section>

              {order.installation_needed && (
                <Section icon={Wrench} title="Installation">
                  <Row label="Installer">{installer?.full_name || <span className="text-amber-700">Not assigned yet</span>}</Row>
                  {job && <Row label="Installer gets">{formatCurrency(job.commission_amount ?? defaultInstallerPay(order.installation_price, order.installer_commission_pct))}</Row>}
                  {job && <Row label="Job status"><span className="capitalize">{job.status.replace(/_/g, ' ')}{job.payout_id ? ' · paid' : ''}</span></Row>}
                </Section>
              )}

              {order.notes && (
                <Section icon={StickyNote} title="Notes">
                  <p className="whitespace-pre-wrap py-2 text-sm text-surface-700">{order.notes}</p>
                </Section>
              )}
            </div>

            {editable && onEdit && (
              <footer className="border-t border-surface-100 p-4">
                <button onClick={() => onEdit(order)} className="btn-primary flex h-11 w-full items-center justify-center gap-2 text-sm">
                  <Edit2 className="h-4 w-4" /> Edit order, money &amp; installer
                </button>
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
