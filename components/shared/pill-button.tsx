import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const pillButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full font-bold whitespace-nowrap transition-[filter,background-color] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:brightness-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Acción principal: color de acento. */
        primary: "bg-accent text-accent-foreground",
        /** Sobre un Hero claro/de color: invierte fondo y texto. */
        inverse: "bg-foreground text-background",
        /** Secundario con borde. */
        outline: "border border-border bg-transparent text-foreground",
        /** Secundario relleno. */
        soft: "bg-surface-2 text-foreground",
      },
      size: {
        lg: "min-h-[54px] px-6 text-base",
        md: "min-h-11 px-5 text-sm",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "lg", fullWidth: false },
  },
);

type PillButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof pillButtonVariants> & { asChild?: boolean };

export function PillButton({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  ...props
}: PillButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="pill-button"
      className={cn(pillButtonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

export { pillButtonVariants };
