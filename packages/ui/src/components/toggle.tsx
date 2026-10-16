"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-transparent in-data-attached:text-muted-foreground in-data-attached:group-not-has-[[aria-pressed=true]]/toggle-group:hover:bg-background! in-data-attached:group-not-has-[[aria-pressed=true]]/toggle-group:hover:text-foreground dark:in-data-attached:group-not-has-[[aria-pressed=true]]/toggle-group:hover:bg-secondary! dark:in-data-attached:group-not-has-[[aria-pressed=true]]/toggle-group:hover:text-secondary-foreground in-data-attached:group-has-[[aria-pressed=true]]/toggle-group:text-primary-foreground/80 dark:in-data-attached:group-has-[[aria-pressed=true]]/toggle-group:not-aria-[pressed=true]:text-secondary-foreground in-data-attached:group-has-[[aria-pressed=true]]/toggle-group:not-aria-[pressed=true]:hover:bg-[color-mix(in_oklch,var(--accent)_70%,black)]! dark:in-data-attached:group-has-[[aria-pressed=true]]/toggle-group:not-aria-[pressed=true]:hover:bg-[color-mix(in_oklch,var(--accent)_85%,black)]! in-data-attached:group-has-[[aria-pressed=true]]/toggle-group:not-aria-[pressed=true]:hover:text-accent-foreground dark:in-data-attached:group-has-[[aria-pressed=true]]/toggle-group:not-aria-[pressed=true]:hover:text-accent-foreground! in-data-attached:aria-pressed:bg-accent! in-data-attached:aria-pressed:text-accent-foreground in-data-attached:aria-pressed:hover:bg-accent! in-data-attached:aria-pressed:hover:text-accent-foreground in-data-attached:aria-pressed:shadow-none in-data-attached:data-[state=on]:bg-accent! in-data-attached:data-[state=on]:text-accent-foreground",
        outline:
          "border border-input bg-transparent text-primary hover:bg-accent/25 hover:text-accent-foreground dark:text-foreground dark:hover:text-foreground in-data-attached:border-primary in-data-attached:shadow-none in-data-attached:not-aria-[pressed=true]:hover:bg-accent/25! in-data-attached:not-aria-[pressed=true]:hover:text-accent-foreground dark:in-data-attached:not-aria-[pressed=true]:hover:text-foreground in-data-attached:aria-pressed:bg-primary! in-data-attached:aria-pressed:text-primary-foreground in-data-attached:aria-pressed:hover:bg-primary! in-data-attached:aria-pressed:hover:text-primary-foreground in-data-attached:data-[state=on]:bg-primary! in-data-attached:data-[state=on]:text-primary-foreground",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
