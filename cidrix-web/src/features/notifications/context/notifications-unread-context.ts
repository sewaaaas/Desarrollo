import { createContext, useContext } from 'react'

export interface NotificationsUnreadState {
  count: number | null
  error: string | null
  loading: boolean
  refresh: () => void
}

export const NotificationsUnreadContext = createContext<NotificationsUnreadState | undefined>(undefined)

export function useNotificationsUnread(): NotificationsUnreadState {
  const context = useContext(NotificationsUnreadContext)
  if (!context) throw new Error('useNotificationsUnread requiere NotificationsUnreadProvider')
  return context
}
