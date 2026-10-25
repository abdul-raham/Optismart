import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  fetchReportMetrics,
  generateReportHtml,
  generateReportPlainText,
  formatNaira,
  getPeriodBounds,
  getPreviousNigeriaDate
} from '../api/daily-report.js'

// Load .env.local if present
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env.local')

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const emailUser = process.env.SMTP_USER || process.env.GMAIL_USER
const emailPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD
const fromName = process.env.EMAIL_FROM_NAME || 'OptiSmart Portal'

const recipients = (process.env.DAILY_REPORT_EMAILS
  ? process.env.DAILY_REPORT_EMAILS.split(',').map(s => s.trim()).filter(Boolean)
  : [
      'aadeyemiak@gmail.com',
      'abdulrahmanbakare001@gmail.com',
      'bakareabdulrahman001@gmail.com'
    ]
)

// Parse CLI arguments
const args = process.argv.slice(2)
let targetDate = null
let period = 'daily'
let isDryRun = false

args.forEach(arg => {
  if (arg.startsWith('--date=')) {
    targetDate = arg.split('=')[1]
  } else if (arg.startsWith('--period=')) {
    period = arg.split('=')[1].toLowerCase()
  } else if (arg === '--dry-run') {
    isDryRun = true
  }
})

if (!['daily', 'weekly', 'monthly'].includes(period)) {
  console.error(`Invalid period: "${period}". Allowed values are: daily, weekly, monthly`)
  process.exit(1)
}

if (!targetDate) {
  targetDate = getPreviousNigeriaDate()
}

const bounds = getPeriodBounds(period, targetDate)

console.log(`\n========================================`)
console.log(`OptiSmart Executive Report Generator`)
console.log(`Period: ${bounds.periodLabel.toUpperCase()}`)
console.log(`Date Range: ${bounds.periodTitle}`)
console.log(`Recipients: ${recipients.join(', ')}`)
console.log(`Mode: ${isDryRun ? 'DRY RUN (no email will be sent)' : 'LIVE DISPATCH'}`)
console.log(`========================================\n`)

async function run() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL or Key missing in environment.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  console.log(`Fetching metrics from Supabase database for ${period} report...`)
  const metrics = await fetchReportMetrics(supabase, period, targetDate)

  console.log(`\n--- RESULTS: ${metrics.periodLabel} (${metrics.periodTitle}) ---`)
  console.log(`[Sales & Profit]`)
  console.log(`- Delivered Orders: ${metrics.deliveredOrdersCount}`)
  console.log(`- Cameras Sold: ${metrics.deliveredCameras} units`)
  console.log(`- Gross Delivered Revenue: ${formatNaira(metrics.grossRevenue)}`)
  console.log(`- Product Cost (COGS): ${formatNaira(metrics.cameraCost)}`)
  console.log(`- Total Ad Spend: ${formatNaira(metrics.totalAdSpend)}`)
  console.log(`- Total Waybill & Delivery: ${formatNaira(metrics.totalWaybillAndDelivery)}`)
  console.log(`- Total Costs: ${formatNaira(metrics.totalCosts)}`)
  console.log(`- Net Profit: ${formatNaira(metrics.netProfit)} (${metrics.profitMargin.toFixed(1)}% margin)`)

  console.log(`\n[Ads & Marketing]`)
  console.log(`- Total Ad Spend: ${formatNaira(metrics.totalAdSpend)}`)
  console.log(`- ROAS: ${metrics.roas.toFixed(2)}x`)
  console.log(`- Cost Per Camera (CAC): ${formatNaira(metrics.costPerCamera)}`)
  console.log(`- Ad Spend Share of Revenue: ${metrics.adSpendShare.toFixed(1)}%`)
  console.log(`- Ad Expense Records: ${metrics.adExpenses.length} entries`)

  console.log(`\n[Waybill, Delivery & Couriers]`)
  console.log(`- Total Waybill & Delivery Cost: ${formatNaira(metrics.totalWaybillAndDelivery)}`)
  console.log(`- Courier Order Value Handled: ${formatNaira(metrics.totalCourierOrderValue)}`)
  console.log(`- Cash Remitted by Couriers: ${formatNaira(metrics.totalCourierRemitted)}`)
  console.log(`- Outstanding Cash Pending Remittance: ${formatNaira(metrics.totalCourierPendingRemittance)}`)
  console.log(`- Active Couriers: ${metrics.courierBreakdown.length} agents`)

  console.log(`\n[Pipeline]`)
  console.log(`- New Orders: ${metrics.newOrdersCount} (${formatNaira(metrics.newOrdersValue)})`)
  console.log(`- Pending Fulfillment Pipeline: ${metrics.pendingOrdersCount} orders`)
  console.log(`- New Leads: ${metrics.newLeadsCount} leads`)

  const text = generateReportPlainText(metrics)
  const html = generateReportHtml(metrics)

  if (isDryRun) {
    console.log('\n--- Plain text preview ---')
    console.log(text)
    console.log('--- End of preview ---\n')
    console.log('Dry run complete. Email was not sent.')
    return
  }

  if (!emailUser || !emailPass) {
    console.error('Error: Gmail/SMTP credentials (GMAIL_USER / GMAIL_APP_PASSWORD) missing in environment.')
    process.exit(1)
  }

  const transporter = nodemailer.createTransport({
    connectionTimeout: 15000,
    socketTimeout: 30000,
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  })

  const subject = `OptiSmart ${metrics.periodLabel} - ${metrics.periodTitle}: ${metrics.deliveredCameras} Cameras | NGN ${Math.round(metrics.netProfit).toLocaleString()} Recorded Profit Estimate`

  console.log(`\nDispatching individual emails...`)
  let failures = 0
  for (const recipient of recipients) {
    try {
      console.log(`Sending to ${recipient}...`)
      const info = await transporter.sendMail({
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
      console.log(`-> SMTP accepted for ${recipient}! Message ID: ${info.messageId}`)
    } catch (err) {
      failures += 1
      console.error(`-> FAILED for ${recipient}:`, err.message)
    }
  }

  transporter.close()
  if (failures) throw new Error(`${failures} report deliveries failed`)
  console.log('All reports accepted by SMTP.')
}

run().catch(err => {
  console.error('Failed to run report:', err)
  process.exit(1)
})
