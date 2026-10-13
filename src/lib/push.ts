import { supabase } from '@/lib/supabase'

export interface SendWebPushOptions {
  type?: 'order' | 'job' | 'payment' | 'system' | 'training' | 'commission'
  onError?: (error: any) => void
}

/**
 * Notify a portal user. Creates an in-app notification; the database then pushes it to every device the user
 * enabled notifications on. (Pushes are only sent by the database, so nobody can push to users directly.)
 */
export async function sendWebPush(
  userId: string,
  title: string,
  body: string,
  url?: string,
  options: SendWebPushOptions = {}
) {
  const { error } = await supabase.rpc('send_portal_notification', {
    p_user: userId, p_title: title, p_message: body, p_link: url || '/app', p_type: options.type || 'system',
  })
  if (error) {
    if (options.onError) options.onError(error)
    else console.error('[Notify]', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}
