import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { sendWebPush } from '@/lib/push'

export async function checkDSAPerformanceWindows() {
  try {
    // 1. Fetch active DSAs (skip suspended accounts)
    const { data: dsas, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'dsa')
      .eq('status', 'active')

    if (error || !dsas) return

    const now = new Date()

    for (const dsa of dsas) {
      // Calculate start date of performance window
      const startDate = dsa.performance_start_date ? new Date(dsa.performance_start_date) : new Date(dsa.created_at || now)
      const diffMs = now.getTime() - startDate.getTime()
      const elapsedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      // Fetch delivered sales in current performance window
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('dsa_id', dsa.id)
        .eq('status', 'delivered')
        .gte('created_at', startDate.toISOString())

      const salesCount = orders?.length || 0

      // Case 1: Day 4 Warning to DSA (0 sales)
      if (elapsedDays >= 4 && elapsedDays < 5 && salesCount === 0 && !dsa.eviction_warning_day4_sent && dsa.status === 'active') {
        if (dsa.email) {
          sendEmail('dsa_day4_warning', {
            recipientEmail: dsa.email,
            dsaName: dsa.full_name || 'Agent',
            elapsedDays: 4,
          }).catch(console.error)
        }
        sendWebPush(
          dsa.id,
          'Performance Warning: 0 Sales in 4 Days',
          'Urgent: You have 0 sales in the last 4 days. Please buckle up to meet your target and avoid account suspension!',
          '/app/dsa'
        ).catch(console.error)

        await supabase
          .from('users')
          .update({ eviction_warning_day4_sent: true })
          .eq('id', dsa.id)
      }

      // Case 2: Day 5 Alert to Admins (0 sales)
      if (elapsedDays >= 5 && elapsedDays < 7 && salesCount === 0 && !dsa.eviction_alert_day5_sent && dsa.status === 'active') {
        // Fetch DSA's leads count for the report
        const { data: leads } = await supabase.from('leads').select('id').eq('dsa_id', dsa.id)
        const leadsCount = leads?.length || 0

        // Fetch admins
        const { data: admins } = await supabase.from('users').select('id, email').in('role', ['admin', 'super_admin'])
        if (admins) {
          for (const admin of admins) {
            if (admin.email) {
              sendEmail('admin_day5_alert', {
                recipientEmail: admin.email,
                dsaName: dsa.full_name || dsa.email,
                dsaEmail: dsa.email,
                dsaPhone: dsa.phone || 'N/A',
                leadsCount,
                salesCount: 0,
                elapsedDays: 5,
              }).catch(console.error)
            }
            sendWebPush(
              admin.id,
              'Underperformance Alert: DSA Sales Warning',
              `DSA ${dsa.full_name || dsa.email} has 0 sales on Day 5 (Leads: ${leadsCount}). Check User Details.`,
              `/app/admin/users/${dsa.id}`
            ).catch(console.error)
          }
        }

        await supabase
          .from('users')
          .update({ eviction_alert_day5_sent: true })
          .eq('id', dsa.id)
      }

      // Case 3: Day 7 Automatic Eviction (Suspension + Admin Deletion Prompt)
      if (elapsedDays >= (dsa.performance_window_days || 7) && salesCount === 0 && dsa.status === 'active') {
        await supabase
          .from('users')
          .update({
            status: 'suspended',
            probation_status: 'evicted',
            updated_at: now.toISOString()
          })
          .eq('id', dsa.id)

        // Notify Admins with Deletion Prompt
        const { data: admins } = await supabase.from('users').select('id, email').in('role', ['admin', 'super_admin'])
        if (admins) {
          for (const admin of admins) {
            if (admin.email) {
              sendEmail('admin_day7_eviction_prompt', {
                recipientEmail: admin.email,
                dsaName: dsa.full_name || dsa.email,
                dsaId: dsa.id,
                reason: '0 sales in 7 working days'
              }).catch(console.error)
            }
            sendWebPush(
              admin.id,
              'DSA Suspended: Eviction & Delete Prompt',
              `DSA ${dsa.full_name || dsa.email} was automatically suspended due to 0 sales in 7 days. Would you like to delete this account?`,
              `/app/admin/users/${dsa.id}`
            ).catch(console.error)
          }
        }
      }
    }
  } catch (err) {
    console.error('Error running checkDSAPerformanceWindows:', err)
  }
}

export async function resetDSAPerformanceWindow(dsaId: string) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('users')
    .update({
      performance_start_date: now,
      eviction_warning_day4_sent: false,
      eviction_alert_day5_sent: false,
      status: 'active',
      probation_status: 'active',
      updated_at: now
    })
    .eq('id', dsaId)

  if (error) throw error
  return true
}
