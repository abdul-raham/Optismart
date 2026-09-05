import nodemailer from 'nodemailer'

const emailUser = process.env.SMTP_USER || process.env.GMAIL_USER
const emailPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD
const smtpHost = process.env.SMTP_HOST
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465
const smtpSecure = process.env.SMTP_SECURE !== 'false'
const fromName = process.env.EMAIL_FROM_NAME || 'OptiSmart Portal'
const supportEmail = process.env.EMAIL_SUPPORT_ADDRESS || emailUser
const appUrl = process.env.APP_URL || 'http://localhost:5173'
const allowedOrigins = new Set(
  String(process.env.EMAIL_ALLOWED_ORIGINS || appUrl)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const transporter = nodemailer.createTransport(
  smtpHost
    ? {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: emailUser, pass: emailPass },
        pool: true,
        rateLimit: true,
      }
    : {
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass },
        pool: true,
        rateLimit: true,
      }
)

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeUrl(value) {
  const url = new URL(String(value), appUrl)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid URL')
  return url.toString()
}

function button(href, label) {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px auto;">
    <tr>
      <td align="center" bgcolor="#0A74FF" style="border-radius: 99px; box-shadow: 0 4px 14px 0 rgba(10,116,255,0.39);">
        <a href="${safeUrl(href)}" style="font-size: 14px; font-weight: 700; text-decoration: none; color: #ffffff; padding: 14px 32px; display: inline-block; border-radius: 99px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}

function layout(title, content) {
  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
      table { border-collapse: collapse; }
      .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #0A74FF 0%, #00d2ff 100%); padding: 48px 32px; text-align: center; }
      .header-title { color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
      .header-subtitle { color: rgba(255,255,255,0.8); font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px; font-weight: 700; }
      .content { padding: 48px 40px; color: #334155; line-height: 1.7; font-size: 16px; }
      .content h2 { color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 24px; }
      .footer { background: #f1f5f9; padding: 32px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
      .footer a { color: #0A74FF; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc;">
      <tr>
        <td align="center" style="padding: 20px;">
          <div class="container">
            <div class="header">
              <div class="header-subtitle">${escapeHtml(title)}</div>
              <h1 class="header-title">${escapeHtml(fromName)}</h1>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              Questions? Contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a><br><br>
              &copy; ${new Date().getFullYear()} ${escapeHtml(fromName)}. All rights reserved.
            </div>
          </div>
        </td>
      </tr>
    </table>
  </body>
  </html>`
}

const templates = {
  welcome: ({ recipientEmail, recipientName }) => ({
    to: recipientEmail,
    subject: `Welcome to ${fromName}`,
    html: layout('Welcome Aboard', `
      <h2>Hello ${escapeHtml(recipientName)},</h2>
      <p>Your portal account has been successfully created. We are thrilled to have you join <strong>${escapeHtml(fromName)}</strong>.</p>
      ${button(`${appUrl}/login`, 'Open Your Portal')}
    `),
  }),

  new_lead: ({ dsaEmail, dsaName, customerName }) => ({
    to: dsaEmail,
    subject: `New Lead Captured: ${customerName}`,
    html: layout('New Pipeline Activity', `
      <h2>Great job, ${escapeHtml(dsaName)}! 🎉</h2>
      <p>You have successfully added a new lead: <strong>${escapeHtml(customerName)}</strong>.</p>
      ${button(`${appUrl}/app/leads`, 'Manage Pipeline')}
    `),
  }),

  new_order: ({ recipientEmail, customerEmail, dsaEmail, orderNumber, customerName, totalAmount, amount }) => {
    const to = recipientEmail || customerEmail || dsaEmail
    const amt = totalAmount || amount
    return {
      to,
      subject: `New Order Created - ${orderNumber}`,
      html: layout('New Order Alert', `
        <h2>New Order Placed</h2>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Order Reference</p>
          <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">${escapeHtml(orderNumber)}</p>
          <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Customer</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #334155;">${escapeHtml(customerName)}</p>
            ${amt ? `
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Total Amount</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #334155;">&#8358;${Number(amt).toLocaleString()}</p>
            ` : ''}
          </div>
        </div>
        ${button(`${appUrl}/app/admin/orders`, 'View Order in Portal')}
      `),
    }
  },

  order_status_update: ({ recipientEmail, customerName, orderNumber, status }) => ({
    to: recipientEmail,
    subject: `Order Status Updated: ${status.toUpperCase()} - ${orderNumber}`,
    html: layout('Order Status Update', `
      <h2>Order Status Changed</h2>
      <p>Order <strong>${escapeHtml(orderNumber)}</strong> for <strong>${escapeHtml(customerName)}</strong> is now <strong style="text-transform: uppercase; color: #0A74FF;">${escapeHtml(status)}</strong>.</p>
      ${button(`${appUrl}/app/orders`, 'View Order')}
    `),
  }),

  commission_paid: ({ dsaEmail, dsaName, amount, orderNumber }) => ({
    to: dsaEmail,
    subject: `Commission Paid! 💰`,
    html: layout('Commission Paid', `
      <h2>Hello ${escapeHtml(dsaName)},</h2>
      <p>Your commission of <strong>${escapeHtml(amount)}</strong> for order <strong>${escapeHtml(orderNumber)}</strong> has been marked as PAID.</p>
      ${button(`${appUrl}/app/dsa/commission`, 'View Commissions')}
    `),
  }),

  job_assigned: ({ installerEmail, installerName, orderNumber, customerName, location }) => ({
    to: installerEmail,
    subject: `New Job Assigned: ${orderNumber}`,
    html: layout('New Installation Job', `
      <h2>Hello ${escapeHtml(installerName)},</h2>
      <p>You have been assigned a new installation job.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Order Reference</p>
        <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">${escapeHtml(orderNumber)}</p>
        <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Customer</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #334155;">${escapeHtml(customerName)}</p>
          <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Location</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #334155;">${escapeHtml(location)}</p>
        </div>
      </div>
      <p>Log in to review the job details and contact the customer.</p>
      ${button(`${appUrl}/app/installer/jobs`, 'View Job Details')}
    `),
  }),

  account_approved: ({ recipientEmail, recipientName, role }) => ({
    to: recipientEmail,
    subject: `Your ${role.toUpperCase()} Account is Approved!`,
    html: layout('Account Approved', `
      <h2>Welcome, ${escapeHtml(recipientName)}!</h2>
      <p>Your <strong>${escapeHtml(role)}</strong> account has been approved. You can now log in.</p>
      ${button(`${appUrl}/login`, 'Login Now')}
    `),
  }),

  portal_update_dsa: ({ recipientEmail, recipientName }) => ({
    to: recipientEmail,
    subject: `OptiSmart Portal Update: New Features for Your Account`,
    text: `Hello ${recipientName || 'Sales Partner'},\n\nWe have deployed new performance and tracking features to your OptiSmart Portal:\n\n1. Automated Commission Logging: Your ₦5,000 commission per camera is calculated and credited automatically when an order is marked delivered.\n2. My Commissions Dashboard: Track your total earnings, pending payouts, and paid commission history.\n3. Live Sales Leaderboard: View your global rank based on delivered orders and total revenue.\n4. Seamless Lead & Order Entry: Quickly post leads, set follow-up dates, and track customer orders.\n\nOpen your portal here: ${appUrl}/app/dsa\n\nOptiSmart Team`,
    html: layout('New DSA Features', `
      <h2>Hello ${escapeHtml(recipientName || 'Sales Partner')},</h2>
      <p>We have deployed new performance and tracking features to your OptiSmart Portal.</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #0A74FF;">What is New In Your DSA Portal:</h3>
        <ul style="padding-left: 20px; color: #334155; margin-bottom: 0;">
          <li style="margin-bottom: 12px;"><strong>Automated Commission Logging:</strong> Your ₦5,000 commission per camera is calculated and credited automatically the instant an order is marked delivered.</li>
          <li style="margin-bottom: 12px;"><strong>My Commissions Dashboard:</strong> Track your real-time total earnings, pending payouts, and paid commission history line-by-line.</li>
          <li style="margin-bottom: 12px;"><strong>Live Sales Leaderboard:</strong> Compete and view your global rank based on delivered orders and total revenue.</li>
          <li style="margin-bottom: 0;"><strong>Seamless Lead & Order Entry:</strong> Quickly post leads, set follow-up dates, and track customer orders.</li>
        </ul>
      </div>

      ${button(`${appUrl}/app/dsa`, 'Open DSA Portal')}
    `),
  }),

  portal_update_admin: ({ recipientEmail, recipientName }) => ({
    to: recipientEmail,
    subject: `OptiSmart System Update: Administrative Enhancements`,
    text: `Hello ${recipientName || 'Administrator'},\n\nWe have deployed system updates tailored for administrative management:\n\n1. Dual Admin + DSA Posting Rights: Post orders and leads directly under your own name while maintaining full Admin powers.\n2. Targeted Account Consolidation: Interactive login prompt to consolidate duplicate accounts into 1 primary profile.\n3. Fail-safe Commission Trigger: Automated database trigger calculates and logs ₦5,000/camera commissions automatically when orders are delivered.\n4. Physical Inventory Count Override: Set physical stock counts on hand with audit trail logs.\n5. Security Controls: Toggle individual Admin permissions for Inventory, Users, Expenses, Reports, and Deletions.\n\nOpen Admin Portal: ${appUrl}/app/admin\n\nOptiSmart Team`,
    html: layout('Portal System Upgrade', `
      <h2>Hello ${escapeHtml(recipientName || 'Administrator')},</h2>
      <p>We have deployed system updates tailored for administrative management and sales tracking.</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #0A74FF;">Admin Features Released:</h3>
        <ul style="padding-left: 20px; color: #334155; margin-bottom: 0;">
          <li style="margin-bottom: 12px;"><strong>Dual Admin + DSA Posting Rights:</strong> Post orders and leads directly under your own name while retaining full Admin management powers.</li>
          <li style="margin-bottom: 12px;"><strong>Targeted Account Consolidation:</strong> Interactive login prompt to consolidate duplicate accounts into 1 primary profile with zero data loss.</li>
          <li style="margin-bottom: 12px;"><strong>Fail-safe Commission Trigger:</strong> Automated database trigger calculates & logs ₦5,000/camera commissions automatically when orders are delivered.</li>
          <li style="margin-bottom: 12px;"><strong>Physical Inventory Count Override:</strong> Directly set physical stock counts on hand with automatic audit trail logs.</li>
          <li style="margin-bottom: 0;"><strong>Granular Security Controls:</strong> Toggle individual Admin permissions for Inventory, Users, Expenses, Reports, and Deletions.</li>
        </ul>
      </div>

      ${button(`${appUrl}/app/admin`, 'Open Admin Portal')}
    `),
  }),
}

function setCors(req, res) {
  const origin = req.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req, res) {
  setCors(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!emailUser || !emailPass) {
    return res.status(500).json({ error: 'Email environment variables are missing (SMTP_USER/GMAIL_USER or SMTP_PASS/GMAIL_APP_PASSWORD)' })
  }

  try {
    const { type, data } = req.body || {}
    const createEmail = templates[type]
    if (!createEmail) return res.status(400).json({ error: `Unknown email type: ${type}` })

    const email = createEmail(data || {})
    if (!email.to) return res.status(400).json({ error: 'Recipient email is required' })

    await transporter.sendMail({
      from: `"${String(fromName).replace(/["\r\n]/g, '')}" <${emailUser}>`,
      replyTo: supportEmail,
      headers: {
        'X-Mailer': 'OptiSmart Portal Service',
        'X-Entity-Ref-ID': Date.now().toString(),
      },
      ...email,
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Email]', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}
