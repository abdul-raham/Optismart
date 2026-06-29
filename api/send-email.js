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
  return `<div style="text-align:center;margin:32px 0">
    <a href="${safeUrl(href)}" style="display:inline-block;padding:14px 26px;background:#0A74FF;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">${escapeHtml(label)}</a>
  </div>`
}

function layout(content) {
  return `<!doctype html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:32px 16px">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.05)">
          <tr><td style="padding:28px 32px;background:#0A74FF;color:#fff;text-align:center"><strong style="font-size:24px">${escapeHtml(fromName)}</strong></td></tr>
          <tr><td style="padding:36px 32px;line-height:1.6">${content}</td></tr>
          <tr><td style="padding:24px 32px;background:#f8fafc;text-align:center;color:#64748b;font-size:12px">Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#0A74FF">${escapeHtml(supportEmail)}</a><br>&copy; ${new Date().getFullYear()} ${escapeHtml(fromName)}</td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`
}

const templates = {
  welcome: ({ recipientEmail, recipientName }) => ({
    to: recipientEmail,
    subject: `Welcome to ${fromName}`,
    html: layout(`
      <h2 style="margin-top:0">Welcome, ${escapeHtml(recipientName)}!</h2>
      <p>Your portal account is ready. You can now log in to ${escapeHtml(fromName)}.</p>
      ${button(`${appUrl}/login`, 'Open Portal')}
    `),
  }),

  new_lead: ({ dsaEmail, dsaName, customerName }) => ({
    to: dsaEmail,
    subject: `New Lead Added: ${customerName}`,
    html: layout(`
      <h2 style="margin-top:0">Lead Captured</h2>
      <p>Hello ${escapeHtml(dsaName)}, you have successfully added <strong>${escapeHtml(customerName)}</strong> to your OptiSmart pipeline.</p>
      ${button(`${appUrl}/dsa/leads`, 'View Leads')}
    `),
  }),

  new_order: ({ recipientEmail, orderNumber, customerName }) => ({
    to: recipientEmail,
    subject: `New Order Created - ${orderNumber}`,
    html: layout(`
      <h2 style="margin-top:0">Order Confirmed</h2>
      <p>A new order (<strong>${escapeHtml(orderNumber)}</strong>) has been successfully created for ${escapeHtml(customerName)}.</p>
      ${button(`${appUrl}/dsa/orders`, 'View Orders')}
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
    if (!createEmail) return res.status(400).json({ error: `Unknown email type: ${type}` })

    const email = createEmail(data || {})
    if (!email.to) return res.status(400).json({ error: 'Recipient email is required' })

    await transporter.sendMail({
      from: `"${String(fromName).replace(/["\r\n]/g, '')}" <${gmailUser}>`,
      ...email,
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Email]', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}

export { escapeHtml, layout, templates }
