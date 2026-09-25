import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '@/shared/components/Spinner'

const variantClasses = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary:
    'border border-border bg-surface text-foreground hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:brightness-90',
} as const

const sizeClasses = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  size?: keyof typeof sizeClasses
  variant?: keyof typeof variantClasses
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className = '',
    disabled,
    isLoading = false,
    size = 'md',
    type = 'button',
    variant = 'primary',
    ...props
  },
  ref,
) {
  return (
    <button
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      ref={ref}
      type={type}
      {...props}
    >
      {isLoading ? <Spinner label="Procesando" size="sm" /> : null}
      {children}
    </button>
  )
})
