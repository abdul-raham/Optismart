export interface SendEmailOptions {
  endpoint?: string
  onError?: (error: any) => void
}

/**
 * Call the Vercel email endpoint.
 *
 * Await the returned promise when delivery is part of the user-visible flow.
 * For non-critical mail, omit await and pass an onError callback.
 */
export async function sendEmail(
  type: 'welcome' | 'new_lead' | 'new_order' | 'order_status_update' | 'commission_paid' | 'job_assigned' | 'account_approved' | 'dsa_day4_warning' | 'admin_day5_alert' | 'admin_day7_eviction_prompt' | 'portal_update_dsa' | 'portal_update_admin' | 'password_reset',
  data: Record<string, any>,
  options: SendEmailOptions = {}
) {
  try {
    const response = await fetch(options.endpoint || '/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      // Silently ignore on localhost where API routes don't exist
      if (window.location.hostname === 'localhost') return { success: false }
      throw new Error(result.error || `Email request failed (${response.status})`)
    }

    return result
  } catch (error: any) {
    if (options.onError) {
      options.onError(error)
      return { success: false, error: error.message }
    }
    console.error('sendEmail failed:', error)
    return { success: false, error: error.message }
  }
}

export async function notifyAdminsNewOrder(orderData: {
  orderNumber: string
  customerName: string
  amount: number
  creatorName?: string
}) {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: admins } = await supabase
      .from('users')
      .select('email')
      .in('role', ['admin', 'super_admin'])

    if (!admins || admins.length === 0) return

    for (const admin of admins) {
      if (admin.email) {
        sendEmail(
          'new_order',
          {
            recipientEmail: admin.email,
            orderNumber: orderData.orderNumber,
            customerName: orderData.customerName,
            amount: orderData.amount,
            creatorName: orderData.creatorName || 'Portal User'
          },
          { onError: (err) => console.warn(`Admin notification failed for ${admin.email}:`, err) }
        )
      }
    }
  } catch (error) {
    console.warn('Error fetching admin emails for order notification:', error)
  }
}

/**
 * Dispatch role-tailored portal update announcement emails to all active portal users.
 * - DSAs receive DSA-specific portal enhancements (Instant commission logging, live leaderboard, etc.)
 * - Admins receive Admin-specific enhancements (Dual sales rights, account consolidation, fail-safe commission engine, etc.)
 */
export async function notifyAllUsersPortalUpdate() {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: users, error } = await supabase
      .from('users')
      .select('email, full_name, role')
      .eq('status', 'active')

    if (error || !users) return { count: 0 }

    let sentCount = 0
    for (const u of users) {
      if (!u.email) continue

      const isAdmin = u.role === 'admin' || u.role === 'super_admin'
      const emailType = isAdmin ? 'portal_update_admin' : 'portal_update_dsa'

      sendEmail(
        emailType,
        {
          recipientEmail: u.email,
          recipientName: u.full_name || 'Portal User'
        },
        { onError: (err) => console.warn(`Portal update email failed for ${u.email}:`, err) }
      ).catch(console.warn)

      sentCount++
    }

    return { count: sentCount }
  } catch (err) {
    console.error('Error notifying all users of portal update:', err)
    return { count: 0, error: err }
  }
}

/**
 * Send a direct password-reset link via /api/send-email (using Supabase Admin generateLink + Gmail SMTP),
 * falling back to supabase.auth.resetPasswordForEmail only in local Vite-only dev.
 */
export async function requestPasswordResetEmail(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase()
  const origin = window.location.origin

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'password_reset',
        data: { email: cleanEmail, origin },
      }),
    })

    if (res.ok) return

    // If running local Vite dev server without /api, fall back to client Supabase call
    if (res.status === 404 && window.location.hostname === 'localhost') {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/update-password`,
      })
      if (error) throw error
      return
    }

    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to send password reset link.')
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to send password reset link.')
  }
}



