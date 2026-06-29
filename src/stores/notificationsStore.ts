import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: (userId: string) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllRead: (userId: string) => Promise<void>
  addNotification: (n: Notification) => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (userId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const notifications = data ?? []
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
      loading: false,
    })
  },

  markAsRead: async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllRead: async (userId) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
  },

  addNotification: (n) => {
    set((state) => ({
      notifications: [n, ...state.notifications],
      unreadCount: state.unreadCount + (n.is_read ? 0 : 1),
    }))
  },
}))
