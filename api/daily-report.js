import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const emailUser = process.env.SMTP_USER || process.env.GMAIL_USER
const emailPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD
const smtpHost = process.env.SMTP_HOST
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465
const smtpSecure = process.env.SMTP_SECURE !== 'false'
const fromName = process.env.EMAIL_FROM_NAME || 'OptiSmart Portal'
const appUrl = process.env.APP_URL || 'https://optismart-sigma.vercel.app'
const cronSecret = process.env.CRON_SECRET || process.env.DAILY_REPORT_SECRET

// Target recipients
const DEFAULT_RECIPIENTS = [
  'aadeyemiak@gmail.com',
  'abdulrahmanbakare001@gmail.com',
  'bakareabdulrahman001@gmail.com'
]

const transporter = nodemailer.createTransport(
  smtpHost
    ? {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: emailUser, pass: emailPass },
        pool: true,
      }
    : {
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass },
        pool: true,
      }
)

export function formatNaira(amount) {
  const num = Number(amount || 0)
  return '₦' + Math.round(num).toLocaleString('en-NG')
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function getNigeriaDate(dateInput) {
  if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

// Both scheduled daily sends cover the last completed Nigeria calendar day.
export function getPreviousNigeriaDate(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  return new Date(new Date(`${today}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)
}

/**
 * Calculates start and end bounds depending on report period:
 * - 'daily': 1 day (targetDate)
 * - 'weekly': 7 days ending on targetDate
 * - 'monthly': Month-to-date starting from 1st of month to targetDate
 */
export function getPeriodBounds(period = 'daily', targetDate) {
  const anchorDateStr = getNigeriaDate(targetDate)
  const refDate = new Date(`${anchorDateStr}T12:00:00+01:00`)

  if (period === 'weekly') {
    const start = new Date(refDate.getTime() - 6 * 24 * 60 * 60 * 1000)
    const startDateStr = getNigeriaDate(start.toISOString().split('T')[0])
    const startUtc = new Date(`${startDateStr}T00:00:00+01:00`).toISOString()
    const endUtc = new Date(`${anchorDateStr}T23:59:59.999+01:00`).toISOString()
    return {
      period: 'weekly',
      periodLabel: 'Weekly Performance & Profit Report',
      periodTitle: `7-Day Period (${startDateStr} to ${anchorDateStr})`,
      startDate: startDateStr,
      endDate: anchorDateStr,
      startUtc,
      endUtc
    }
  }

  if (period === 'monthly') {
    const year = refDate.getFullYear()
    const month = String(refDate.getMonth() + 1).padStart(2, '0')
    const startDateStr = `${year}-${month}-01`
    const startUtc = new Date(`${startDateStr}T00:00:00+01:00`).toISOString()
    const endUtc = new Date(`${anchorDateStr}T23:59:59.999+01:00`).toISOString()
    return {
      period: 'monthly',
      periodLabel: 'Monthly Financial & Operations Report',
      periodTitle: `Month-to-Date (${startDateStr} to ${anchorDateStr})`,
      startDate: startDateStr,
      endDate: anchorDateStr,
      startUtc,
      endUtc
    }
  }

  // Daily
  const startUtc = new Date(`${anchorDateStr}T00:00:00+01:00`).toISOString()
  const endUtc = new Date(`${anchorDateStr}T23:59:59.999+01:00`).toISOString()
  return {
    period: 'daily',
    periodLabel: 'Daily Operations & Profit Flash Report',
    periodTitle: anchorDateStr,
    startDate: anchorDateStr,
    endDate: anchorDateStr,
    startUtc,
    endUtc
  }
}

export async function fetchReportMetrics(supabase, period = 'daily', targetDate) {
  const bounds = getPeriodBounds(period, targetDate)
  const { startUtc, endUtc, startDate, endDate } = bounds

  // Execute database queries in parallel
  const [
    deliveredRes,
    newOrdersRes,
    courierOrdersRes,
    pendingRes,
    expensesRes,
    leadsRes,
    productsRes,
    deliveryAgentsRes,
    usersRes
  ] = await Promise.all([
    // 1. Delivered orders in this period
    supabase
      .from('orders')
      .select('id, order_number, customer_name, quantity, total_amount, unit_cost, product_id, dsa_id, delivery_agent_id, delivery_fee, amount_remitted, delivered_at, updated_at, unregistered_dsa_name')
      .eq('status', 'delivered')
      .or(`and(delivered_at.gte.${startUtc},delivered_at.lte.${endUtc}),and(delivered_at.is.null,updated_at.gte.${startUtc},updated_at.lte.${endUtc})`),

    // 2. New orders created in this period
    supabase
      .from('orders')
      .select('id, order_number, quantity, total_amount, status, created_at')
      .gte('created_at', startUtc)
      .lte('created_at', endUtc),

    // 3. Orders handled by couriers / delivery agents active in this period
    supabase
      .from('orders')
      .select('id, order_number, total_amount, delivery_fee, amount_remitted, delivery_agent_id, status, updated_at, created_at')
      .not('delivery_agent_id', 'is', null)
      .or(`created_at.gte.${startUtc},updated_at.gte.${startUtc}`),

    // 4. Current active pipeline orders (all active)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'approved', 'processing', 'dispatched', 'rescheduled']),

    // 5. Operating expenses within the date range
    supabase
      .from('expenses')
      .select('id, category, description, amount, expense_date, dsa_id, order_id')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: false }),

    // 6. New leads captured in this period
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startUtc)
      .lte('created_at', endUtc),

    // 7. Products (for cost price fallback)
    supabase
      .from('products')
      .select('id, name, cost_price'),

    // 8. Delivery Agents (couriers/logistics)
    supabase
      .from('delivery_agents')
      .select('id, full_name, phone, area, is_active'),

    // 9. Users mapping
    supabase
      .from('users')
      .select('id, full_name, email')
  ])

  for (const result of [courierOrdersRes, pendingRes, leadsRes, productsRes, deliveryAgentsRes, usersRes]) {
    if (result.error) throw result.error
  }
  if (deliveredRes.error) throw deliveredRes.error
  if (newOrdersRes.error) throw newOrdersRes.error
  if (expensesRes.error) throw expensesRes.error

  const productMap = new Map((productsRes.data || []).map(p => [p.id, p]))
  const userMap = new Map((usersRes.data || []).map(u => [u.id, u]))
  const agentMap = new Map((deliveryAgentsRes.data || []).map(a => [a.id, a]))

  const deliveredOrders = deliveredRes.data || []
  const newOrders = newOrdersRes.data || []
  const courierOrders = courierOrdersRes.data || []
  const allExpenses = expensesRes.data || []

  // 1. Sales & Revenue
  let deliveredCameras = 0
  let grossRevenue = 0
  let cameraCost = 0
  let orderDeliveryFees = 0

  const dsaMap = new Map()

  deliveredOrders.forEach(o => {
    const qty = Number(o.quantity || 1)
    const rev = Number(o.total_amount || 0)
    const product = o.product_id ? productMap.get(o.product_id) : null
    const unitCost = Number(o.unit_cost || product?.cost_price || 0)
    const cost = unitCost * qty
    const fee = Number(o.delivery_fee || 0)

    deliveredCameras += qty
    grossRevenue += rev
    cameraCost += cost
    orderDeliveryFees += fee

    const dsaId = o.dsa_id || '_unregistered'
    const dsaUser = o.dsa_id ? userMap.get(o.dsa_id) : null
    const dsaName = dsaUser?.full_name || o.unregistered_dsa_name || 'Direct / System'

    if (!dsaMap.has(dsaId)) {
      dsaMap.set(dsaId, { name: dsaName, cameras: 0, revenue: 0, orders: 0 })
    }
    const dsa = dsaMap.get(dsaId)
    dsa.cameras += qty
    dsa.revenue += rev
    dsa.orders += 1
  })

  // 2. Separate Expenses into Ads, Waybill/Logistics, and General Operating
  const adCategories = ['advertising', 'ad_cost', 'marketing']
  const waybillCategories = ['waybill', 'delivery', 'logistics', 'shipping']

  const adExpenses = allExpenses.filter(e => adCategories.includes((e.category || '').toLowerCase()))
  const waybillExpenses = allExpenses.filter(e => waybillCategories.includes((e.category || '').toLowerCase()))
  const otherExpenses = allExpenses.filter(e => 
    !adCategories.includes((e.category || '').toLowerCase()) &&
    !waybillCategories.includes((e.category || '').toLowerCase())
  )

  const totalAdSpend = adExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const totalWaybillBulkSpend = waybillExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const totalOtherExpenses = otherExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

  // Total Waybill / Logistics = Per-order delivery fees + direct waybill expenses
  const totalWaybillAndDelivery = orderDeliveryFees + totalWaybillBulkSpend
  const totalOperatingExpenses = totalAdSpend + totalWaybillBulkSpend + totalOtherExpenses
  const totalCosts = cameraCost + totalOperatingExpenses + orderDeliveryFees
  const netProfit = grossRevenue - totalCosts
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

  // 3. Ads & Marketing KPIs
  const roas = totalAdSpend > 0 ? (grossRevenue / totalAdSpend) : 0
  const costPerCamera = deliveredCameras > 0 && totalAdSpend > 0 ? (totalAdSpend / deliveredCameras) : 0
  const adSpendShare = grossRevenue > 0 ? (totalAdSpend / grossRevenue) * 100 : 0

  // 4. Waybill & Courier Logistics Breakdown
  const courierStatsMap = new Map()
  let totalCourierOrderValue = 0
  let totalCourierRemitted = 0

  courierOrders.forEach(o => {
    if (!o.delivery_agent_id) return
    const agent = agentMap.get(o.delivery_agent_id)
    const agentName = agent?.full_name || 'Unknown Agent'
    const area = agent?.area || '—'

    const orderVal = Number(o.total_amount || 0)
    const remitted = Number(o.amount_remitted || 0)
    const fee = Number(o.delivery_fee || 0)

    totalCourierOrderValue += orderVal
    totalCourierRemitted += remitted

    if (!courierStatsMap.has(o.delivery_agent_id)) {
      courierStatsMap.set(o.delivery_agent_id, {
        id: o.delivery_agent_id,
        name: agentName,
        area,
        ordersCount: 0,
        orderValue: 0,
        remitted: 0,
        deliveryFees: 0,
        short: 0
      })
    }
    const c = courierStatsMap.get(o.delivery_agent_id)
    c.ordersCount += 1
    c.orderValue += orderVal
    c.remitted += remitted
    c.deliveryFees += fee
    c.short = Math.max(0, c.orderValue - c.remitted)
  })

  const courierBreakdown = Array.from(courierStatsMap.values()).sort((a, b) => b.orderValue - a.orderValue)
  const totalCourierPendingRemittance = Math.max(0, totalCourierOrderValue - totalCourierRemitted)

  // 5. Pipeline Summary
  const newOrdersCount = newOrders.length
  const newOrdersValue = newOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  const newCamerasOrdered = newOrders.reduce((sum, o) => sum + Number(o.quantity || 1), 0)

  return {
    period,
    periodLabel: bounds.periodLabel,
    periodTitle: bounds.periodTitle,
    startDate,
    endDate,
    // Sales & Profit
    deliveredOrdersCount: deliveredOrders.length,
    deliveredCameras,
    grossRevenue,
    cameraCost,
    totalCosts,
    missingCostOrders: deliveredOrders.filter(o => !(Number(o.unit_cost || productMap.get(o.product_id)?.cost_price || 0) > 0)).length,
    netProfit,
    profitMargin,
    // Ads Section
    totalAdSpend,
    roas,
    costPerCamera,
    adSpendShare,
    adExpenses: adExpenses.map(e => ({
      date: e.expense_date,
      description: e.description || 'Ad Campaign',
      amount: Number(e.amount || 0),
    })),
    // Waybill & Logistics Section
    orderDeliveryFees,
    totalWaybillBulkSpend,
    totalWaybillAndDelivery,
    courierOrdersCount: courierOrders.length,
    totalCourierOrderValue,
    totalCourierRemitted,
    totalCourierPendingRemittance,
    courierBreakdown,
    waybillExpenses: waybillExpenses.map(e => ({
      date: e.expense_date,
      description: e.description || 'Waybill / Shipping',
      amount: Number(e.amount || 0)
    })),
    // Other Expenses
    totalOtherExpenses,
    // Pipeline & DSA
    newOrdersCount,
    newOrdersValue,
    newCamerasOrdered,
    pendingOrdersCount: pendingRes.count || 0,
    newLeadsCount: leadsRes.count || 0,
    dsaBreakdown: Array.from(dsaMap.values()).sort((a, b) => b.revenue - a.revenue),
    allExpenses: allExpenses.map(e => ({
      category: e.category || 'General',
      description: e.description || '—',
      amount: Number(e.amount || 0),
      dsaName: e.dsa_id && userMap.has(e.dsa_id) ? userMap.get(e.dsa_id).full_name : 'Company-wide'
    }))
  }
}

export function generateReportHtml(metrics) {
  const isProfitable = metrics.netProfit >= 0
  const profitColor = isProfitable ? '#16a34a' : '#dc2626'
  const profitBg = isProfitable ? '#f0fdf4' : '#fef2f2'
  const profitBorder = isProfitable ? '#bbf7d0' : '#fecaca'

  // DSA Rows
  const dsaRows = metrics.dsaBreakdown.length > 0
    ? metrics.dsaBreakdown.map(d => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b;">${escapeHtml(d.name)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #475569;">${d.orders}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 700; color: #0A74FF;">${d.cameras}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #0f172a;">${formatNaira(d.revenue)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding: 14px; text-align: center; color: #94a3b8;">No delivered orders recorded in this period.</td></tr>`

  // Ads Rows
  const adsRows = metrics.adExpenses.length > 0
    ? metrics.adExpenses.map(a => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px;">${escapeHtml(a.date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b;">${escapeHtml(a.description)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #0284c7;">${formatNaira(a.amount)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">No advertising expenses logged in this period.</td></tr>`

  // Courier / Waybill Breakdown Rows
  const courierRows = metrics.courierBreakdown.length > 0
    ? metrics.courierBreakdown.map(c => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b;">
          ${escapeHtml(c.name)}
          <span style="display: block; font-size: 11px; color: #64748b;">${escapeHtml(c.area)}</span>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #475569;">${c.ordersCount}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #334155;">${formatNaira(c.orderValue)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #16a34a;">${formatNaira(c.remitted)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: ${c.short > 0 ? '#d97706' : '#64748b'};">
          ${c.short > 0 ? `${formatNaira(c.short)} due` : 'Settled'}
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="5" style="padding: 14px; text-align: center; color: #94a3b8;">No courier assignments active in this period.</td></tr>`

  // Bulk Waybill Expense rows
  const bulkWaybillRows = metrics.waybillExpenses.length > 0
    ? metrics.waybillExpenses.map(w => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px;">${escapeHtml(w.date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b;">${escapeHtml(w.description)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #e11d48;">${formatNaira(w.amount)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">No bulk interstate waybill expenses logged in this period.</td></tr>`

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OptiSmart ${escapeHtml(metrics.periodLabel)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9; color: #334155;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 720px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 35px -10px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A74FF 0%, #00c6ff 100%); padding: 36px 32px; text-align: center; color: #ffffff;">
              <p style="margin: 0 0 6px 0; text-transform: uppercase; font-size: 12px; letter-spacing: 2.5px; font-weight: 800; color: rgba(255,255,255,0.85);">${escapeHtml(metrics.periodLabel)}</p>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">${escapeHtml(fromName)}</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.95);">${escapeHtml(metrics.periodTitle)}</p>
            </td>
          </tr>

          <!-- TOP 4 FINANCIAL KPIS -->
          <tr>
            <td style="padding: 28px 28px 12px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <!-- DELIVERED REVENUE -->
                  <td width="48%" style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #64748b;">Delivered Revenue</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: #0A74FF;">${formatNaira(metrics.grossRevenue)}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${metrics.deliveredOrdersCount} orders delivered</p>
                  </td>
                  <td width="4%"></td>
                  <!-- CAMERAS SOLD -->
                  <td width="48%" style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #64748b;">Cameras Sold</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: #0f172a;">${metrics.deliveredCameras} <span style="font-size: 14px; font-weight: 600; color: #64748b;">units</span></p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Delivered & confirmed</p>
                  </td>
                </tr>
                <tr><td height="12" colspan="3"></td></tr>
                <tr>
                  <!-- TOTAL AD SPEND & ROAS -->
                  <td width="48%" style="padding: 16px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #0369a1;">Ad Spend & ROAS</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: #0284c7;">${formatNaira(metrics.totalAdSpend)}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 700; color: #0369a1;">
                      ${metrics.roas > 0 ? `${metrics.roas.toFixed(1)}x ROAS` : 'No ads recorded'} ${metrics.costPerCamera > 0 ? `· ${formatNaira(metrics.costPerCamera)}/camera` : ''}
                    </p>
                  </td>
                  <td width="4%"></td>
                  <!-- NET PROFIT -->
                  <td width="48%" style="padding: 16px; background: ${profitBg}; border: 1px solid ${profitBorder}; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: ${profitColor};">Recorded profit estimate</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: ${profitColor};">${formatNaira(metrics.netProfit)}</p><p style="font-size:12px;color:#92400e">${metrics.missingCostOrders ? `${metrics.missingCostOrders} delivered orders have no positive acquisition cost recorded. This is not final net profit.` : 'Based on recorded costs and expenses only.'}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 700; color: ${profitColor};">${metrics.profitMargin.toFixed(1)}% profit margin</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SECTION 1: ADS & MARKETING PERFORMANCE -->
          <tr>
            <td style="padding: 16px 28px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px;">
                <h3 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                  <span>📢 Advertising & Marketing Performance</span>
                  <span style="font-size: 13px; font-weight: 700; color: #0284c7;">Total Spend: ${formatNaira(metrics.totalAdSpend)}</span>
                </h3>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px;">
                  <tr>
                    <td width="33%" style="padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">ROAS</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: #0284c7;">${metrics.roas.toFixed(2)}x</p>
                    </td>
                    <td width="3%"></td>
                    <td width="33%" style="padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Ad Cost / Camera</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: #0f172a;">${formatNaira(metrics.costPerCamera)}</p>
                    </td>
                    <td width="3%"></td>
                    <td width="33%" style="padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Ad Share of Rev</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: #334155;">${metrics.adSpendShare.toFixed(1)}%</p>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Ad Expense Entries</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse; font-size: 13px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
                  <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Date</th>
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Campaign Description</th>
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: right;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${adsRows}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- SECTION 2: WAYBILL & COURIER LOGISTICS -->
          <tr>
            <td style="padding: 8px 28px 16px 28px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px;">
                <h3 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                  <span>🚚 Waybill, Delivery & Courier Remittance</span>
                  <span style="font-size: 13px; font-weight: 700; color: #e11d48;">Waybill Cost: ${formatNaira(metrics.totalWaybillAndDelivery)}</span>
                </h3>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px;">
                  <tr>
                    <td width="33%" style="padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Courier Orders</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: #0f172a;">${metrics.courierOrdersCount} orders</p>
                    </td>
                    <td width="3%"></td>
                    <td width="33%" style="padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Cash Remitted</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: #16a34a;">${formatNaira(metrics.totalCourierRemitted)}</p>
                    </td>
                    <td width="3%"></td>
                    <td width="33%" style="padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Pending Remittance</p>
                      <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: ${metrics.totalCourierPendingRemittance > 0 ? '#d97706' : '#64748b'};">
                        ${formatNaira(metrics.totalCourierPendingRemittance)}
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Delivery Agent / Waybill Partners</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse; font-size: 13px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 16px;">
                  <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Courier / Area</th>
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: center;">Shipments</th>
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: right;">Total Value</th>
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: right;">Remitted</th>
                      <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: right;">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${courierRows}
                  </tbody>
                </table>

                ${metrics.waybillExpenses.length > 0 ? `
                  <p style="margin: 12px 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Bulk Interstate Waybill Expenses</p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse; font-size: 13px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
                    <thead>
                      <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Date</th>
                        <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Description</th>
                        <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: right;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${bulkWaybillRows}
                    </tbody>
                  </table>
                ` : ''}

              </div>
            </td>
          </tr>

          <!-- SECTION 3: SALES BY AGENT (DSA) -->
          <tr>
            <td style="padding: 8px 28px 16px 28px;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Sales Performance by Agent (DSA)</h3>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #f8fafc; text-align: left;">
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Sales Agent</th>
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: center;">Orders</th>
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: center;">Cameras</th>
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: right;">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${dsaRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- SECTION 4: PIPELINE & ACTIVITY -->
          <tr>
            <td style="padding: 8px 28px 24px 28px;">
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 16px 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #1e40af;">Pipeline & Period Activity</h3>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size: 13px;">
                  <tr>
                    <td style="padding: 4px 0; color: #1e3a8a;"><strong>New Orders Created:</strong> ${metrics.newOrdersCount} orders (${metrics.newCamerasOrdered} cameras, ${formatNaira(metrics.newOrdersValue)})</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #1e3a8a;"><strong>Active Pending Pipeline:</strong> ${metrics.pendingOrdersCount} orders currently in fulfillment</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #1e3a8a;"><strong>New Leads Captured:</strong> ${metrics.newLeadsCount} prospective customers</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- CTA BUTTON -->
          <tr>
            <td align="center" style="padding: 12px 28px 36px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#0A74FF" style="border-radius: 99px; box-shadow: 0 4px 14px 0 rgba(10,116,255,0.35);">
                    <a href="${escapeHtml(appUrl)}/app/admin/finance" style="font-size: 14px; font-weight: 700; text-decoration: none; color: #ffffff; padding: 14px 32px; display: inline-block; border-radius: 99px;">Open Finance & Profit Portal</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              This automated ${escapeHtml(metrics.period)} report is sent to <strong style="color: #334155;">aadeyemiak@gmail.com</strong> and <strong style="color: #334155;">abdulrahmanbakare001@gmail.com</strong>.<br>
              &copy; ${new Date().getFullYear()} ${escapeHtml(fromName)}. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function generateReportPlainText(metrics) {
  const isProfitable = metrics.netProfit >= 0
  return `OptiSmart ${metrics.periodLabel}
Period: ${metrics.periodTitle}

=== FINANCIAL OVERVIEW ===
Delivered Revenue: ${formatNaira(metrics.grossRevenue)} (${metrics.deliveredOrdersCount} orders delivered)
Cameras Sold: ${metrics.deliveredCameras} units
Product Acquisition Cost (COGS): ${formatNaira(metrics.cameraCost)}
Total Ad Spend: ${formatNaira(metrics.totalAdSpend)}
Waybill & Delivery Costs: ${formatNaira(metrics.totalWaybillAndDelivery)}
Other Operating Expenses: ${formatNaira(metrics.totalOtherExpenses)}
Total Costs: ${formatNaira(metrics.totalCosts)}
Recorded profit estimate: ${formatNaira(metrics.netProfit)} (${metrics.profitMargin.toFixed(1)}% margin) [${isProfitable ? 'PROFIT' : 'LOSS'}]

Cost completeness: ${metrics.missingCostOrders || 0} delivered orders have no positive acquisition cost recorded. Profit is provisional and excludes unrecorded costs.

=== ADS & MARKETING PERFORMANCE ===
Total Ad Spend: ${formatNaira(metrics.totalAdSpend)}
Return On Ad Spend (ROAS): ${metrics.roas.toFixed(2)}x
Ad Cost per Camera (CAC): ${formatNaira(metrics.costPerCamera)}
Ad Share of Revenue: ${metrics.adSpendShare.toFixed(1)}%
${metrics.adExpenses.length ? metrics.adExpenses.map(a => `  - [${a.date}] ${a.description}: ${formatNaira(a.amount)}`).join('\n') : '  No ad expenses logged in this period.'}

=== WAYBILL, DELIVERY & COURIER REMITTANCE ===
Total Waybill & Delivery Cost: ${formatNaira(metrics.totalWaybillAndDelivery)}
Courier Shipments: ${metrics.courierOrdersCount} orders
Total Order Value with Couriers: ${formatNaira(metrics.totalCourierOrderValue)}
Cash Remitted to HQ: ${formatNaira(metrics.totalCourierRemitted)}
Outstanding Cash Pending Remittance: ${formatNaira(metrics.totalCourierPendingRemittance)}

Courier Breakdown:
${metrics.courierBreakdown.length ? metrics.courierBreakdown.map(c => `  - ${c.name} (${c.area}): ${c.ordersCount} orders | Value: ${formatNaira(c.orderValue)} | Remitted: ${formatNaira(c.remitted)} | Balance Due: ${formatNaira(c.short)}`).join('\n') : '  No courier shipments active in this period.'}

=== SALES BY AGENT (DSA) ===
${metrics.dsaBreakdown.length ? metrics.dsaBreakdown.map(d => `  - ${d.name}: ${d.cameras} cameras, ${d.orders} orders (${formatNaira(d.revenue)})`).join('\n') : '  No delivered sales in this period.'}

=== PIPELINE ACTIVITY ===
New Orders Created: ${metrics.newOrdersCount} orders (${metrics.newCamerasOrdered} cameras, ${formatNaira(metrics.newOrdersValue)})
Active Pending Pipeline: ${metrics.pendingOrdersCount} orders
New Leads Captured: ${metrics.newLeadsCount} leads

Portal Link: ${appUrl}/app/admin/finance
`
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  const secretQuery = req.query?.secret || req.body?.secret
  const isVercelCron = cronSecret && (
    authHeader === `Bearer ${cronSecret}` ||
    secretQuery === cronSecret
  )

  if (!cronSecret || !isVercelCron) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing cron secret' })
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials are not configured' })
  }
  if (!emailUser || !emailPass) {
    return res.status(500).json({ error: 'Email SMTP credentials are not configured' })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const period = (req.query?.period || req.body?.period || 'daily').toLowerCase()
    const targetDate = req.query?.date || req.body?.date || getPreviousNigeriaDate()
    const isDryRun = req.query?.dryRun === 'true' || req.body?.dryRun === true

    const metrics = await fetchReportMetrics(supabase, period, targetDate)

    const html = generateReportHtml(metrics)
    const text = generateReportPlainText(metrics)

    const recipients = (process.env.DAILY_REPORT_EMAILS
      ? process.env.DAILY_REPORT_EMAILS.split(',').map(s => s.trim()).filter(Boolean)
      : DEFAULT_RECIPIENTS
    )

    if (isDryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        period,
        targetDate,
        recipients,
        metrics,
        previewText: text
      })
    }

    const sendResults = []
    const subject = `OptiSmart ${metrics.periodLabel} - ${metrics.periodTitle}: ${metrics.deliveredCameras} Cameras | NGN ${Math.round(metrics.netProfit).toLocaleString()} Recorded Profit Estimate`

    for (const recipient of recipients) {
      try {
        const mailResult = await transporter.sendMail({
          from: `"${String(fromName).replace(/["\r\n]/g, '')}" <${emailUser}>`,
          to: recipient,
          replyTo: emailUser,
          subject,
          text,
          html,
          headers: {
            'X-Mailer': 'OptiSmart Portal Service',
            'X-Entity-Ref-ID': `${period}-report-${targetDate}-${Date.now()}`,
          }
        })
        sendResults.push({ recipient, messageId: mailResult.messageId, status: 'sent' })
      } catch (err) {
        console.error(`[Report] Failed sending to ${recipient}:`, err)
        sendResults.push({ recipient, error: err.message, status: 'failed' })
      }
    }

    return res.status(200).json({
      success: true,
      period,
      targetDate,
      recipients,
      dispatches: sendResults,
      metrics: {
        deliveredCameras: metrics.deliveredCameras,
        deliveredOrdersCount: metrics.deliveredOrdersCount,
        grossRevenue: metrics.grossRevenue,
        cameraCost: metrics.cameraCost,
        totalAdSpend: metrics.totalAdSpend,
        roas: metrics.roas,
        totalWaybillAndDelivery: metrics.totalWaybillAndDelivery,
        totalCourierPendingRemittance: metrics.totalCourierPendingRemittance,
        totalCosts: metrics.totalCosts,
        netProfit: metrics.netProfit,
        profitMargin: metrics.profitMargin,
      }
    })
  } catch (error) {
    console.error('[Report Engine Error]:', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}
