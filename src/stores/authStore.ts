import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User, UserRole } from '@/types'

interface AuthState {
  user: User | null
  role: UserRole | null
  isLoading: boolean
  isInitializing: boolean
  isAuthenticated: boolean

  // Actions
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      isLoading: false,
      isInitializing: true,
      isAuthenticated: false,

      initialize: async () => {
        set({ isInitializing: true })
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('auth_id', session.user.id)
              .maybeSingle()

            if (profile && profile.status === 'active') {
              set({
                user: profile as User,
                role: profile.role as UserRole,
                isAuthenticated: true,
              })
            } else {
              if (profile && profile.status !== 'active') {
                await supabase.auth.signOut()
              }
              set({ user: null, role: null, isAuthenticated: false })
            }
          } else {
            set({ user: null, role: null, isAuthenticated: false })
          }
        } catch (err) {
          console.error('Auth init error:', err)
          set({ user: null, role: null, isAuthenticated: false })
        } finally {
          set({ isInitializing: false })
        }

        // Listen for auth changes only once
        if (!(window as any)._authListenerAttached) {
          (window as any)._authListenerAttached = true;
          supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('auth_id', session.user.id)
              .maybeSingle()

            if (profile && profile.status === 'active') {
              set({
                user: profile as User,
                role: profile.role as UserRole,
                isAuthenticated: true,
              })
            } else {
              set({ user: null, role: null, isAuthenticated: false })
            }
          } else if (event === 'SIGNED_OUT') {
            set({ user: null, role: null, isAuthenticated: false })
          }
        })
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) {
            set({ isLoading: false })
            return { error: error.message }
          }

          if (data.user) {
            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('auth_id', data.user.id)
              .maybeSingle()

            if (profileError || !profile) {
              await supabase.auth.signOut()
              set({ isLoading: false })
              return { error: 'No portal access. Contact your administrator.' }
            }

            if (profile.status !== 'active') {
              await supabase.auth.signOut()
              set({ isLoading: false })
              return { error: 'Your account is suspended. Contact admin.' }
            }

            set({
              user: profile as User,
              role: profile.role as UserRole,
              isAuthenticated: true,
              isLoading: false,
            })
            return { error: null }
          }

          set({ isLoading: false })
          return { error: 'Login failed. Please try again.' }
        } catch (err) {
          set({ isLoading: false })
          return { error: 'An unexpected error occurred.' }
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null, role: null, isAuthenticated: false })
      },

      setUser: (user) => {
        set({ user, role: user?.role ?? null, isAuthenticated: !!user })
      },
    }),
    {
      name: 'optismart-auth',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
