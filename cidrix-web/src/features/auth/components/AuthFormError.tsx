import type { AuthSafeError } from '@/features/auth/model/auth.types'

interface AuthFormErrorProps {
  error: AuthSafeError
}

export function AuthFormError({ error }: AuthFormErrorProps) {
  return (
    <div
      className="rounded-control border border-danger/25 bg-danger/5 px-3 py-2 text-sm leading-5 text-danger"
      role="alert"
    >
      {error.message}
    </div>
  )
}
