import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

// Capture initial URL hash/query BEFORE createClient strips window.location.hash
export const authUrlState: {
  isRecovery: boolean
  tokenHash: string | null
  error: string | null
  errorCode: string | null
} = {
  isRecovery: false,
  tokenHash: null,
  error: null,
  errorCode: null,
}

if (typeof window !== 'undefined') {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const queryParams = new URLSearchParams(window.location.search)

  const type = hashParams.get('type') || queryParams.get('type')
  const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash')
  const errorCode = hashParams.get('error_code') || queryParams.get('error_code')
  const error = hashParams.get('error') || queryParams.get('error')
  const errorDesc = hashParams.get('error_description') || queryParams.get('error_description')

  if (type === 'recovery' || tokenHash) {
    authUrlState.isRecovery = true
  }
  if (tokenHash) {
    authUrlState.tokenHash = tokenHash
  }
  if (errorDesc || errorCode || error) {
    authUrlState.errorCode = errorCode
    authUrlState.error = errorDesc ? errorDesc.replace(/\+/g, ' ') : error
  }

  // If Supabase redirected to root '/' with a recovery token or OTP error hash,
  // route directly to /auth/update-password before React Router initializes.
  const hasAuthCallbackOnWrongPath =
    window.location.pathname !== '/auth/update-password' &&
    (type === 'recovery' ||
      Boolean(tokenHash) ||
      errorCode === 'otp_expired' ||
      error === 'access_denied' ||
      Boolean(errorDesc))

  if (hasAuthCallbackOnWrongPath) {
    window.history.replaceState(
      null,
      '',
      '/auth/update-password' + window.location.search + window.location.hash,
    )
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: { 'x-application-name': 'optismart' },
  },
})

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      authUrlState.isRecovery = true
      authUrlState.error = null
      if (window.location.pathname !== '/auth/update-password') {
        window.location.replace('/auth/update-password')
      }
    }
  })
}
