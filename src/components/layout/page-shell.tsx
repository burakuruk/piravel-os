import { cn } from "@/lib/utils";

/**
 * Sayfa içerik kabuğu — kenar boşluğu ve azami genişlik tek yerde.
 *
 * Sayfalar bu sarmalayıcıyı kullanmazsa içerik doğrudan sidebar'a yapışır;
 * her sayfanın kendi `px-` değerini yazması da zamanla tutarsızlık üretir.
 * Ölçüler dashboard ile aynıdır (06 §3): 24px yatay, geniş ekranda 32px.
 */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto w-full max-w-[1320px] flex-1 px-6 py-6 lg:px-8", className)}>
      {children}
    </main>
  );
}
