import { useState, useEffect, useRef } from 'react'
import { LeadPicker } from '@/components/shared/LeadPicker'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { SdCardOption, sdCardsOf, mainProductsOf, SD_DEFAULT, type SdCardValue } from '@/components/shared/SdCardOption'
import { BranchPicker } from '@/components/shared/BranchPicker'
import { supabase } from '@/lib/supabase'
import { ShoppingBag, Search, Calendar, Check, X, ArrowRightLeft, Plus, MapPin, Package, User, Edit2, ChevronDown, Filter, Download, FileSpreadsheet, Share2 } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { exportToExcel, exportToCSV } from '@/utils/exportUtils'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { AssignInstallerModal } from '@/components/shared/AssignInstallerModal'
import { InstallerPicker, INSTALLER_NONE, type InstallerChoice } from '@/components/shared/InstallerPicker'
import { GuideTip } from '@/components/shared/GuideTip'
import { OrderDetailsDrawer } from '@/components/shared/OrderDetailsDrawer'
import { TableSkeleton } from '@/components/shared/Skeletons'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'
import type { Order, OrderStatus, Product, User as AppUser } from '@/types'

const getWhatsAppShareUrl = (order: Order) => {
  const dsaName = order.dsa?.full_name || order.unregistered_dsa_name || 'Direct / System'
  const text = `*OptiSmart Order Details*\n\n` +
    `*Order #:* ${order.order_number}\n` +
    `*Customer:* ${order.customer_name}\n` +
    `*Phone:* ${order.customer_phone || 'N/A'}\n` +
    `*Address:* ${order.customer_address || 'N/A'}\n` +
    `*Quantity:* ${order.quantity}\n` +
    `*Total Amount:* ₦${Number(order.total_amount).toLocaleString()}\n` +
    `*DSA Agent:* ${dsaName}\n` +
    `*Status:* ${order.status.toUpperCase()}\n` +
    `*Notes:* ${order.notes || 'None'}\n\n` +
    `_Sent via OptiSmart Portal_`

  let rawPhone = (order.customer_phone || '').replace(/\D/g, '')
  if (rawPhone.startsWith('0')) {
    rawPhone = '234' + rawPhone.slice(1)
  }

  if (rawPhone.length >= 10) {
    return `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(text)}`
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
}

/** Remitted / installation / delivery under the order total, only for what has been filled in. */
function MoneyLine({ order }: { order: Order }) {
  const parts = [
    order.amount_remitted != null && `Remitted ${formatCurrency(order.amount_remitted)}`,
    order.installation_needed && Number(order.installation_price) > 0 && `Install ${formatCurrency(order.installation_price)}`,
    Number(order.delivery_fee) > 0 && `Delivery ${formatCurrency(order.delivery_fee!)}`,
  ].filter(Boolean)
  if (!parts.length) return null
  return <p className="mt-0.5 text-[11px] text-surface-500">{parts.join(' · ')}</p>
}

export function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [assignedOrderIds, setAssignedOrderIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [dsas, setDsas] = useState<AppUser[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const [inventoryLocations, setInventoryLocations] = useState<any[]>([])
  const [locationInventory, setLocationInventory] = useState<any[]>([])
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null)
  const [deliveryLocationId, setDeliveryLocationId] = useState('')
  const [deliveryReason, setDeliveryReason] = useState('')
  const [sd, setSd] = useState<SdCardValue>(SD_DEFAULT)
  const [installers, setInstallers] = useState<{ id: string; full_name: string }[]>([])
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([])
  const [jobsByOrder, setJobsByOrder] = useState<Map<string, any>>(new Map())
  const [newInstaller, setNewInstaller] = useState<InstallerChoice>(INSTALLER_NONE)
  const [editInstaller, setEditInstaller] = useState<InstallerChoice>(INSTALLER_NONE)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [isBulkCleanupModalOpen, setIsBulkCleanupModalOpen] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const fetchSequence = useRef(0)
  const [dsaFilter, setDsaFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const [totalAll, setTotalAll] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const [editForm, setEditForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '', customer_address: '',
    product_id: '', quantity: 1, total_amount: 0, installation_needed: false,
    installation_price: 0, expected_delivery_date: '', notes: '',
    amount_remitted: '' as number | '', delivery_fee: 0, delivery_agent_id: '',
  })

  const [form, setForm] = useState({
    lead_id: '',
    is_dsa_registered: true,
    dsa_id: '',
    unregistered_dsa_name: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    product_id: '',
    fulfillment_location_id: '',
    quantity: 1,
    amount: 0,
    installation_needed: false,
    installation_price: 0,
    expected_delivery_date: '',
    notes: '',
  })

  // A simple mapping for the allowed status transitions in the lifecycle
  const allowedTransitions: Record<string, OrderStatus[]> = {
    pending: ['approved', 'delivered', 'cancelled'],
    paid: ['approved', 'delivered', 'cancelled'],
    approved: ['processing', 'delivered', 'cancelled'],
    confirmed: ['processing', 'delivered', 'cancelled'],
    processing: ['dispatched', 'delivered', 'cancelled'],
    dispatched: ['delivered', 'rescheduled', 'cancelled'],
    rescheduled: ['delivered', 'cancelled'],
    delivered: ['cancelled'],
    completed: ['cancelled'],
    cancelled: []
  }

  const PAGE_SIZE = 50
  const ORDER_SELECT = '*, dsa:users!orders_dsa_id_fkey(email, full_name)'
  const STATUS_ORDER = ['pending', 'paid', 'approved', 'confirmed', 'processing', 'dispatched', 'rescheduled', 'delivered', 'completed', 'cancelled']

  // Search, sales agent and (optionally) status are applied by the database, so only one page is downloaded.
  const withFilters = (q: any, includeStatus: boolean) => {
    if (includeStatus && statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (dsaFilter === 'unregistered') q = q.is('dsa_id', null)
    else if (dsaFilter !== 'all') q = q.eq('dsa_id', dsaFilter)
    const term = debouncedSearch.replace(/[%,()*]/g, ' ').trim()
    if (term) q = q.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,unregistered_dsa_name.ilike.%${term}%`)
    return q
  }

  const fetchOrders = async () => {
    const sequence = ++fetchSequence.current
    try {
      const from = page * PAGE_SIZE
      const head = () => supabase.from('orders').select('id', { count: 'exact', head: true })
      const [list, matching, total, ...perStatus] = await Promise.all([
        withFilters(supabase.from('orders').select(ORDER_SELECT, { count: 'exact' }), true)
          .order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1),
        withFilters(head(), false),
        head(),
        ...STATUS_ORDER.map(st => withFilters(head(), false).eq('status', st)),
      ])
      if (list.error) throw list.error
      if (sequence !== fetchSequence.current) return
      setOrders(list.data ?? [])
      setMatchCount(list.count ?? 0)
      setTotalAll(total.count ?? 0)
      setStatusCounts(Object.fromEntries([['all', matching.count ?? 0], ...STATUS_ORDER.map((st, i) => [st, perStatus[i].count ?? 0])]))
    } catch (err) {
      console.error('Error fetching admin orders:', err)
    } finally {
      if (sequence === fetchSequence.current) setLoading(false)
    }
  }

  const fetchLookups = async () => {
    try {
      const [productsRes, dsasRes, jobsRes, locationsRes, inventoryRes, installersRes, agentsRes, leadsRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('users').select('*').in('role', ['dsa', 'admin', 'super_admin']).eq('status', 'active'),
        supabase.from('installer_jobs').select('id, order_id, installer_id, commission_amount, status, payout_id'),
        supabase.from('inventory_locations').select('id, name, address').eq('is_active', true).order('name'),
        supabase.from('product_inventory').select('product_id, location_id, quantity'),
        supabase.from('users').select('id, full_name').eq('role', 'installer').eq('status', 'active').order('full_name'),
        supabase.from('delivery_agents').select('id, full_name').eq('is_active', true).order('full_name'),
        supabase.from('leads').select('id,customer_name,phone,email,location,status,dsa_id,source,created_at').not('status', 'in', '(converted,lost)').order('created_at', { ascending: false }).limit(1000),
      ])
      setProducts(productsRes.data ?? [])
      setDsas(dsasRes.data ?? [])
      setAssignedOrderIds(new Set((jobsRes.data ?? []).map(j => j.order_id)))
      setJobsByOrder(new Map((jobsRes.data ?? []).map(j => [j.order_id, j])))
      setInventoryLocations(locationsRes.data ?? [])
      setLocationInventory(inventoryRes.data ?? [])
      setInstallers(installersRes.data ?? [])
      setAgents(agentsRes.data ?? [])
      setLeads(leadsRes.data ?? [])
    } catch (err) {
      console.error('Error fetching order lookups:', err)
    }
  }

  const fetchData = () => Promise.all([fetchOrders(), fetchLookups()])
  const refresh = useRef(fetchData)
  refresh.current = fetchData

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(0) }, [statusFilter, dsaFilter, debouncedSearch])
  useEffect(() => { fetchOrders() }, [page, statusFilter, dsaFilter, debouncedSearch])

  useEffect(() => {
    fetchLookups()

    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => refresh.current())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const updatedOrder = payload.new as Order
        setOrders(current => current.map(order => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, payload => {
        const deletedOrder = payload.old as Pick<Order, 'id'>
        setOrders(current => current.filter(order => order.id !== deletedOrder.id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'installer_jobs' }, () => fetchLookups())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    const leadId = searchParams.get('lead')
    if (!leadId || !leads.length) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    setForm(f => ({ ...f, lead_id: lead.id, dsa_id: lead.dsa_id || '', customer_name: lead.customer_name, customer_phone: lead.phone, customer_email: lead.email || '', customer_address: lead.location || '' }))
    setIsModalOpen(true)
  }, [leads, searchParams])

  const chooseLead = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    setForm(f => lead
      ? ({ ...f, lead_id: lead.id, is_dsa_registered: true, dsa_id: lead.dsa_id || '', customer_name: lead.customer_name, customer_phone: lead.phone, customer_email: lead.email || '', customer_address: lead.location || '' })
      : ({ ...f, lead_id: '', customer_name: '', customer_phone: '', customer_email: '', customer_address: '' }))
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!form.product_id) {
      setCreateError('Select a product before creating the order.')
      return
    }

    setSubmitting(true)
    try {
      const product = products.find(p => p.id === form.product_id)
      if (!product) throw new Error('Product not found')

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
      const productTotal = Number(product.retail_price) * form.quantity
      const sdCard = sdCardsOf(products).find(c => c.id === sd.productId)
      const sdQty = sd.enabled && sdCard ? sd.quantity : 0
      const sdPrice = sd.enabled && sd.charge && sdCard ? Number(sdCard.retail_price) : 0
      const totalAmount = productTotal + (form.installation_needed ? form.installation_price : 0) + sdQty * sdPrice

      const { data, error } = await supabase
        .from('orders')
        .insert([{
          lead_id: form.lead_id || null,
          order_number: orderNumber,
          dsa_id: form.is_dsa_registered ? (form.dsa_id || null) : null,
          unregistered_dsa_name: !form.is_dsa_registered ? form.unregistered_dsa_name : null,
          customer_name: form.customer_name,
          customer_email: form.customer_email || null,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          product_id: form.product_id,
          quantity: form.quantity,
          unit_price: product.retail_price,
          unit_cost: product.cost_price || 0,
          total_amount: totalAmount,
          accessory_product_id: sdQty > 0 ? sdCard?.id : null,
          accessory_quantity: sdQty,
          accessory_price: sdPrice,
          installation_needed: form.installation_needed,
          installation_price: form.installation_needed ? form.installation_price : 0,
          expected_delivery_date: form.expected_delivery_date || null,
          status: 'pending',
          notes: form.notes,
          fulfillment_location_id: form.fulfillment_location_id || null,
          created_by_auth_id: (await supabase.auth.getSession()).data.session?.user?.id
        }])
        .select()
        .single()

      if (error) throw error
      if (data && form.installation_needed && newInstaller.installerId) {
        const { error: jobError } = await supabase.rpc('set_order_installer', {
          p_order_id: data.id, p_installer_id: newInstaller.installerId, p_amount: newInstaller.pay === '' ? null : newInstaller.pay,
        })
        if (jobError) alert(`Order created, but the installer was not assigned: ${jobError.message}`)
        else fetchData()
      }
      if (data) {
        if (form.customer_email) {
          sendEmail('new_order', {
            recipientEmail: form.customer_email,
            orderNumber: data.order_number,
            customerName: data.customer_name,
            totalAmount: data.total_amount
          }).catch(console.error);
        }

        const createdOrder = {
          ...data,
          dsa: form.dsa_id
            ? dsas.find(dsa => dsa.id === form.dsa_id)
            : undefined,
        } as Order
        setOrders(current => [createdOrder, ...current])
        setIsModalOpen(false)
        setSearchParams({}, { replace: true })
        setSd(SD_DEFAULT)
        setNewInstaller(INSTALLER_NONE)
        setForm({ lead_id: '', is_dsa_registered: true, unregistered_dsa_name: '', dsa_id: '', customer_name: '', customer_email: '', customer_phone: '', customer_address: '', product_id: '', fulfillment_location_id: '', quantity: 1, amount: 0, installation_needed: false, installation_price: 0, expected_delivery_date: '', notes: '' })
      }
    } catch (err: any) {
      console.error('Error creating order:', err)
      setCreateError(err?.message || 'Failed to create order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    fulfillmentLocationId?: string
  ) => {
    const selectedOrder = orders.find(order => order.id === orderId)
    if (newStatus === 'delivered' && fulfillmentLocationId === undefined) {
      setDeliveryOrder(selectedOrder ?? null)
      setDeliveryLocationId((selectedOrder as any)?.fulfillment_location_id || '')
      setDeliveryReason('')
      setOpenDropdownId(null)
      return
    }
    const wasDelivered = ['delivered', 'completed'].includes(selectedOrder?.status || '')
    if (wasDelivered && newStatus === 'cancelled') {
      const reason = window.prompt(`Cancel delivered order ${selectedOrder?.order_number}? Its stock goes back to the branch it left from and any unpaid commission is cancelled.\n\nReason:`)
      if (reason === null) return
      setUpdating(orderId)
      const { error } = await supabase.rpc('return_delivered_order', { p_order_id: orderId, p_restock: true, p_reason: reason || 'Cancelled after delivery', p_new_status: 'cancelled' })
      setUpdating(null)
      if (error) { alert(error.message); return }
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
      fetchData()
      return
    }
    setUpdating(orderId)
    try {
      let error: any = null
      if (newStatus === 'delivered') {
        // Stock leaves the chosen branch in the same database transaction (or the delivery is recorded as
        // untracked with a reason when no branch has the stock). The database refuses any other way.
        const rpcRes = await supabase.rpc('fulfill_order', fulfillmentLocationId
          ? { p_order_id: orderId, p_location_id: fulfillmentLocationId }
          : { p_order_id: orderId, p_untracked: true, p_reason: deliveryReason || 'No branch had stock' })
        error = rpcRes.error
      } else {
        const updateRes = await supabase
          .from('orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', orderId)
        error = updateRes.error
      }

      if (error) throw error

      const updatedOrder = selectedOrder

      // Send Notifications to DSA
      if (updatedOrder?.dsa_id) {
        const dsa = (updatedOrder as any).dsa;
        if (dsa?.email) {
          sendEmail('order_status_update', {
            recipientEmail: dsa.email,
            customerName: updatedOrder.customer_name,
            orderNumber: updatedOrder.order_number,
            status: newStatus
          }).catch(console.error);
        }
        // The DSA's notification (bell + push) is created by the database on every status change.
      }

      // Send Notification to Customer
      if (updatedOrder?.customer_email) {
        sendEmail('order_status_update', {
          recipientEmail: updatedOrder.customer_email,
          customerName: updatedOrder.customer_name,
          orderNumber: updatedOrder.order_number,
          status: newStatus
        }).catch(console.error);
      }

      // The commission (and the DSA's in-app notification) are created by the database on delivery.

      // Update local state
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
      if (newStatus === 'delivered') {
        setDeliveryOrder(null)
        setDeliveryLocationId('')
        fetchData()
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      alert((err as any)?.message || 'Failed to update order status')
    } finally {
      setUpdating(null)
    }
  }

  const openEditModal = (order: Order) => {
    setEditingOrder(order)
    setEditForm({
      customer_name: order.customer_name, customer_email: order.customer_email || '',
      customer_phone: order.customer_phone, customer_address: order.customer_address,
      product_id: order.product_id, quantity: order.quantity, total_amount: order.total_amount,
      installation_needed: order.installation_needed, installation_price: order.installation_price,
      expected_delivery_date: order.expected_delivery_date || '', notes: order.notes || '',
      amount_remitted: order.amount_remitted ?? '', delivery_fee: Number(order.delivery_fee || 0), delivery_agent_id: order.delivery_agent_id || '',
    })
    const job = jobsByOrder.get(order.id)
    setEditInstaller(job ? { installerId: job.installer_id, pay: job.commission_amount ?? '' } : INSTALLER_NONE)
    setIsEditModalOpen(true)
  }

  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return
    setSubmitting(true)
    try {
      const product = products.find(item => item.id === editForm.product_id)
      if (!product) throw new Error('Select a valid product.')
      const { data, error } = await supabase.from('orders').update({
        customer_name: editForm.customer_name, customer_email: editForm.customer_email || null,
        customer_phone: editForm.customer_phone, customer_address: editForm.customer_address,
        product_id: editForm.product_id, quantity: editForm.quantity, unit_price: product.retail_price, unit_cost: product.cost_price || 0,
        total_amount: editForm.total_amount, installation_needed: editForm.installation_needed,
        installation_price: editForm.installation_needed ? editForm.installation_price : 0,
        expected_delivery_date: editForm.expected_delivery_date || null, notes: editForm.notes,
        amount_remitted: editForm.amount_remitted === '' ? null : editForm.amount_remitted,
        remitted_at: editForm.amount_remitted === '' ? null : (editingOrder.remitted_at || new Date().toISOString()),
        delivery_fee: editForm.delivery_fee || 0,
        delivery_agent_id: editForm.delivery_agent_id || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingOrder.id).select().single()
      if (error) throw error
      // Installer: assign, change, or remove (when installation was unticked).
      const job = jobsByOrder.get(editingOrder.id)
      const wantInstaller = editForm.installation_needed ? editInstaller.installerId : ''
      const wantPay = editInstaller.pay === '' ? null : editInstaller.pay
      if (!job?.payout_id && (wantInstaller !== (job?.installer_id || '') || (wantInstaller && wantPay !== (job?.commission_amount ?? null)))) {
        const { error: jobError } = await supabase.rpc('set_order_installer', {
          p_order_id: editingOrder.id, p_installer_id: wantInstaller || null, p_amount: wantPay,
        })
        if (jobError) throw new Error(`Order saved, but the installer was not updated: ${jobError.message}`)
        fetchData()
      }
      if (data) {
        setOrders(current => current.map(order => order.id === editingOrder.id ? { ...order, ...data } : order))
        setIsEditModalOpen(false)
        setEditingOrder(null)
      }
    } catch (err) {
      console.error('Failed to edit order:', err)
      alert(err instanceof Error ? err.message : 'Failed to save order changes.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Permanently delete this cancelled order?')) return
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId)
      if (error) throw error
      setOrders(orders.filter(o => o.id !== orderId))
    } catch (err) {
      console.error('Failed to delete order:', err)
      alert('Failed to delete order')
    }
  }

  const [menuPos, setMenuPos] = useState<{ top: number; right: number; up: boolean } | null>(null)
  const [viewOrder, setViewOrder] = useState<Order | null>(null)

  const filteredOrders = orders
  const filtersOn = search !== '' || statusFilter !== 'all' || dsaFilter !== 'all'
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setDsaFilter('all') }
  const pageFrom = page * PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(matchCount / PAGE_SIZE))

  // Exports cover every matching order, not just this page (fetched in chunks of 1000).
  const fetchAllMatching = async () => {
    const rows: Order[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await withFilters(supabase.from('orders').select(ORDER_SELECT), true)
        .order('created_at', { ascending: false }).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }
  const runExport = async (kind: 'excel' | 'csv') => {
    setExporting(true)
    try {
      const data = getOrdersExportData(await fetchAllMatching())
      if (kind === 'excel') exportToExcel({ filename: 'optismart-system-orders', sheetTitle: 'System Orders', reportSubHeading: `Status Filter: ${statusFilter.toUpperCase()} | Total Orders: ${data.length}`, data })
      else exportToCSV(data, 'optismart-system-orders')
    } catch (err: any) {
      alert(`Export failed: ${err?.message || err}`)
    } finally {
      setExporting(false)
    }
  }

  const getOrdersExportData = (rows: Order[]) => {
    return rows.map(o => ({
      'Order Number': o.order_number,
      'Date': formatDate(o.created_at),
      'Customer Name': o.customer_name,
      'Email': o.customer_email || '—',
      'Phone': o.customer_phone || '—',
      'Address': o.customer_address || '—',
      'Product': (o as any).product?.name || 'Camera',
      'Quantity': o.quantity,
      'Total Amount (₦)': o.total_amount,
      'Remitted (₦)': o.amount_remitted ?? '',
      'Installation Fee (₦)': o.installation_price || 0,
      'Delivery Fee (₦)': o.delivery_fee || 0,
      'Status': o.status,
      'DSA': (o as any).dsa?.full_name || o.unregistered_dsa_name || 'System',
      'Expected Delivery': o.expected_delivery_date || '—',
      'Notes': o.notes || ''
    }))
  }

  return (
    <div className="space-y-6">
      <GuideTip guideKey="money" />
      <OrderDetailsDrawer
        order={viewOrder ? (orders.find(o => o.id === viewOrder.id) || viewOrder) : null}
        onClose={() => setViewOrder(null)}
        onEdit={o => { setViewOrder(null); openEditModal(o) }}
        products={products}
        branches={inventoryLocations}
        installers={installers}
        agents={agents}
        job={viewOrder ? jobsByOrder.get(viewOrder.id) : undefined}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-surface-900">
            Orders <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-sm font-bold text-surface-600">{totalAll}</span>
          </h1>
          <p className="mt-1 text-sm text-surface-500">Every order, its money and where it is in delivery.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => runExport('excel')} disabled={exporting}
            className="btn-outline flex h-10 items-center gap-1.5 px-3 text-sm disabled:opacity-50" title="Export every matching order to Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={() => runExport('csv')} disabled={exporting}
            className="btn-outline flex h-10 items-center gap-1.5 px-3 text-sm disabled:opacity-50" title="Download every matching order as CSV">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex h-10 items-center gap-1.5 px-4 text-sm">
            <Plus className="h-4 w-4" /> New order
          </button>
        </div>
      </div>

      <div className="glass-card space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input type="text" placeholder="Search order number, customer or phone…" value={search}
              onChange={e => setSearch(e.target.value)} className="input h-10 w-full pl-9 text-sm" />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-surface-400 hover:text-surface-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className={`relative sm:w-64 ${searchParams.get('highlight') === 'dsa-filter' ? 'animate-feature-glow rounded-xl' : ''}`}>
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <select value={dsaFilter} onChange={e => setDsaFilter(e.target.value)} className="input h-10 w-full truncate pl-9 text-sm">
              <option value="all">All sales agents</option>
              <option value="unregistered">Unregistered / direct</option>
              {dsas.map(dsa => <option key={dsa.id} value={dsa.id}>{dsa.full_name || dsa.email}</option>)}
            </select>
          </div>
        </div>
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Filter className="h-3.5 w-3.5 shrink-0 text-surface-400" />
          {['all', ...STATUS_ORDER].filter(st => st === 'all' || statusCounts[st] || statusFilter === st).map(st => (
            <button key={st} onClick={() => setStatusFilter(st)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${statusFilter === st ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'}`}>
              {st === 'all' ? 'All' : st} <span className={statusFilter === st ? 'text-brand-500' : 'text-surface-400'}>{statusCounts[st] || 0}</span>
            </button>
          ))}
          {filtersOn && (
            <button onClick={clearFilters} className="ml-auto shrink-0 px-2 text-xs font-semibold text-surface-500 hover:text-surface-800">Clear filters</button>
          )}
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">{totalAll ? 'No orders match these filters' : 'No orders yet'}</h3>
          <p className="text-surface-500 max-w-md">{totalAll ? `There are ${totalAll} orders in total.` : 'Orders will appear here as soon as they are placed.'}</p>
          {filtersOn && <button onClick={clearFilters} className="btn-outline mt-4 h-9 px-4 text-sm">Clear filters</button>}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {filtersOn && (
            <p className="border-b border-surface-100 px-4 py-2 text-xs text-surface-500"><strong className="text-surface-800">{matchCount}</strong> of {totalAll} orders match</p>
          )}
          <div className="hidden max-h-[72vh] overflow-auto md:block" onScroll={() => openDropdownId && (setOpenDropdownId(null), setMenuPos(null))}>
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-surface-500">
                  <th className="sticky left-0 top-0 z-30 border-b border-surface-200 bg-surface-50 px-4 py-3">Order</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Customer</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Amount</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3">Status</th>
                  <th className="sticky top-0 z-20 border-b border-surface-200 bg-surface-50 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredOrders.map(order => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setViewOrder(order)}
                      className="group cursor-pointer transition-colors hover:bg-surface-50 [&>td]:border-b [&>td]:border-surface-100"
                    >
                      <td className="sticky left-0 z-10 bg-white py-3 px-4 group-hover:bg-surface-50">
                        <p className="text-sm font-bold text-brand-600">{order.order_number}</p>
                        <p className="text-[10px] text-surface-500 font-medium uppercase tracking-wide mt-0.5">
                          By: {order.dsa?.full_name || order.unregistered_dsa_name || 'System'}
                        </p>
                        <p className="text-xs text-surface-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> {formatDate(order.created_at)}
                        </p>
                        {order.installation_needed && (
                          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${assignedOrderIds.has(order.id) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                            {assignedOrderIds.has(order.id) ? 'Installer assigned' : 'Needs installer'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-bold text-surface-900">{order.customer_name}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{order.customer_phone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-bold text-surface-900">{formatCurrency(order.total_amount)}</p>
                        <p className="text-xs text-surface-500 mt-0.5">Qty: {order.quantity}</p>
                        <MoneyLine order={order} />
                      </td>
                      <td className="py-3 px-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          {updating === order.id ? (
                            <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin ml-auto" />
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const r = e.currentTarget.getBoundingClientRect()
                                  setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right, up: r.bottom + 300 > window.innerHeight })
                                  setOpenDropdownId(openDropdownId === order.id ? null : order.id)
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-surface-50 border-surface-200 text-surface-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition-all cursor-pointer shadow-xs active:scale-95"
                              >
                                <span>Actions</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdownId === order.id ? 'rotate-180 text-brand-600' : ''}`} />
                              </button>

                              {openDropdownId === order.id && menuPos && createPortal(
                                <>
                                  {/* Backdrop overlay */}
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenDropdownId(null)
                                    }}
                                  />

                                  {/* Dropdown Menu */}
                                  <div style={menuPos.up ? { bottom: window.innerHeight - menuPos.top + 36, right: menuPos.right } : { top: menuPos.top, right: menuPos.right }}
                                    className="fixed z-50 w-52 rounded-xl bg-white border border-surface-200 shadow-xl py-1 flex flex-col text-left divide-y divide-surface-100 animate-fade-up">
                                    <div className="py-1">
                                      {order.status !== 'cancelled' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenDropdownId(null)
                                            openEditModal(order)
                                          }}
                                          className="w-full px-3.5 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50 hover:text-brand-600 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                          <Edit2 className="w-3.5 h-3.5 text-brand-500" /> Edit Order
                                        </button>
                                      )}
                                      {(allowedTransitions[order.status] ?? []).map(nextStatus => (
                                        <button
                                          type="button"
                                          key={nextStatus}
                                          onClick={() => {
                                            setOpenDropdownId(null)
                                            handleUpdateStatus(order.id, nextStatus)
                                          }}
                                          className={`w-full px-3.5 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                                            nextStatus === 'cancelled'
                                              ? 'text-danger-600 hover:bg-danger-50'
                                              : nextStatus === 'delivered'
                                                ? 'text-success-700 hover:bg-success-50'
                                                : 'text-brand-700 hover:bg-brand-50'
                                          }`}
                                        >
                                          {nextStatus === 'cancelled' ? <X className="w-3.5 h-3.5 text-danger-500" /> : <Check className="w-3.5 h-3.5 text-success-500" />}
                                          Mark {nextStatus}
                                        </button>
                                      ))}
                                    </div>

                                     <div className="py-1 border-t border-surface-100">
                                       <a
                                         href={getWhatsAppShareUrl(order)}
                                         target="_blank"
                                         rel="noopener noreferrer"
                                         onClick={() => setOpenDropdownId(null)}
                                         className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors cursor-pointer"
                                       >
                                         <Share2 className="w-3.5 h-3.5 text-emerald-600" /> Export to WhatsApp
                                       </a>
                                     </div>

                                    {((order.installation_needed && !assignedOrderIds.has(order.id)) || order.status === 'cancelled') && (
                                      <div className="py-1">
                                        {order.installation_needed && !assignedOrderIds.has(order.id) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenDropdownId(null)
                                              setAssigningOrderId(order.id)
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            Assign Installer
                                          </button>
                                        )}
                                        {order.status === 'cancelled' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenDropdownId(null)
                                              handleDeleteOrder(order.id)
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-danger-600 hover:bg-danger-50 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5 text-danger-500" /> Delete Order
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </>,
                                document.body
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-surface-100">
            <AnimatePresence>
              {filteredOrders.map(order => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-4 flex flex-col gap-3"
                >
                  <div className="flex cursor-pointer items-start justify-between" onClick={() => setViewOrder(order)}>
                    <div>
                      <p className="text-sm font-bold text-brand-600">{order.order_number}</p>
                      <p className="text-sm font-medium text-surface-900 mt-1">{order.customer_name}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{order.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-900">{formatCurrency(order.total_amount)}</p>
                      <p className="text-xs text-surface-500 mt-0.5">Qty: {order.quantity}</p>
                      <MoneyLine order={order} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-surface-50 pt-3">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-xs text-surface-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(order.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    {updating === order.id ? (
                      <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                    ) : (
                      <>
                        {order.status !== 'cancelled' && (
                          <button
                            onClick={() => openEditModal(order)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-surface-50 border-surface-200 text-surface-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 transition-colors flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {(allowedTransitions[order.status] ?? []).map(nextStatus => (
                          <button
                            key={nextStatus}
                            onClick={() => handleUpdateStatus(order.id, nextStatus)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                              nextStatus === 'cancelled'
                                ? 'bg-white border-surface-200 text-danger-600 hover:border-danger-200 hover:bg-danger-50'
                                : nextStatus === 'delivered'
                                  ? 'bg-success-50 border-success-200 text-success-700 hover:bg-success-100'
                                  : 'bg-white border-surface-200 text-brand-600 hover:border-brand-200 hover:bg-brand-50'
                            }`}
                          >
                            {nextStatus === 'cancelled' ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                            Mark {nextStatus}
                          </button>
                        ))}
                      </>
                    )}
                    {order.installation_needed && !assignedOrderIds.has(order.id) && !updating && (
                      <button
                        onClick={() => setAssigningOrderId(order.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors flex items-center gap-1"
                      >
                        Assign Installer
                      </button>
                    )}
                    {order.status === 'cancelled' && !updating && (
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-danger-50 border-danger-200 text-danger-600 hover:bg-danger-100 transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-surface-100 px-4 py-3 text-sm">
            <span className="text-surface-500">{pageFrom + 1}–{Math.min(pageFrom + PAGE_SIZE, matchCount)} of <strong className="text-surface-800">{matchCount}</strong></span>
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-outline h-9 px-3 text-sm disabled:opacity-40">Previous</button>
              <span className="hidden text-xs text-surface-500 sm:inline">Page {page + 1} of {pageCount}</span>
              <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} className="btn-outline h-9 px-3 text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}

        <AssignInstallerModal
          isOpen={!!assigningOrderId}
          onClose={() => setAssigningOrderId(null)}
          onSuccess={() => {
            if (assigningOrderId) setAssignedOrderIds(prev => new Set([...prev, assigningOrderId]))
            fetchData()
          }}
          order={orders.find(o => o.id === assigningOrderId) || null}
        />

      {/* EDIT ORDER MODAL */}
      {createPortal(
        <AnimatePresence>
        {isEditModalOpen && editingOrder && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              key="edit-order-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
              onClick={() => !submitting && setIsEditModalOpen(false)}
            />
            <motion.div
              key="edit-order-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-card-xl w-full max-w-lg relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50/50">
                <div>
                  <h2 className="text-lg font-bold text-surface-900">Edit Order</h2>
                  <p className="text-xs text-surface-500 mt-0.5">{editingOrder.order_number}</p>
                </div>
                <button onClick={() => !submitting && setIsEditModalOpen(false)} className="text-surface-400 hover:text-surface-900 transition-colors p-1 rounded-md hover:bg-surface-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditOrder} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1">

                  <div>
                    <label className="label">Customer Name *</label>
                    <input required type="text" className="input" value={editForm.customer_name} onChange={e => setEditForm({...editForm, customer_name: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Customer Phone *</label>
                      <input required type="tel" className="input" value={editForm.customer_phone} onChange={e => setEditForm({...editForm, customer_phone: e.target.value.replace(/[^\d+]/g, '')})} />
                    </div>
                    <div>
                      <label className="label">Customer Email</label>
                      <input type="email" className="input" value={editForm.customer_email} onChange={e => setEditForm({...editForm, customer_email: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="label">Delivery Address *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-surface-400" />
                      <textarea required rows={2} className="input pl-10" value={editForm.customer_address} onChange={e => setEditForm({...editForm, customer_address: e.target.value})} />
                    </div>
                  </div>

                  <div className="border-t border-surface-100 pt-4">
                    <label className="label">Product *</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                      <select required className="input pl-10" disabled={['delivered', 'completed'].includes(editingOrder.status)} value={editForm.product_id} onChange={e => {
                        const p = products.find(prod => prod.id === e.target.value)
                        setEditForm({...editForm, product_id: e.target.value, total_amount: p ? p.retail_price * editForm.quantity : editForm.total_amount})
                      }}>
                        <option value="">Select a product</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.retail_price)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Quantity *</label>
                      <input required type="number" min={1} className="input" disabled={['delivered', 'completed'].includes(editingOrder.status)} value={editForm.quantity} onChange={e => {
                        const qty = parseInt(e.target.value) || 1
                        const p = products.find(prod => prod.id === editForm.product_id)
                        setEditForm({...editForm, quantity: qty, total_amount: p ? p.retail_price * qty : editForm.total_amount})
                      }} />
                    </div>
                    <div>
                      <label className="label">Total Amount (₦) *</label>
                      <input required type="number" min={0} className="input" value={editForm.total_amount} onChange={e => setEditForm({...editForm, total_amount: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div className="border-t border-surface-100 pt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        id="edit_install_needed"
                        checked={editForm.installation_needed}
                        onChange={e => setEditForm({...editForm, installation_needed: e.target.checked})}
                        className="w-5 h-5 rounded border-surface-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <label htmlFor="edit_install_needed" className="label mb-0 cursor-pointer">Installation Needed</label>
                    </div>
                    {editForm.installation_needed && (
                      <div className="space-y-3">
                        <div>
                          <label className="label">Installation fee (₦)</label>
                          <input type="number" min={0} className="input" value={editForm.installation_price} onChange={e => setEditForm({...editForm, installation_price: Number(e.target.value)})} />
                        </div>
                        <InstallerPicker installers={installers} fee={editForm.installation_price} pct={editingOrder.installer_commission_pct}
                          value={editInstaller} onChange={setEditInstaller} locked={!!jobsByOrder.get(editingOrder.id)?.payout_id} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-surface-100 pt-4">
                    <p className="label mb-2">Money</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label">Amount remitted (₦)</label>
                        <input type="number" min={0} className="input" placeholder="Not remitted yet" value={editForm.amount_remitted}
                          onChange={e => setEditForm({...editForm, amount_remitted: e.target.value === '' ? '' : Number(e.target.value)})} />
                        <p className="mt-1 text-[11px] text-surface-500">What the delivery agent handed back. Order total is {formatCurrency(editForm.total_amount)}.</p>
                      </div>
                      <div>
                        <label className="label">Delivery fee (₦)</label>
                        <input type="number" min={0} className="input" value={editForm.delivery_fee}
                          onChange={e => setEditForm({...editForm, delivery_fee: Number(e.target.value)})} />
                        <p className="mt-1 text-[11px] text-surface-500">What we paid for delivery.</p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Delivered by</label>
                        <select className="input" value={editForm.delivery_agent_id} onChange={e => setEditForm({...editForm, delivery_agent_id: e.target.value})}>
                          <option value="">Not set</option>
                          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                        </select>
                        {agents.length === 0 && <p className="mt-1 text-[11px] text-surface-500">No delivery agents yet. Add them from <a href="/app/admin/delivery-agents" className="font-semibold text-brand-600">Delivery agents</a>.</p>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label">Expected Delivery Date</label>
                    <input type="date" className="input" value={editForm.expected_delivery_date} onChange={e => setEditForm({...editForm, expected_delivery_date: e.target.value})} />
                  </div>

                  <div>
                    <label className="label">Notes</label>
                    <textarea rows={2} className="input resize-none" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                  </div>

                </div>
                <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-surface-100 bg-white shrink-0">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} disabled={submitting} className="btn-outline">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary w-36 flex items-center justify-center">
                    {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.getElementById('modal-root') || document.body
      )}

      {/* CREATE ORDER MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm"
              onClick={() => !submitting && setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-card-xl sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-surface-100 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4">
                <div>
                  <h2 className="text-lg font-bold text-surface-900">New order</h2>
                  <p className="text-xs text-surface-500">Customer, product, then delivery</p>
                </div>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="text-surface-400 hover:text-surface-900 transition-colors p-1 rounded-md hover:bg-surface-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                <SectionTitle n={1}>Customer</SectionTitle>
                <div>
                  <LeadPicker leads={leads} value={form.lead_id} onChange={chooseLead} title="all open leads" ownerName={(id: string | null | undefined) => dsas.find(d => d.id === id)?.full_name} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">DSA In Charge (Optional)</label>
                    <label className="flex items-center gap-2 text-xs font-medium text-surface-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!form.is_dsa_registered}
                        onChange={e => setForm({...form, is_dsa_registered: !e.target.checked})}
                        className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                      />
                      Unregistered / External Agent
                    </label>
                  </div>

                  {form.is_dsa_registered ? (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                      <select className="input pl-10" value={form.dsa_id} onChange={e => setForm({...form, dsa_id: e.target.value})}>
                        <option value="">No DSA / System order</option>
                        {dsas.map(dsa => (
                          <option key={dsa.id} value={dsa.id}>{dsa.full_name} ({dsa.email})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <input
                      required
                      type="text"
                      className="input"
                      placeholder="Type the full name of the agent"
                      value={form.unregistered_dsa_name}
                      onChange={e => setForm({...form, unregistered_dsa_name: e.target.value})}
                    />
                  )}
                </div>

                <div>
                  <label className="label">Customer Name *</label>
                  <input required readOnly={Boolean(form.lead_id)} type="text" className="input read-only:bg-surface-50" placeholder="e.g. John Smith" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} />
                </div>

                <div>
                  <label className="label">Customer Phone *</label>
                  <input required readOnly={Boolean(form.lead_id)} type="tel" className="input read-only:bg-surface-50" placeholder="080..." value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value.replace(/[^\d+]/g, '')})} />
                </div>

                <div>
                  <label className="label">Customer Email (Optional)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                    <input type="email" className="input pl-10" placeholder="customer@example.com" value={form.customer_email} onChange={e => setForm({...form, customer_email: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="label">Delivery Address *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-surface-400" />
                    <textarea required rows={2} className="input pl-10" placeholder="Full delivery address" value={form.customer_address} onChange={e => setForm({...form, customer_address: e.target.value})} />
                  </div>
                </div>

                <SectionTitle n={2}>Product</SectionTitle>
                <div>
                  <label className="label">Select Model / Product *</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                    <select required className="input pl-10" value={form.product_id} onChange={e => {
                      const pId = e.target.value
                      const p = products.find(prod => prod.id === pId)
                      setForm({...form, product_id: pId, amount: p ? p.retail_price * form.quantity : 0})
                    }}>
                      <option value="">Select a product model</option>
                      {mainProductsOf(products).map(p => (
                        <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.retail_price)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <BranchPicker productId={form.product_id} quantity={form.quantity} branches={inventoryLocations} stock={locationInventory}
                  value={form.fulfillment_location_id} onChange={id => setForm(f => ({ ...f, fulfillment_location_id: id }))} />
                {form.product_id && <SdCardOption sdCards={sdCardsOf(products)} cameraQuantity={form.quantity} branchId={form.fulfillment_location_id}
                  stock={locationInventory} value={sd} onChange={setSd} />}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Quantity *</label>
                    <input required type="number" min={1} className="input" value={form.quantity} onChange={e => {
                      const qty = parseInt(e.target.value) || 1
                      const p = products.find(prod => prod.id === form.product_id)
                      setForm({...form, quantity: qty, amount: p ? p.retail_price * qty : form.amount})
                    }} />
                  </div>
                  <div>
                    <label className="label">Product Amount (₦)</label>
                    <div className="input bg-surface-50 font-bold text-surface-900">{formatCurrency(Number(products.find(p => p.id === form.product_id)?.retail_price || 0) * form.quantity)}</div>
                  </div>
                </div>

                <SectionTitle n={3}>Delivery &amp; installation</SectionTitle>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="install_needed_admin"
                      checked={form.installation_needed}
                      onChange={e => setForm({...form, installation_needed: e.target.checked})}
                      className="w-5 h-5 rounded border-surface-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <label htmlFor="install_needed_admin" className="label mb-0 cursor-pointer">Yes, Installation is Needed</label>
                  </div>

                  {form.installation_needed && (
                    <div className="mb-4 space-y-3">
                      <div>
                        <label className="label">Installation fee (₦) *</label>
                        <input required type="number" min={0} className="input" value={form.installation_price} onChange={e => setForm({...form, installation_price: Number(e.target.value)})} />
                      </div>
                      <InstallerPicker installers={installers} fee={form.installation_price} value={newInstaller} onChange={setNewInstaller} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Expected Delivery Date</label>
                  <input type="date" className="input" value={form.expected_delivery_date} onChange={e => setForm({...form, expected_delivery_date: e.target.value})} />
                </div>

                <div>
                  <label className="label">Additional Notes</label>
                  <textarea rows={2} className="input resize-none" placeholder="Special instructions?" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>

                {createError && (
                  <div role="alert" className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-700">
                    {createError}
                  </div>
                )}

              </div>
              <div className="shrink-0 border-t border-surface-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
                <div className="mb-3 flex items-baseline justify-between text-sm">
                  <span className="text-surface-500">Order total{form.installation_needed ? ' (incl. installation)' : ''}</span>
                  <span className="text-lg font-extrabold text-surface-900">{formatCurrency(Number(products.find(p => p.id === form.product_id)?.retail_price || 0) * form.quantity + (form.installation_needed ? Number(form.installation_price || 0) : 0))}</span>
                </div>
                <div className="flex items-center gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting} className="btn-outline flex-1 sm:flex-none">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex flex-[2] items-center justify-center sm:w-40 sm:flex-none">
                  {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm order'}
                </button>
                </div>
              </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {deliveryOrder && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
              <motion.button
                type="button"
                aria-label="Close fulfillment dialog"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm"
                onClick={() => !updating && setDeliveryOrder(null)}
              />
              <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-surface-900">Choose fulfillment location</h2>
                    <p className="mt-1 text-sm text-surface-500">Order {deliveryOrder.order_number} needs {deliveryOrder.quantity || 1} unit(s).</p>
                  </div>
                  <button type="button" onClick={() => setDeliveryOrder(null)} className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700"><X className="h-5 w-5" /></button>
                </div>

                {(() => {
                  const hasStock = inventoryLocations.some(loc =>
                    Number(locationInventory.find(i => i.location_id === loc.id && i.product_id === deliveryOrder.product_id)?.quantity || 0)
                    >= (deliveryOrder.quantity || 1)
                  )
                  return hasStock ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold text-surface-700">Select Branch Inventory Location:</p>
                      {inventoryLocations.map(location => {
                        const available = Number(locationInventory.find(item => item.location_id === location.id && item.product_id === deliveryOrder.product_id)?.quantity || 0)
                        const enough = available >= (deliveryOrder.quantity || 1)
                        return (
                          <label key={location.id} className={`flex items-center justify-between rounded-xl border p-3 ${enough ? 'cursor-pointer border-surface-200 hover:border-brand-300' : 'cursor-not-allowed border-surface-100 bg-surface-50 opacity-60'}`}>
                            <span className="flex items-center gap-3"><input type="radio" name="fulfillment-location" disabled={!enough} checked={deliveryLocationId === location.id} onChange={() => setDeliveryLocationId(location.id)} /><span><span className="block text-sm font-bold text-surface-900">{location.name}</span><span className="block text-xs text-surface-500">{location.address || 'No address set'}</span></span></span>
                            <span className={`text-xs font-bold ${enough ? 'text-success-700' : 'text-danger-600'}`}>{available} available</span>
                          </label>
                        )
                      })}
                      {inventoryLocations.length === 0 && <p className="rounded-xl bg-warning-50 p-3 text-sm text-warning-800">No inventory location is configured.</p>}
                    </div>
                  ) : (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-bold text-amber-900">No inventory recorded for this product</p>
                      <p className="text-[11px] text-amber-800 mt-1 leading-snug">
                        No branch has enough stock. You can record the delivery without deducting stock — say why (e.g. "sold from
                        stock not yet entered"), then add the stock so counts stay right.
                      </p>
                      <textarea className="input mt-2 min-h-[64px] text-xs" placeholder="Reason (required)" value={deliveryReason}
                        onChange={e => setDeliveryReason(e.target.value)} />
                    </div>
                  )
                })()}

                <div className="mt-6 flex justify-end gap-3 border-t border-surface-100 pt-4">
                  <button type="button" className="btn-outline" onClick={() => setDeliveryOrder(null)} disabled={Boolean(updating)}>Cancel</button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={(
                      inventoryLocations.some(loc =>
                        Number(locationInventory.find(i => i.location_id === loc.id && i.product_id === deliveryOrder.product_id)?.quantity || 0) >= (deliveryOrder.quantity || 1)
                      ) ? !deliveryLocationId : !deliveryReason.trim()
                    ) || Boolean(updating)}
                    onClick={() => handleUpdateStatus(deliveryOrder.id, 'delivered', deliveryLocationId || '')}
                  >
                    {updating ? 'Completing...' : 'Confirm Delivery'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
      <h3 className="text-sm font-bold uppercase tracking-wide text-surface-700">{children}</h3>
      <span className="h-px flex-1 bg-surface-100" />
    </div>
  )
}
