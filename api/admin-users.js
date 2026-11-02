import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Admins create portal accounts here (creating a login needs the service key, so it can't run in the browser).
// Super admins can create any role; admins with "manage users" can create dsa, installer, reseller and outlet.
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ROLES = ['super_admin', 'admin', 'dsa', 'installer', 'reseller', 'outlet']
const ADMIN_ROLES = ['super_admin', 'admin']

function temporaryPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 12 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server is not configured' })
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in first' })

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user: authUser }, error: authError } = await db.auth.getUser(token)
  if (authError || !authUser) return res.status(401).json({ error: 'Your session has expired. Sign in again.' })
  const { data: caller } = await db.from('users').select('role,status,can_manage_users').eq('auth_id', authUser.id).maybeSingle()
  const allowed = caller && caller.status === 'active' && (caller.role === 'super_admin' || (caller.role === 'admin' && caller.can_manage_users))
  if (!allowed) return res.status(403).json({ error: 'You do not have permission to create accounts' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const fullName = String(body.full_name || '').trim().slice(0, 120)
  const email = String(body.email || '').trim().toLowerCase()
  const phone = String(body.phone || '').trim().slice(0, 30)
  const role = String(body.role || 'dsa')
  if (fullName.length < 2) return res.status(400).json({ error: 'Enter the full name' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Choose a valid role' })
  if (ADMIN_ROLES.includes(role) && caller.role !== 'super_admin') return res.status(403).json({ error: 'Only a super admin can create admin accounts' })

  const password = temporaryPassword()
  const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, phone } })
  if (createError) {
    const exists = /already|registered|exists/i.test(createError.message)
    return res.status(exists ? 409 : 400).json({ error: exists ? 'An account with this email already exists' : 'The account could not be created' })
  }
  // The sign-up trigger creates the profile as a DSA; set the chosen role and details (service role bypasses the guard).
  const { error: profileError } = await db.from('users').update({ role, full_name: fullName, phone: phone || null, status: 'active', updated_at: new Date().toISOString() }).eq('auth_id', created.user.id)
  if (profileError) return res.status(500).json({ error: 'Login created, but the profile could not be set. Refresh and set the role on the user.' })
  return res.status(200).json({ ok: true, email, password })
}
