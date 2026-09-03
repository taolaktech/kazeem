import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface FieldProps {
  label: string
  value: ReactNode
  className?: string
  valueClassName?: string
}

/** Compact label/value row used across the detail cards. */
export function Field({ label, value, className, valueClassName }: FieldProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1', className)}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('tabular text-sm font-medium text-foreground', valueClassName)}>
        {value}
      </span>
    </div>
  )
}

export function FieldGrid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <div
      className={cn(
        'grid gap-x-6',
        columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2',
      )}
    >
      {children}
    </div>
  )
}
