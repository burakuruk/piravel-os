import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Piravel buton sözleşmesi (06 §9): 4 tür, sayfa başına tek primary.
 * Primary lacivert — altın asla buton zemini değildir (06 §3).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-navy-900 text-white hover:bg-navy-800",
        secondary: "bg-surface text-navy-900 border border-line-300 hover:bg-fill-100",
        ghost: "text-navy-500 hover:bg-fill-100",
        destructive: "bg-danger text-white hover:opacity-90",
      },
      size: {
        default: "h-9 px-4",
        table: "h-7 px-2 text-[13px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * React 19'da `ref` sıradan bir prop'tur ve forwardRef gerekmez; ama tipe
   * açıkça yazılmadan geçmez. Pencerelerin açılışta odağı bir düğmeye
   * taşıması için gerekli.
   */
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
