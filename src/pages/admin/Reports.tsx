import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
  BarChart3, Download, Calendar, Users, ShoppingBag,
  Camera, Banknote, Clock, TrendingUp, Filter, RefreshCw
} from 'lucide-react'


// ── Types ──────────────────────────────────────────────────────
interface DSASummary {
  dsa_id: string
  dsa_name: string
  dsa_email: string
  cameras_sold: number
  orders_count: number
  pending_orders: number
  total_revenue: number
  total_commission: number
  commission_paid: number
}

interface MonthlyBreakdown {
  month: string
  cameras: number
  orders: number
  revenue: number
  commissions: number
}

interface RemittanceRow {
  dsa_id: string
  dsa_name: string
  dsa_email: string
  // Amount DSA owes HQ (confirmed payments collected from customers)
  collected_from_customers: number
  // Amount HQ owes DSA (pending commissions not yet paid)
  commission_owed_to_dsa: number
  // Net: positive = DSA owes HQ, negative = HQ owes DSA
  net: number
}

// ── CSV Helper ─────────────────────────────────────────────────
function exportCSV(data: any[], filename: string) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const header = keys.join(',')
  const rows = data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ──────────────────────────────────────────────────
export function AdminReports() {
  const [loading, setLoading] = useState(true)
  const [dsaSummaries, setDsaSummaries] = useState<DSASummary[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyBreakdown[]>([])
  const [totalCameras, setTotalCameras] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalCommissions, setTotalCommissions] = useState(0)
  const [remittanceData, setRemittanceData] = useState<RemittanceRow[]>([])

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedDsa, setSelectedDsa] = useState('')
  const [dsaList, setDsaList] = useState<{ id: string; full_name: string }[]>([])

  useEffect(() => {
    fetchAll()
  }, [selectedMonth, selectedDsa])

  const fetchAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchDsaSummaries(), fetchMonthlyBreakdown(), fetchDsaList(), fetchRemittance()])
    } finally {
      setLoading(false)
    }
  }

  const fetchDsaList = async () => {
    const { data } = await supabase.from('users').select('id, full_name').eq('role', 'dsa').eq('status', 'active')
    if (data) setDsaList(data)
  }

  const fetchDsaSummaries = async () => {
    // Fetch all orders with DSA info
    let query = supabase
      .from('orders')
      .select(`
        id, quantity, total_amount, status, created_at, delivered_at,
        dsa:dsa_id ( id, full_name, email )
      `)

    if (selectedDsa) query = query.eq('dsa_id', selectedDsa)
    if (selectedMonth) {
      const start = `${selectedMonth}-01`
      const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1).toISOString()
      query = query.gte('created_at', start).lt('created_at', end)
    }

    const { data: orders } = await query

    // Fetch commissions
    let commQuery = supabase.from('commissions').select('dsa_id, amount, status')
    if (selectedDsa) commQuery = commQuery.eq('dsa_id', selectedDsa)
    const { data: comms } = await commQuery

    if (!orders) return

    // Aggregate by DSA
    const map: Record<string, DSASummary> = {}
    let totalCam = 0, totalOrd = 0, pendOrd = 0, totalRev = 0

    orders.forEach((o: any) => {
      const dsaId = o.dsa_id || '_unregistered'
      const dsaName = o.dsa?.full_name || 'Unregistered'
      const dsaEmail = o.dsa?.email || '—'

      if (!map[dsaId]) {
        map[dsaId] = { dsa_id: dsaId, dsa_name: dsaName, dsa_email: dsaEmail, cameras_sold: 0, orders_count: 0, pending_orders: 0, total_revenue: 0, total_commission: 0, commission_paid: 0 }
      }
      map[dsaId].cameras_sold += o.quantity || 0
      map[dsaId].orders_count += 1
      map[dsaId].total_revenue += o.total_amount || 0
      if (o.status === 'pending') map[dsaId].pending_orders += 1

      totalCam += o.quantity || 0
      totalOrd += 1
      if (o.status === 'pending') pendOrd += 1
      totalRev += o.total_amount || 0
    });

    (comms || []).forEach((c: any) => {
      const dsaId = c.dsa_id || '_unregistered'
      if (map[dsaId]) {
        map[dsaId].total_commission += c.amount || 0
        if (c.status === 'paid') map[dsaId].commission_paid += c.amount || 0
      }
    })

    const totalComm = (comms || []).reduce((s: number, c: any) => s + (c.amount || 0), 0)

    setDsaSummaries(Object.values(map))
    setTotalCameras(totalCam)
    setTotalOrders(totalOrd)
    setPendingOrders(pendOrd)
    setTotalRevenue(totalRev)
    setTotalCommissions(totalComm)
  }

  const fetchMonthlyBreakdown = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('quantity, total_amount, status, created_at')
      .order('created_at', { ascending: true })

    const { data: comms } = await supabase
      .from('commissions')
      .select('amount, triggered_at')

    if (!orders) return

    const monthMap: Record<string, MonthlyBreakdown> = {}
    orders.forEach((o: any) => {
      const month = o.created_at?.slice(0, 7) || ''
      if (!monthMap[month]) monthMap[month] = { month, cameras: 0, orders: 0, revenue: 0, commissions: 0 }
      monthMap[month].cameras += o.quantity || 0
      monthMap[month].orders += 1
      monthMap[month].revenue += o.total_amount || 0
    });

    (comms || []).forEach((c: any) => {
      const month = c.triggered_at?.slice(0, 7) || ''
      if (monthMap[month]) monthMap[month].commissions += c.amount || 0
    })

    const result = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // last 12 months

    setMonthlyData(result)
  }

  const fetchRemittance = async () => {
    // DSA collected from customers = sum of confirmed payments on orders belonging to each DSA
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, order_id, status, orders!inner(dsa_id, dsa:dsa_id(id, full_name, email))')
      .eq('status', 'confirmed')

    // Commission HQ owes DSAs = pending commissions
    const { data: pendingComms } = await supabase
      .from('commissions')
      .select('dsa_id, amount, status, dsa:dsa_id(id, full_name, email)')
      .eq('status', 'pending')

    const map: Record<string, RemittanceRow> = {}

    ;(payments || []).forEach((p: any) => {
      const order = p.orders
      const dsaId = order?.dsa_id
      if (!dsaId) return
      const dsa = order?.dsa
      if (!map[dsaId]) map[dsaId] = { dsa_id: dsaId, dsa_name: dsa?.full_name || 'Unknown', dsa_email: dsa?.email || '—', collected_from_customers: 0, commission_owed_to_dsa: 0, net: 0 }
      map[dsaId].collected_from_customers += p.amount || 0
    })

    ;(pendingComms || []).forEach((c: any) => {
      const dsaId = c.dsa_id
      if (!dsaId) return
      const dsa = c.dsa
      if (!map[dsaId]) map[dsaId] = { dsa_id: dsaId, dsa_name: dsa?.full_name || 'Unknown', dsa_email: dsa?.email || '—', collected_from_customers: 0, commission_owed_to_dsa: 0, net: 0 }
      map[dsaId].commission_owed_to_dsa += c.amount || 0
    })

    // Net = what DSA collected (owes HQ) minus what HQ owes DSA
    Object.values(map).forEach(r => { r.net = r.collected_from_customers - r.commission_owed_to_dsa })

    setRemittanceData(Object.values(map))
  }

  const statCards = [
    { label: 'Total Cameras Sold', value: totalCameras.toLocaleString(), icon: Camera, color: 'from-blue-500 to-cyan-400' },
    { label: 'Total Orders', value: totalOrders.toLocaleString(), icon: ShoppingBag, color: 'from-brand-500 to-violet-500' },
    { label: 'Pending Orders', value: pendingOrders.toLocaleString(), icon: Clock, color: 'from-amber-500 to-orange-400' },
    { label: 'Total Revenue', value: `₦${(totalRevenue / 1000).toFixed(0)}k`, icon: TrendingUp, color: 'from-emerald-500 to-teal-400' },
    { label: 'Total Commissions', value: `₦${(totalCommissions / 1000).toFixed(0)}k`, icon: Banknote, color: 'from-rose-500 to-pink-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-surface-500 mt-1">Full business overview — cameras, orders, commissions, and remittance.</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 bg-white text-sm font-bold text-surface-600 hover:bg-surface-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-surface-400" />
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-surface-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-surface-400" />
          <select
            value={selectedDsa}
            onChange={e => setSelectedDsa(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-white"
          >
            <option value="">All DSAs</option>
            {dsaList.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
        {(selectedMonth || selectedDsa) && (
          <button onClick={() => { setSelectedMonth(''); setSelectedDsa('') }}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 underline"
          >Clear filters</button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card p-4 flex flex-col gap-2"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs text-surface-500 font-medium">{s.label}</p>
            <p className="text-xl font-black text-surface-900">{loading ? '—' : s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* DSA Performance Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-surface-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-500" /> DSA Performance Breakdown
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">Camera sold, orders, and commission per DSA</p>
          </div>
          <button
            onClick={() => exportCSV(dsaSummaries.map(d => ({
              DSA: d.dsa_name, Email: d.dsa_email,
              'Cameras Sold': d.cameras_sold, 'Orders': d.orders_count,
              'Pending Orders': d.pending_orders, 'Revenue (₦)': d.total_revenue,
              'Commission (₦)': d.total_commission, 'Paid (₦)': d.commission_paid,
            })), 'dsa-performance')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 text-left">
                {['DSA Name', 'Email', 'Cameras', 'Orders', 'Pending', 'Revenue', 'Commission', 'Paid'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-surface-100 rounded animate-pulse" /></td></tr>
                ))
              ) : dsaSummaries.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-surface-400 font-medium">No data found</td></tr>
              ) : (
                dsaSummaries.map(d => (
                  <tr key={d.dsa_id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-surface-900">{d.dsa_name}</td>
                    <td className="px-4 py-3 text-surface-500 text-xs">{d.dsa_email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-bold text-brand-700">
                        <Camera className="w-3.5 h-3.5" /> {d.cameras_sold}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{d.orders_count}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${d.pending_orders > 0 ? 'text-amber-600' : 'text-surface-400'}`}>{d.pending_orders}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">₦{d.total_revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">₦{d.total_commission.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${d.commission_paid > 0 ? 'text-success-600' : 'text-surface-400'}`}>
                        ₦{d.commission_paid.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-surface-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-500" /> Monthly Breakdown (Last 12 Months)
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">Camera sales, orders, revenue and commissions per month</p>
          </div>
          <button
            onClick={() => exportCSV(monthlyData.map(m => ({
              Month: m.month, 'Cameras': m.cameras, 'Orders': m.orders,
              'Revenue (₦)': m.revenue, 'Commissions (₦)': m.commissions,
            })), 'monthly-breakdown')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 text-left">
                {['Month', 'Cameras Sold', 'Orders', 'Revenue', 'Commissions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-surface-100 rounded animate-pulse" /></td></tr>
                ))
              ) : monthlyData.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-surface-400 font-medium">No data</td></tr>
              ) : (
                monthlyData.map(m => (
                  <tr key={m.month} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-surface-900">{new Date(m.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</td>
                    <td className="px-4 py-3 font-semibold text-brand-700">{m.cameras}</td>
                    <td className="px-4 py-3 font-semibold">{m.orders}</td>
                    <td className="px-4 py-3 font-semibold">₦{m.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">₦{m.commissions.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remittance Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-surface-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-500" /> Remittance Summary
            </h2>
            <p className="text-xs text-surface-400 mt-0.5">
              <span className="text-amber-600 font-semibold">DSA owes HQ</span> = confirmed customer payments collected by DSA &nbsp;|&nbsp;
              <span className="text-emerald-600 font-semibold">HQ owes DSA</span> = pending commission not yet paid
            </p>
          </div>
          <button
            onClick={() => exportCSV(remittanceData.map(r => ({
              'DSA': r.dsa_name, 'Email': r.dsa_email,
              'Collected from Customers (₦)': r.collected_from_customers,
              'Commission Owed to DSA (₦)': r.commission_owed_to_dsa,
              'Net Balance (₦)': r.net,
              'Status': r.net > 0 ? 'DSA owes HQ' : r.net < 0 ? 'HQ owes DSA' : 'Settled',
            })), 'remittance')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 text-left">
                {['DSA Name', 'Email', 'Collected from Customers', 'Commission Owed to DSA', 'Net Balance', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-bold text-surface-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-surface-100 rounded animate-pulse" /></td></tr>
                ))
              ) : remittanceData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-surface-400 font-medium">No remittance data found</td></tr>
              ) : (
                remittanceData.map(r => (
                  <tr key={r.dsa_id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-surface-900">{r.dsa_name}</td>
                    <td className="px-4 py-3 text-surface-500 text-xs">{r.dsa_email}</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">₦{r.collected_from_customers.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">₦{r.commission_owed_to_dsa.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold">
                      <span className={`px-2.5 py-1 rounded-lg text-sm ${
                        r.net > 0 ? 'bg-amber-50 text-amber-700' :
                        r.net < 0 ? 'bg-emerald-50 text-emerald-700' :
                        'bg-surface-100 text-surface-500'
                      }`}>
                        ₦{Math.abs(r.net).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        r.net > 0 ? 'bg-amber-100 text-amber-700' :
                        r.net < 0 ? 'bg-emerald-100 text-emerald-700' :
                        'bg-surface-100 text-surface-500'
                      }`}>
                        {r.net > 0 ? 'DSA owes HQ' : r.net < 0 ? 'HQ owes DSA' : 'Settled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
