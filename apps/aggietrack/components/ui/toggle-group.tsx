"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
    attached?: boolean
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
  attached: false,
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  attached = false,
  children,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
    /** Join the toggles into one control, separated by a shared border. */
    attached?: boolean
  }) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant ?? "default"}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      data-attached={attached ? "" : undefined}
      style={{ "--gap": attached ? 0 : spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
        attached && "items-stretch gap-0 *:focus-visible:relative *:focus-visible:z-10",
        attached &&
          (variant ?? "default") === "default" &&
          "bg-muted p-0.5 has-[[aria-pressed=true]]:bg-primary dark:has-[[aria-pressed=true]]:bg-secondary",
        attached &&
          orientation === "horizontal" &&
          "*:data-[slot=toggle-group-item]:rounded-r-none [&>[data-slot=toggle-group-item]~[data-slot=toggle-group-item]]:rounded-l-none",
        attached &&
          orientation === "horizontal" &&
          (variant ?? "default") === "outline" &&
          "[&>[data-slot=toggle-group-item]:not(:has(~[data-slot=toggle-group-item]))]:rounded-r-lg!",
        attached &&
          orientation === "horizontal" &&
          (variant ?? "default") === "default" &&
          "*:data-[slot=toggle-group-item]:rounded-l-[calc(var(--radius-lg)-0.125rem)] [&>[data-slot=toggle-group-item]:not(:has(~[data-slot=toggle-group-item]))]:rounded-r-[calc(var(--radius-lg)-0.125rem)]! data-[size=sm]:*:data-[slot=toggle-group-item]:rounded-l-[calc(min(var(--radius-md),10px)-0.125rem)] data-[size=sm]:[&>[data-slot=toggle-group-item]:not(:has(~[data-slot=toggle-group-item]))]:rounded-r-[calc(min(var(--radius-md),10px)-0.125rem)]!",
        attached &&
          orientation === "vertical" &&
          "flex-col *:data-[slot=toggle-group-item]:rounded-b-none [&>[data-slot=toggle-group-item]~[data-slot=toggle-group-item]]:rounded-t-none",
        attached &&
          orientation === "vertical" &&
          (variant ?? "default") === "outline" &&
          "[&>[data-slot=toggle-group-item]:not(:has(~[data-slot=toggle-group-item]))]:rounded-b-lg!",
        attached &&
          orientation === "vertical" &&
          (variant ?? "default") === "default" &&
          "*:data-[slot=toggle-group-item]:rounded-t-[calc(var(--radius-lg)-0.125rem)] [&>[data-slot=toggle-group-item]:not(:has(~[data-slot=toggle-group-item]))]:rounded-b-[calc(var(--radius-lg)-0.125rem)]! data-[size=sm]:*:data-[slot=toggle-group-item]:rounded-t-[calc(min(var(--radius-md),10px)-0.125rem)] data-[size=sm]:[&>[data-slot=toggle-group-item]:not(:has(~[data-slot=toggle-group-item]))]:rounded-b-[calc(min(var(--radius-md),10px)-0.125rem)]!",
        attached &&
          (variant ?? "default") === "outline" &&
          orientation === "horizontal" &&
          "*:data-[slot=toggle-group-item]:border *:data-[slot=toggle-group-item]:border-primary [&>[data-slot=toggle-group-item]~[data-slot=toggle-group-item]]:border-l-0",
        attached &&
          (variant ?? "default") === "outline" &&
          orientation === "vertical" &&
          "*:data-[slot=toggle-group-item]:border *:data-[slot=toggle-group-item]:border-primary [&>[data-slot=toggle-group-item]~[data-slot=toggle-group-item]]:border-t-0",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation, attached }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
