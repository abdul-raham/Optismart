export interface SendWebPushOptions {
  endpoint?: string
  onError?: (error: any) => void
}

/**
 * Call the Vercel web-push endpoint.
 */
export async function sendWebPush(
  userId: string,
  title: string,
  body: string,
  url?: string,
  options: SendWebPushOptions = {}
) {
  try {
    const response = await fetch(options.endpoint || '/api/send-web-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        title,
        body,
        url
      }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(result.error || `Push request failed (${response.status})`)
    }

    return result
  } catch (error: any) {
    if (options.onError) {
      options.onError(error)
      return { success: false, error: error.message }
    }
    // Silently fail if no onError provided, web pushes shouldn't break the app flow
    console.error('[WebPush]', error)
    return { success: false, error: error.message }
  }
}
