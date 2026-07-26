import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Durum rozeti (06 §9): 20px, işlevsel renk çiftleri.
 * obligation_status eşlemesi: draft→info, pending→outline, partially_paid→warning,
 * paid→success, overdue→danger, cancelled→muted, refunded→info.
 */
const badgeVariants = cva(
  "inline-flex h-5 items-center rounded-sm px-1.5 text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        outline: "border border-line-300 text-ink-600",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        danger: "bg-danger-bg text-danger",
        info: "bg-info-bg text-info",
        muted: "bg-fill-100 text-ink-400",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
