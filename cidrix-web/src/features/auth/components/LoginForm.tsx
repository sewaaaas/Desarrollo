import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AuthFormError } from '@/features/auth/components/AuthFormError'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { toLoginSafeError } from '@/features/auth/model/auth-errors'
import type { AuthSafeError } from '@/features/auth/model/auth.types'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'

interface FieldErrors {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateFields(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  const normalizedEmail = email.trim()

  if (!normalizedEmail) {
    errors.email = 'Ingresa tu correo electrónico.'
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = 'Ingresa un correo electrónico válido.'
  }

  if (!password) {
    errors.password = 'Ingresa tu contraseña.'
  } else if (password.length < 6) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres.'
  }

  return errors
}

export function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<AuthSafeError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
    setFieldErrors((current) => ({ ...current, email: undefined }))
    setFormError(null)
  }

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value)
    setFieldErrors((current) => ({ ...current, password: undefined }))
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const errors = validateFields(email, password)
    setFieldErrors(errors)
    setFormError(null)

    if (errors.email || errors.password) {
      if (errors.email) {
        emailRef.current?.focus()
      } else {
        passwordRef.current?.focus()
      }
      return
    }

    setIsSubmitting(true)

    try {
      await login({ email: email.trim(), password })
    } catch (error: unknown) {
      setFormError(toLoginSafeError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="mt-5 grid gap-3"
      noValidate
      onSubmit={handleSubmit}
    >
      <Input
        autoComplete="username"
        disabled={isSubmitting}
        error={fieldErrors.email}
        label="Correo electrónico"
        name="email"
        onChange={handleEmailChange}
        ref={emailRef}
        required
        type="email"
        value={email}
      />
      <Input
        autoComplete="current-password"
        disabled={isSubmitting}
        error={fieldErrors.password}
        label="Contraseña"
        minLength={6}
        name="password"
        onChange={handlePasswordChange}
        ref={passwordRef}
        required
        type="password"
        value={password}
      />
      {formError ? <AuthFormError error={formError} /> : null}
      <Button
        className="mt-1 w-full"
        isLoading={isSubmitting}
        size="md"
        type="submit"
      >
        Iniciar sesión
      </Button>
    </form>
  )
}
