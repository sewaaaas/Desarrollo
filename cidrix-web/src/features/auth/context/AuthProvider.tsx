import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PropsWithChildren } from 'react'
import { authApi } from '@/features/auth/api/auth.api'
import {
  AuthContext,
  AuthenticatedApiContext,
} from '@/features/auth/context/auth-context'
import {
  isUnauthorizedError,
  toSessionSafeError,
} from '@/features/auth/model/auth-errors'
import type {
  AuthContextValue,
  AuthState,
  LoginCredentials,
} from '@/features/auth/model/auth.types'
import {
  AuthOperationSupersededError,
  AuthSessionManager,
} from '@/features/auth/session/auth-session-manager'
import { apiClient } from '@/shared/services/api/api-client'
import type { ApiClient } from '@/shared/services/api/api-client'

const defaultSessionManager = new AuthSessionManager({ apiClient, authApi })

export interface AuthProviderProps extends PropsWithChildren {
  sessionManager?: AuthSessionManager
}

const INITIALIZING_STATE: AuthState = {
  status: 'initializing',
  user: null,
}

export function AuthProvider({
  children,
  sessionManager = defaultSessionManager,
}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(INITIALIZING_STATE)
  const [initializationAttempt, setInitializationAttempt] = useState(0)
  const activeAttemptRef = useRef(0)

  useEffect(() => {
    return sessionManager.subscribe((reason) => {
      setState({ reason, status: 'unauthenticated', user: null })
    })
  }, [sessionManager])

  useEffect(() => {
    const attempt = activeAttemptRef.current + 1
    activeAttemptRef.current = attempt
    let active = true

    void sessionManager
      .initialize()
      .then((user) => {
        if (active && activeAttemptRef.current === attempt) {
          setState({ status: 'authenticated', user })
        }
      })
      .catch((error: unknown) => {
        if (
          !active ||
          activeAttemptRef.current !== attempt ||
          error instanceof AuthOperationSupersededError
        ) {
          return
        }

        if (isUnauthorizedError(error)) {
          setState({ reason: 'initial', status: 'unauthenticated', user: null })
          return
        }

        setState({
          error: toSessionSafeError(error),
          status: 'unavailable',
          user: null,
        })
      })

    return () => {
      active = false
    }
  }, [initializationAttempt, sessionManager])

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const user = await sessionManager.login(credentials)
      setState({ status: 'authenticated', user })
    },
    [sessionManager],
  )

  const logout = useCallback(async () => {
    setState({ reason: 'logout', status: 'unauthenticated', user: null })
    await sessionManager.logout()
  }, [sessionManager])

  const retryInitialization = useCallback(() => {
    sessionManager.resetInitialization()
    setState(INITIALIZING_STATE)
    setInitializationAttempt((currentAttempt) => currentAttempt + 1)
  }, [sessionManager])

  const contextValue = useMemo<AuthContextValue>(
    () => ({ login, logout, retryInitialization, state }),
    [login, logout, retryInitialization, state],
  )

  const authenticatedApi = useMemo<ApiClient>(
    () => ({
      request: sessionManager.request.bind(sessionManager),
    }),
    [sessionManager],
  )

  return (
    <AuthContext.Provider value={contextValue}>
      <AuthenticatedApiContext.Provider value={authenticatedApi}>
        {children}
      </AuthenticatedApiContext.Provider>
    </AuthContext.Provider>
  )
}
