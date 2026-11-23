import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthenticatedApi } from '@/features/auth/hooks/useAuthenticatedApi'
import { createNotificationsApi } from '../api/notifications.api'
import { notificationErrorMessage } from '../model/notification.utils'
import { NotificationsUnreadContext } from './notifications-unread-context'

function UnreadSessionProvider({ children }: PropsWithChildren) {
  const client = useAuthenticatedApi()
  const api = useMemo(() => createNotificationsApi(client), [client])
  const [version, setVersion] = useState(0)
  const [resource, setResource] = useState<{ count: number | null; error: string | null; version: number }>({
    count: null, error: null, version: -1,
  })
  const refresh = useCallback(() => setVersion((current) => current + 1), [])
  const loading = resource.version !== version

  useEffect(() => {
    const controller = new AbortController()
    void api.getUnreadCount(controller.signal)
      .then(({ count }) => {
        if (!controller.signal.aborted) setResource({ count, error: null, version })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setResource({ count: null, error: notificationErrorMessage(error, 'No se pudo cargar el conteo de no leídas.'), version })
        }
      })
    return () => controller.abort()
  }, [api, version])

  const value = useMemo(() => ({ count: resource.count, error: loading ? null : resource.error, loading, refresh }), [resource, loading, refresh])
  return <NotificationsUnreadContext.Provider value={value}>{children}</NotificationsUnreadContext.Provider>
}

export function NotificationsUnreadProvider({ children }: PropsWithChildren) {
  const { state } = useAuth()
  if (state.status !== 'authenticated') {
    return (
      <NotificationsUnreadContext.Provider value={{ count: null, error: null, loading: false, refresh: () => undefined }}>
        {children}
      </NotificationsUnreadContext.Provider>
    )
  }
  return <UnreadSessionProvider key={`${state.user.organizationId}:${state.user.id}`}>{children}</UnreadSessionProvider>
}
