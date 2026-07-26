import { cn } from "@/lib/utils";

/** Kart (06 §9): beyaz zemin, 1px çizgi, neredeyse görünmez gölge. Kutu koleksiyonu değildir. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md border border-line-200 bg-surface shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between px-5 pt-4 pb-2", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold text-ink-900", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-4", className)} {...props} />;
}
