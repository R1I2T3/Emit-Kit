import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@Emitkit/ui/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20",
        secondary:
          "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700/80",
        destructive:
          "border-transparent bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
        outline: "text-foreground border-border",
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
