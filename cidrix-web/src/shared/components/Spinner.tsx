import type { HTMLAttributes } from 'react'

const sizeClasses = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-9 border-[3px]',
} as const

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  label?: string
  size?: keyof typeof sizeClasses
}

export function Spinner({
  className = '',
  label = 'Cargando',
  size = 'md',
  ...props
}: SpinnerProps) {
  return (
    <span
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-current border-r-transparent ${sizeClasses[size]} ${className}`}
      role="status"
      {...props}
    />
  )
}
