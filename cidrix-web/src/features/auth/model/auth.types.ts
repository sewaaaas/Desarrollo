export type UserRole = 'ADMIN' | 'TECHNICIAN' | 'USER'

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
}

export type RefreshResponse = LoginResponse

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  organizationId: string
  avatarUrl: string | null
}

export type AuthSafeErrorKind =
  | 'credentials'
  | 'forbidden'
  | 'network'
  | 'server'
  | 'unexpected'

export interface AuthSafeError {
  code: string
  kind: AuthSafeErrorKind
  message: string
}

export type UnauthenticatedReason = 'initial' | 'expired' | 'logout'

export type AuthState =
  | { status: 'initializing'; user: null }
  | { status: 'authenticated'; user: AuthUser }
  | {
      reason?: UnauthenticatedReason
      status: 'unauthenticated'
      user: null
    }
  | { error: AuthSafeError; status: 'unavailable'; user: null }

export interface AuthContextValue {
  login(credentials: LoginCredentials): Promise<void>
  logout(): Promise<void>
  retryInitialization(): void
  state: AuthState
}
