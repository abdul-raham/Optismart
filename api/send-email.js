import nodemailer from 'nodemailer'

const gmailUser = process.env.GMAIL_USER
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD
const fromName = process.env.EMAIL_FROM_NAME || 'OptiSmart Portal'
const supportEmail = process.env.EMAIL_SUPPORT_ADDRESS || gmailUser
const appUrl = process.env.APP_URL || 'http://localhost:5173'
const allowedOrigins = new Set(
  String(process.env.EMAIL_ALLOWED_ORIGINS || appUrl)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: gmailUser, pass: gmailAppPassword },
  pool: true,
  rateLimit: true,
})

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
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; background-color: #f8fafc; }
      table { border-collapse: collapse; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); margin-top: 40px; margin-bottom: 40px; }
      .header { background: linear-gradient(135deg, #0A74FF 0%, #00d2ff 100%); padding: 48px 32px; text-align: center; }
      .header-title { color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
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
              Questions? We're here to help. <br/>
              Contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a><br><br>
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
      <p>Your portal account has been successfully created and is ready to use. We are thrilled to have you join the <strong>${escapeHtml(fromName)}</strong> ecosystem.</p>
      <p>Click the button below to access your dashboard, manage operations, and grow your security business.</p>
      ${button(`${appUrl}/login`, 'Open Your Portal')}
    `),
  }),

  new_lead: ({ dsaEmail, dsaName, customerName }) => ({
    to: dsaEmail,
    subject: `New Lead Captured: ${customerName}`,
    html: layout('New Pipeline Activity', `
      <h2>Great job, ${escapeHtml(dsaName)}! 🎉</h2>
      <p>You have successfully added a new lead to your pipeline: <strong>${escapeHtml(customerName)}</strong>.</p>
      <p>Consistent follow-ups are the key to high conversion rates. Log in now to schedule a reminder or update the lead status.</p>
      ${button(`${appUrl}/app/leads`, 'Manage Pipeline')}
    `),
  }),

  new_order: ({ recipientEmail, orderNumber, customerName }) => ({
    to: recipientEmail,
    subject: `Order Confirmation - ${orderNumber}`,
    html: layout('Order Confirmed', `
      <h2>Order Successfully Placed</h2>
      <p>A new order has been generated and is now in processing.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Order Reference</p>
        <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">${escapeHtml(orderNumber)}</p>
        <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Customer</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #334155;">${escapeHtml(customerName)}</p>
        </div>
      </div>
      <p>You can track the fulfillment status and assign an installer directly from the portal.</p>
      ${button(`${appUrl}/app/orders`, 'Track Order')}
    `),
  }),

  order_status_update: ({ recipientEmail, customerName, orderNumber, status }) => ({
    to: recipientEmail,
    subject: `Order Status Updated: ${status.toUpperCase()} - ${orderNumber}`,
    html: layout('Order Status Update', `
      <h2>Order Status Changed</h2>
      <p>The status of order <strong>${escapeHtml(orderNumber)}</strong> for <strong>${escapeHtml(customerName)}</strong> has been updated to <strong style="text-transform: uppercase; color: #0A74FF;">${escapeHtml(status)}</strong>.</p>
      <p>Log in to view the full details of this order.</p>
      ${button(`${appUrl}/app/orders`, 'View Order')}
    `),
  }),

  commission_paid: ({ dsaEmail, dsaName, amount, orderNumber }) => ({
    to: dsaEmail,
    subject: `Commission Paid! 💰`,
    html: layout('Commission Paid', `
      <h2>Hello ${escapeHtml(dsaName)},</h2>
      <p>Great news! Your commission of <strong>${escapeHtml(amount)}</strong> for order <strong>${escapeHtml(orderNumber)}</strong> has been marked as PAID.</p>
      <p>Keep up the great work and check your dashboard for the latest pipeline updates.</p>
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
      <p>Please log in to your portal to review the job details and contact the customer to arrange a time.</p>
      ${button(`${appUrl}/app/installer/dashboard`, 'View Job Details')}
    `),
  }),

  account_approved: ({ recipientEmail, recipientName, role }) => ({
    to: recipientEmail,
    subject: `Your ${escapeHtml(role).toUpperCase()} Account is Approved!`,
    html: layout('Account Approved', `
      <h2>Welcome, ${escapeHtml(recipientName)}!</h2>
      <p>Your <strong>${escapeHtml(role)}</strong> account has been reviewed and approved by the admin team.</p>
      <p>You can now log in to the OptiSmart portal and access all your tools.</p>
      ${button(`${appUrl}/login`, 'Login Now')}
    `),
  }),

  new_order: ({ recipientEmail, orderNumber, customerName, totalAmount }) => ({
    to: recipientEmail,
    subject: `New Order Created: ${orderNumber}`,
    html: layout('Order Confirmation', `
      <h2>Hello,</h2>
      <p>A new order has been successfully created.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Order Reference</p>
        <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">${escapeHtml(orderNumber)}</p>
        <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Customer</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #334155;">${escapeHtml(customerName)}</p>
          <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Total Amount</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #334155;">₦${Number(totalAmount).toLocaleString()}</p>
        </div>
      </div>
      <p>Log in to your portal to view more details.</p>
      ${button(`${appUrl}/login`, 'View Order')}
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
  if (!gmailUser || !gmailAppPassword) {
    return res.status(500).json({ error: 'Email environment variables are missing' })
  }

  try {
    const { type, data } = req.body || {}
    const createEmail = templates[type]
    if (!createEmail) return res.status(400).json({ error: \`Unknown email type: \${type}\` })

    const email = createEmail(data || {})
    if (!email.to) return res.status(400).json({ error: 'Recipient email is required' })

    await transporter.sendMail({
      from: \`"\${String(fromName).replace(/["\\r\\n]/g, '')}" <\${gmailUser}>\`,
      ...email,
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Email]', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}
