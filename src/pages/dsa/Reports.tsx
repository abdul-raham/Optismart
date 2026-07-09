import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { OrderStatusBadge } from '@/components/shared/Badges'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order } from '@/types'
import { MobileDashboardNav } from '@/components/layout/MobileDashboardNav'
import { Calendar as CalendarIcon, Clock, Package, CheckCircle2, AlertCircle, Banknote, Percent, Download } from 'lucide-react'

type TimeFilter = 'total' | 'year' | 'month' | 'week' | 'day'

export function DSAReports() {
  const { user } = useAuthStore()
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month')
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [allCommissions, setAllCommissions] = useState<any[]>([])
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      fetchData(user.id)
    }
  }, [user?.id])

  const fetchData = async (userId: string) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authId = session?.user?.id
      const { data: orders } = await supabase.from('orders').select('*')
        .or(`dsa_id.eq.${userId},created_by_auth_id.eq.${authId}`)
      const { data: commissions } = await supabase.from('commissions').select('amount, status, created_at').eq('dsa_id', userId)
      const { data: leads } = await supabase.from('leads').select('*').eq('dsa_id', userId)

      if (orders) setAllOrders(orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      if (commissions) setAllCommissions(commissions)
      if (leads) setAllLeads(leads)
    } catch (error) {
      console.error('Error fetching DSA reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const { filteredOrders, filteredCommissions } = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(now.getDate() - now.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const filterByDate = (dateString: string) => {
      const d = new Date(dateString)
      switch (timeFilter) {
        case 'day': return d >= startOfDay
        case 'week': return d >= startOfWeek
        case 'month': return d >= startOfMonth
        case 'year': return d >= startOfYear
        default: return true
      }
    }

    return {
      filteredOrders: allOrders.filter(o => filterByDate(o.created_at)),
      filteredCommissions: allCommissions.filter(c => filterByDate(c.created_at))
    }
  }, [allOrders, allCommissions, timeFilter])

  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length
    const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered').length
    const outstandingOrders = filteredOrders.filter(o => !['delivered', 'cancelled', 'returned'].includes(o.status)).length
    const percentDelivered = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0
    const totalRemittance = filteredCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)
    return { totalOrders, deliveredOrders, outstandingOrders, percentDelivered, totalRemittance }
  }, [filteredOrders, filteredCommissions])

  const downloadCSV = () => {
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const headers = ['Type', 'Date', 'Order Number', 'Customer Name', 'Phone', 'Address / Location', 'Status', 'Qty', 'Amount (₦)', 'Notes']

    const orderRows = allOrders.map(o => [
      'Order',
      formatDate(o.created_at),
      o.order_number,
      o.customer_name,
      o.customer_phone ?? '',
      o.customer_address ?? '',
      o.status,
      o.quantity,
      o.total_amount,
      o.notes ?? '',
    ])

    const leadRows = allLeads.map(l => [
      'Lead',
      formatDate(l.created_at),
      '',
      l.customer_name,
      l.phone ?? '',
      l.location ?? '',
      l.status,
      '',
      '',
      l.notes ?? '',
    ])

    const rows = [headers, ...orderRows, ...leadRows]
    const csv = rows.map(r => r.map(escape).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `optismart-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Analytics & Reports</h1>
          <p className="text-sm text-surface-500 mt-1">Detailed performance metrics and historical data.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={downloadCSV}
            disabled={loading}
            className="btn-primary flex items-center gap-2 h-10 px-4 text-sm font-semibold"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>

          {/* Time Filters */}
          <div className="flex items-center gap-2 bg-surface-100 p-1 rounded-xl overflow-x-auto hide-scrollbar">
            {(['total', 'year', 'month', 'week', 'day'] as TimeFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-all ${
                  timeFilter === filter 
                    ? 'bg-white text-brand-700 shadow-sm' 
                    : 'text-surface-600 hover:text-surface-900 hover:bg-surface-200/50'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card h-64 animate-pulse bg-surface-100/50" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-surface-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-4 text-blue-600">
                  <Package className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Total Orders</p>
                <p className="text-3xl font-black text-surface-900">{stats.totalOrders}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-surface-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-success-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center mb-4 text-success-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Delivered</p>
                <p className="text-3xl font-black text-surface-900">{stats.deliveredOrders}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-surface-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-warning-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-full bg-warning-100 flex items-center justify-center mb-4 text-warning-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Outstanding</p>
                <p className="text-3xl font-black text-surface-900">{stats.outstandingOrders}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-surface-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-brand-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center mb-4 text-brand-600">
                  <Percent className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">% Delivered</p>
                <p className="text-3xl font-black text-surface-900">{stats.percentDelivered}%</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-surface-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-4 text-purple-600">
                  <Banknote className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Remittance</p>
                <p className="text-2xl font-black text-surface-900">{formatCurrency(stats.totalRemittance)}</p>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden mt-8">
            <div className="p-5 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-600" />
                Orders
              </h2>
              <span className="text-xs font-bold text-surface-500 bg-surface-200 px-3 py-1 rounded-full uppercase">
                {timeFilter === 'total' ? 'All Time' : `This ${timeFilter}`} · {filteredOrders.length} records
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-50 border-y border-surface-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Date</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Order #</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Customer</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Phone</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Address</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Qty</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3 text-surface-600">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {formatDate(order.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-brand-600">{order.order_number}</td>
                      <td className="px-4 py-3 font-semibold text-surface-900">{order.customer_name}</td>
                      <td className="px-4 py-3 text-surface-600">{order.customer_phone}</td>
                      <td className="px-4 py-3 text-surface-500 max-w-[200px] truncate">{order.customer_address}</td>
                      <td className="px-4 py-3 text-surface-700">{order.quantity}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 font-bold text-brand-700 text-right">{formatCurrency(order.total_amount)}</td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-surface-500">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-12 h-12 text-surface-300 mb-3" />
                          <p className="font-semibold text-surface-600">No orders found for this {timeFilter}.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Leads Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
            <div className="p-5 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-orange-500" />
                All Leads
              </h2>
              <span className="text-xs font-bold text-surface-500 bg-surface-200 px-3 py-1 rounded-full uppercase">
                {allLeads.length} records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surface-50 border-y border-surface-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Date Added</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Customer</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Phone</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Location</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Priority</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-4 py-3 font-bold text-surface-600 uppercase tracking-wider text-xs">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {allLeads.map(lead => (
                    <tr key={lead.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3 text-surface-600">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {formatDate(lead.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-surface-900">{lead.customer_name}</td>
                      <td className="px-4 py-3 text-surface-600">{lead.phone}</td>
                      <td className="px-4 py-3 text-surface-500">{lead.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                          lead.temperature === 'hot' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          lead.temperature === 'warm' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
                          {lead.temperature === 'hot' ? 'High' : lead.temperature === 'warm' ? 'Medium' : 'Low'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          lead.status === 'new' ? 'bg-brand-100 text-brand-700' :
                          lead.status === 'contacted' ? 'bg-purple-100 text-purple-700' :
                          lead.status === 'converted' ? 'bg-success-100 text-success-700' :
                          'bg-surface-100 text-surface-700'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs">
                        {lead.follow_up_date ? formatDate(lead.follow_up_date) : '—'}
                      </td>
                    </tr>
                  ))}
                  {allLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                        <p className="font-semibold">No leads found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      <MobileDashboardNav />
    </div>
  )
}
