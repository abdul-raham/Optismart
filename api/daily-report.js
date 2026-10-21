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

// Target recipients (as requested)
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

function formatNaira(amount) {
  const num = Number(amount || 0)
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getNigeriaDate(dateInput) {
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

function getDayBounds(dateStr) {
  // Nigeria is UTC+1 (WAT)
  const startUtc = new Date(`${dateStr}T00:00:00+01:00`).toISOString()
  const endUtc = new Date(`${dateStr}T23:59:59.999+01:00`).toISOString()
  return { startUtc, endUtc }
}

export async function fetchDailyMetrics(supabase, targetDate) {
  const { startUtc, endUtc } = getDayBounds(targetDate)

  // Run queries in parallel
  const [
    deliveredRes,
    newOrdersRes,
    pendingRes,
    expensesRes,
    leadsRes,
    productsRes,
    usersRes
  ] = await Promise.all([
    // 1. Delivered orders (check delivered_at in the window, fallback to updated_at)
    supabase
      .from('orders')
      .select('id, order_number, customer_name, quantity, total_amount, unit_cost, product_id, dsa_id, delivered_at, updated_at, unregistered_dsa_name')
      .eq('status', 'delivered')
      .or(`and(delivered_at.gte.${startUtc},delivered_at.lte.${endUtc}),and(delivered_at.is.null,updated_at.gte.${startUtc},updated_at.lte.${endUtc})`),

    // 2. Orders placed today
    supabase
      .from('orders')
      .select('id, order_number, quantity, total_amount, status')
      .gte('created_at', startUtc)
      .lte('created_at', endUtc),

    // 3. Current active pipeline orders
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'approved', 'processing', 'dispatched', 'rescheduled']),

    // 4. Expenses recorded for that date
    supabase
      .from('expenses')
      .select('id, category, description, amount, expense_date, dsa_id')
      .eq('expense_date', targetDate),

    // 5. New leads captured today
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startUtc)
      .lte('created_at', endUtc),

    // 6. Products cost fallback
    supabase
      .from('products')
      .select('id, name, cost_price'),

    // 7. Users mapping
    supabase
      .from('users')
      .select('id, full_name, email')
  ])

  if (deliveredRes.error) throw deliveredRes.error
  if (newOrdersRes.error) throw newOrdersRes.error
  if (expensesRes.error) throw expensesRes.error

  const productMap = new Map((productsRes.data || []).map(p => [p.id, p]))
  const userMap = new Map((usersRes.data || []).map(u => [u.id, u]))

  const deliveredOrders = deliveredRes.data || []
  const newOrders = newOrdersRes.data || []
  const expenses = expensesRes.data || []

  // Aggregate delivered orders
  let deliveredCameras = 0
  let grossRevenue = 0
  let cameraCost = 0

  const dsaMap = new Map()

  deliveredOrders.forEach(o => {
    const qty = Number(o.quantity || 1)
    const rev = Number(o.total_amount || 0)
    const product = o.product_id ? productMap.get(o.product_id) : null
    const unitCost = Number(o.unit_cost || product?.cost_price || 0)
    const cost = unitCost * qty

    deliveredCameras += qty
    grossRevenue += rev
    cameraCost += cost

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

  // Operating Expenses
  const operatingExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const totalCost = cameraCost + operatingExpenses
  const netProfit = grossRevenue - totalCost
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

  // New Orders stats
  const newOrdersCount = newOrders.length
  const newOrdersValue = newOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  const newCamerasOrdered = newOrders.reduce((sum, o) => sum + Number(o.quantity || 1), 0)

  return {
    date: targetDate,
    deliveredOrdersCount: deliveredOrders.length,
    deliveredCameras,
    grossRevenue,
    cameraCost,
    operatingExpenses,
    totalCost,
    netProfit,
    profitMargin,
    newOrdersCount,
    newOrdersValue,
    newCamerasOrdered,
    pendingOrdersCount: pendingRes.count || 0,
    newLeadsCount: leadsRes.count || 0,
    dsaBreakdown: Array.from(dsaMap.values()).sort((a, b) => b.revenue - a.revenue),
    expensesBreakdown: expenses.map(e => ({
      category: e.category || 'General',
      description: e.description || '—',
      amount: Number(e.amount || 0),
      dsaName: e.dsa_id && userMap.has(e.dsa_id) ? userMap.get(e.dsa_id).full_name : 'Company-wide'
    }))
  }
}

export function generateDailyReportHtml(metrics) {
  const isProfitable = metrics.netProfit >= 0
  const profitColor = isProfitable ? '#16a34a' : '#dc2626'
  const profitBg = isProfitable ? '#f0fdf4' : '#fef2f2'
  const profitBorder = isProfitable ? '#bbf7d0' : '#fecaca'

  const formattedDate = new Date(`${metrics.date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // DSA rows
  const dsaRows = metrics.dsaBreakdown.length > 0
    ? metrics.dsaBreakdown.map(d => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b;">${escapeHtml(d.name)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #475569;">${d.orders}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 700; color: #0A74FF;">${d.cameras}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #0f172a;">${formatNaira(d.revenue)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #94a3b8;">No delivered orders recorded for this date.</td></tr>`

  // Expenses rows
  const expenseRows = metrics.expensesBreakdown.length > 0
    ? metrics.expensesBreakdown.map(e => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-transform: capitalize; font-weight: 600; color: #334155;">${escapeHtml(e.category)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b;">${escapeHtml(e.description)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px;">${escapeHtml(e.dsaName)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #dc2626;">${formatNaira(e.amount)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #94a3b8;">No expenses recorded for this date.</td></tr>`

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OptiSmart Daily Performance Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9; color: #334155;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 680px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 35px -10px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A74FF 0%, #00c6ff 100%); padding: 36px 32px; text-align: center; color: #ffffff;">
              <p style="margin: 0 0 6px 0; text-transform: uppercase; font-size: 12px; letter-spacing: 2.5px; font-weight: 800; color: rgba(255,255,255,0.85);">Executive Daily Flash Report</p>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">${escapeHtml(fromName)}</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.95);">${formattedDate}</p>
            </td>
          </tr>

          <!-- KPI SUMMARY GRID -->
          <tr>
            <td style="padding: 28px 28px 12px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <!-- REVENUE CARD -->
                  <td width="48%" style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #64748b;">Delivered Revenue</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: #0A74FF;">${formatNaira(metrics.grossRevenue)}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${metrics.deliveredOrdersCount} orders delivered</p>
                  </td>
                  <td width="4%"></td>
                  <!-- CAMERAS SOLD CARD -->
                  <td width="48%" style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #64748b;">Cameras Sold</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: #0f172a;">${metrics.deliveredCameras} <span style="font-size: 14px; font-weight: 600; color: #64748b;">units</span></p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Delivered & confirmed</p>
                  </td>
                </tr>
                <tr><td height="12" colspan="3"></td></tr>
                <tr>
                  <!-- TOTAL EXPENSES CARD -->
                  <td width="48%" style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #64748b;">Total Costs</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: #64748b;">${formatNaira(metrics.totalCost)}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Cost: ${formatNaira(metrics.cameraCost)} | Exp: ${formatNaira(metrics.operatingExpenses)}</p>
                  </td>
                  <td width="4%"></td>
                  <!-- NET PROFIT CARD -->
                  <td width="48%" style="padding: 16px; background: ${profitBg}; border: 1px solid ${profitBorder}; border-radius: 14px; vertical-align: top;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: ${profitColor};">Net Profit</p>
                    <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: ${profitColor};">${formatNaira(metrics.netProfit)}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 700; color: ${profitColor};">${metrics.profitMargin.toFixed(1)}% profit margin</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PIPELINE ACTIVITY -->
          <tr>
            <td style="padding: 12px 28px;">
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 16px 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #1e40af;">Pipeline & New Activity Today</h3>
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

          <!-- SALES BY AGENT (DSA) -->
          <tr>
            <td style="padding: 16px 28px;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Sales Performance by Agent (Today)</h3>
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

          <!-- OPERATING EXPENSES -->
          <tr>
            <td style="padding: 16px 28px 24px 28px;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Operating Expenses Recorded (Today)</h3>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #f8fafc; text-align: left;">
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Category</th>
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Description</th>
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Attributed To</th>
                    <th style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${expenseRows}
                </tbody>
              </table>
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
              This automated daily report is sent every day to <strong style="color: #334155;">aadeyemiak@gmail.com</strong> and <strong style="color: #334155;">abdulrahmanbakare001@gmail.com</strong>.<br>
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

export function generateDailyReportPlainText(metrics) {
  const isProfitable = metrics.netProfit >= 0
  return `OptiSmart Daily Performance Report
Date: ${metrics.date}

=== KEY METRICS ===
Delivered Revenue: ${formatNaira(metrics.grossRevenue)} (${metrics.deliveredOrdersCount} orders)
Cameras Sold: ${metrics.deliveredCameras} units
Product Acquisition Cost: ${formatNaira(metrics.cameraCost)}
Operating Expenses: ${formatNaira(metrics.operatingExpenses)}
Total Costs: ${formatNaira(metrics.totalCost)}
Net Profit: ${formatNaira(metrics.netProfit)} (${metrics.profitMargin.toFixed(1)}% margin) [${isProfitable ? 'PROFIT' : 'LOSS'}]

=== PIPELINE ACTIVITY TODAY ===
New Orders Created: ${metrics.newOrdersCount} orders (${metrics.newCamerasOrdered} cameras, ${formatNaira(metrics.newOrdersValue)})
Pending Fulfillment Pipeline: ${metrics.pendingOrdersCount} orders
New Leads Captured: ${metrics.newLeadsCount} leads

=== SALES BY AGENT ===
${metrics.dsaBreakdown.length ? metrics.dsaBreakdown.map(d => `- ${d.name}: ${d.cameras} cameras, ${d.orders} orders (${formatNaira(d.revenue)})`).join('\n') : 'No delivered orders today.'}

=== OPERATING EXPENSES ===
${metrics.expensesBreakdown.length ? metrics.expensesBreakdown.map(e => `- [${e.category}] ${e.description} (${e.dsaName}): ${formatNaira(e.amount)}`).join('\n') : 'No expenses recorded today.'}

View Portal: ${appUrl}/app/admin/finance
`
}

export default async function handler(req, res) {
  // Allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify authorization if CRON_SECRET is set
  const authHeader = req.headers.authorization
  const secretQuery = req.query?.secret || req.body?.secret
  const isVercelCron = cronSecret && (
    authHeader === `Bearer ${cronSecret}` ||
    secretQuery === cronSecret
  )

  // In production, require cronSecret if it is configured
  if (cronSecret && !isVercelCron && process.env.NODE_ENV === 'production') {
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
    const targetDate = getNigeriaDate(req.query?.date || req.body?.date)
    const isDryRun = req.query?.dryRun === 'true' || req.body?.dryRun === true

    // Fetch and aggregate all metrics for that date
    const metrics = await fetchDailyMetrics(supabase, targetDate)

    const html = generateDailyReportHtml(metrics)
    const text = generateDailyReportPlainText(metrics)

    // Check recipients
    const recipients = (process.env.DAILY_REPORT_EMAILS
      ? process.env.DAILY_REPORT_EMAILS.split(',').map(s => s.trim()).filter(Boolean)
      : DEFAULT_RECIPIENTS
    )

    if (isDryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        targetDate,
        recipients,
        metrics,
        previewText: text
      })
    }

    // Send individualized email to each recipient
    const sendResults = []
    const subject = `OptiSmart Daily Report - ${targetDate}: ${metrics.deliveredCameras} Cameras Sold | NGN ${Math.round(metrics.netProfit).toLocaleString()} Net Profit`

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
            'X-Entity-Ref-ID': `daily-report-${targetDate}-${Date.now()}`,
          }
        })
        sendResults.push({ recipient, messageId: mailResult.messageId, status: 'sent' })
      } catch (err) {
        console.error(`[Daily Report] Failed sending to ${recipient}:`, err)
        sendResults.push({ recipient, error: err.message, status: 'failed' })
      }
    }

    return res.status(200).json({
      success: true,
      targetDate,
      recipients,
      dispatches: sendResults,
      metrics: {
        deliveredCameras: metrics.deliveredCameras,
        deliveredOrdersCount: metrics.deliveredOrdersCount,
        grossRevenue: metrics.grossRevenue,
        cameraCost: metrics.cameraCost,
        operatingExpenses: metrics.operatingExpenses,
        totalCost: metrics.totalCost,
        netProfit: metrics.netProfit,
        profitMargin: metrics.profitMargin,
      }
    })
  } catch (error) {
    console.error('[Daily Report Error]:', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}

