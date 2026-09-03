import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border text-muted-foreground',
        bull: 'border-bull/40 bg-bull/15 text-bull',
        bear: 'border-bear/40 bg-bear/15 text-bear',
        warn: 'border-warn/40 bg-warn/15 text-warn',
        neutral: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
