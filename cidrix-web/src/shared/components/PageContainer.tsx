import type { HTMLAttributes } from 'react'

export type PageContainerProps = HTMLAttributes<HTMLDivElement>

export function PageContainer({ className = '', ...props }: PageContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 ${className}`}
      {...props}
    />
  )
}
