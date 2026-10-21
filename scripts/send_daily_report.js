import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchDailyMetrics, generateDailyReportHtml, generateDailyReportPlainText } from '../api/daily-report.js'

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
      'abdulrahmanbakare001@gmail.com'
    ]
)

// Parse CLI arguments
const args = process.argv.slice(2)
let targetDate = null
let isDryRun = false

args.forEach(arg => {
  if (arg.startsWith('--date=')) {
    targetDate = arg.split('=')[1]
  } else if (arg === '--dry-run') {
    isDryRun = true
  }
})

if (!targetDate) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  targetDate = formatter.format(new Date())
}

console.log(`\n========================================`)
console.log(`OptiSmart Daily Report Generator`)
console.log(`Target Date: ${targetDate} (Africa/Lagos)`)
console.log(`Recipients: ${recipients.join(', ')}`)
console.log(`Mode: ${isDryRun ? 'DRY RUN (no email will be sent)' : 'LIVE DISPATCH'}`)
console.log(`========================================\n`)

async function run() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL or Key missing in environment.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  console.log('Fetching metrics from Supabase database...')
  const metrics = await fetchDailyMetrics(supabase, targetDate)

  console.log(`\nResults for ${targetDate}:`)
  console.log(`- Delivered Orders: ${metrics.deliveredOrdersCount}`)
  console.log(`- Cameras Sold: ${metrics.deliveredCameras}`)
  console.log(`- Gross Delivered Revenue: ₦${metrics.grossRevenue.toLocaleString()}`)
  console.log(`- Product Cost (COGS): ₦${metrics.cameraCost.toLocaleString()}`)
  console.log(`- Operating Expenses: ₦${metrics.operatingExpenses.toLocaleString()}`)
  console.log(`- Total Costs: ₦${metrics.totalCost.toLocaleString()}`)
  console.log(`- Net Profit: ₦${metrics.netProfit.toLocaleString()} (${metrics.profitMargin.toFixed(1)}% margin)`)
  console.log(`- Pipeline: ${metrics.newOrdersCount} new orders, ${metrics.pendingOrdersCount} pending, ${metrics.newLeadsCount} new leads`)

  const text = generateDailyReportPlainText(metrics)
  const html = generateDailyReportHtml(metrics)

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
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  })

  console.log(`\nDispatching report email to ${recipients.join(', ')}...`)
  const info = await transporter.sendMail({
    from: `"${String(fromName).replace(/["\r\n]/g, '')}" <${emailUser}>`,
    to: recipients.join(', '),
    subject: `OptiSmart Daily Report — ${targetDate}: ${metrics.deliveredCameras} Cameras Sold | ₦${metrics.netProfit.toLocaleString()} Net Profit`,
    text,
    html,
  })

  console.log(`Email successfully delivered! Message ID: ${info.messageId}\n`)
}

run().catch(err => {
  console.error('Failed to run daily report:', err)
  process.exit(1)
})

