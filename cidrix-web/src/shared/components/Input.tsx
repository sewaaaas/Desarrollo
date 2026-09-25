import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  helperText?: ReactNode
  label: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', error, helperText, id, label, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = error || helperText ? `${inputId}-description` : undefined

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        className={`min-h-10 w-full rounded-control border bg-surface px-3 py-2 text-sm text-foreground shadow-card transition-colors placeholder:text-foreground-muted disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 ${
          error ? 'border-danger' : 'border-border hover:border-foreground-muted'
        } ${className}`}
        id={inputId}
        ref={ref}
        {...props}
      />
      {descriptionId ? (
        <p
          className={`text-sm ${error ? 'text-danger' : 'text-foreground-muted'}`}
          id={descriptionId}
        >
          {error ?? helperText}
        </p>
      ) : null}
    </div>
  )
})
