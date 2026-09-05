import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseUrl = 'https://gefulgrfkgrzzatildja.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZnVsZ3Jma2dyenphdGlsZGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjM5MjQsImV4cCI6MjA5NzQ5OTkyNH0.x3i4zeTEEmwv5YQUPjK8WYTwXJvL29f_beuuOKDUv7I'

const supabase = createClient(supabaseUrl, supabaseKey)

const gmailUser = 'Optidigitalagency@gmail.com'
const gmailPass = 'enpofngjsqodrqby'
const fromName = 'OptiSmart Portal'
const appUrl = 'https://optismart-sigma.vercel.app'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: gmailUser, pass: gmailPass },
})

function escapeHtml(val) {
  return String(val || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function layout(title, content) {
  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
      .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
      .header { background: linear-gradient(135deg, #0A74FF 0%, #00d2ff 100%); padding: 40px 32px; text-align: center; color: #ffffff; }
      .header-subtitle { text-transform: uppercase; font-size: 12px; letter-spacing: 2px; font-weight: 800; opacity: 0.85; margin-bottom: 6px; }
      .header-title { font-size: 26px; font-weight: 900; margin: 0; }
      .content { padding: 40px 32px; color: #334155; line-height: 1.65; font-size: 15px; }
      .feature-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 24px 0; }
      .feature-box h3 { color: #0A74FF; margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 800; }
      .feature-box ul { padding-left: 20px; margin: 0; }
      .feature-box li { margin-bottom: 12px; color: #334155; }
      .btn { display: inline-block; background: #0A74FF; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 99px; font-size: 14px; margin-top: 20px; box-shadow: 0 4px 14px rgba(10,116,255,0.35); }
      .footer { background: #f1f5f9; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="header-subtitle">${escapeHtml(title)}</div>
        <h1 class="header-title">${escapeHtml(fromName)}</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} ${escapeHtml(fromName)}. All rights reserved.
      </div>
    </div>
  </body>
  </html>`
}

async function run() {
  console.log('Fetching active users from Supabase...')
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status')
    .eq('status', 'active')

  if (error) {
    console.error('Error fetching users:', error)
    process.exit(1)
  }

  console.log(`Found ${users.length} active users. Dispatching deliverability-optimized announcement emails...\n`)

  let successCount = 0
  for (const user of users) {
    if (!user.email) continue

    const isAdmin = user.role === 'admin' || user.role === 'super_admin'
    const name = user.full_name || user.email.split('@')[0]

    let subject = ''
    let textContent = ''
    let htmlContent = ''

    if (isAdmin) {
      subject = `OptiSmart System Update: Administrative Enhancements`
      textContent = `Hello ${name},\n\nWe have deployed system updates tailored for administrative management:\n\n1. Dual Admin + DSA Posting Rights: Post orders and leads directly under your own name while maintaining full Admin powers.\n2. Targeted Account Consolidation: Interactive login prompt to consolidate duplicate accounts into 1 primary profile.\n3. Fail-safe Commission Trigger: Automated database trigger calculates and logs ₦5,000/camera commissions automatically when orders are delivered.\n4. Physical Inventory Count Override: Set physical stock counts on hand with audit trail logs.\n5. Security Controls: Toggle individual Admin permissions for Inventory, Users, Expenses, Reports, and Deletions.\n\nOpen Admin Portal: ${appUrl}/app/admin\n\nOptiSmart Team`
      htmlContent = layout('Portal System Upgrade', `
        <h2>Hello ${escapeHtml(name)},</h2>
        <p>We have deployed system updates tailored for administrative management and sales tracking.</p>
        
        <div class="feature-box">
          <h3>Admin & Management Features Released:</h3>
          <ul>
            <li><strong>Dual Admin + DSA Posting Rights:</strong> Post orders and leads directly under your own name while retaining full Admin management powers.</li>
            <li><strong>Targeted Account Upgrade Modal:</strong> Interactive login prompt to consolidate duplicate accounts into 1 primary profile with zero data loss.</li>
            <li><strong>Fail-safe Commission Trigger:</strong> Automated database trigger calculates & logs ₦5,000/camera commissions automatically when orders are delivered.</li>
            <li><strong>Physical Inventory Count Override:</strong> Directly set physical stock counts on hand with automatic audit trail logs.</li>
            <li><strong>Granular Security Controls:</strong> Toggle individual Admin permissions for Inventory, Users, Expenses, Reports, and Deletions.</li>
          </ul>
        </div>

        <div style="text-align: center;">
          <a href="${appUrl}/app/admin" class="btn">Open Admin Portal</a>
        </div>
      `)
    } else {
      subject = `OptiSmart Portal Update: New Features for Your Account`
      textContent = `Hello ${name},\n\nWe have deployed new performance and tracking features to your OptiSmart Portal:\n\n1. Automated Commission Logging: Your ₦5,000 commission per camera is calculated and credited automatically when an order is marked delivered.\n2. My Commissions Dashboard: Track your total earnings, pending payouts, and paid commission history.\n3. Live Sales Leaderboard: View your global rank based on delivered orders and total revenue.\n4. Seamless Lead & Order Entry: Quickly post leads, set follow-up dates, and track customer orders.\n\nOpen your portal here: ${appUrl}/app/dsa\n\nOptiSmart Team`
      htmlContent = layout('New DSA Features', `
        <h2>Hello ${escapeHtml(name)},</h2>
        <p>We have deployed new performance and tracking features to your OptiSmart Portal.</p>
        
        <div class="feature-box">
          <h3>What is New In Your DSA Portal:</h3>
          <ul>
            <li><strong>Automated Commission Logging:</strong> Your ₦5,000 commission per camera is calculated and credited automatically the instant an order is marked delivered.</li>
            <li><strong>My Commissions Dashboard:</strong> Track your real-time total earnings, pending payouts, and paid commission history line-by-line.</li>
            <li><strong>Live Sales Leaderboard:</strong> Compete and view your global rank based on delivered orders and total revenue.</li>
            <li><strong>Seamless Lead & Order Entry:</strong> Quickly post leads, set follow-up dates, and track customer orders.</li>
          </ul>
        </div>

        <div style="text-align: center;">
          <a href="${appUrl}/app/dsa" class="btn">Open DSA Portal</a>
        </div>
      `)
    }

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${gmailUser}>`,
        replyTo: gmailUser,
        to: user.email,
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Mailer': 'OptiSmart Portal Service',
          'X-Entity-Ref-ID': Date.now().toString(),
        }
      })
      console.log(`✓ High-deliverability email sent to ${user.email} (${user.role})`)
      successCount++
    } catch (sendErr) {
      console.error(`✕ Failed to send email to ${user.email}:`, sendErr.message)
    }
  }

  console.log(`\nSuccessfully dispatched ${successCount}/${users.length} deliverability-optimized announcement emails!`)
  process.exit(0)
}

run()
