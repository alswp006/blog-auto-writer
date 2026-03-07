import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-white",
        secondary:
          "border-transparent bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
        destructive:
          "border-transparent bg-[var(--danger-soft)] text-[var(--danger)]",
        success:
          "border-transparent bg-[var(--success-soft)] text-[var(--success)]",
        warning:
          "border-transparent bg-[var(--warning-soft)] text-[var(--warning)]",
        outline: "text-[var(--text-secondary)] border-[var(--border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
