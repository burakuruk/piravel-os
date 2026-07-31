import { Bell, Search } from "lucide-react";
import type { UserRole } from "@/lib/auth-policy";
import { MobileNav } from "./mobile-nav";

/**
 * Topbar (06 §8): 56px, beyaz, altta 1px çizgi.
 * Masaüstü : breadcrumb + global arama (⌘K) + bildirim zili
 * Mobil    : [hamburger] — sağda [arama] [bildirim]
 *            Breadcrumb gösterilmez; büyük sayfa başlığı zaten içerikte.
 */
export function Topbar({
  breadcrumb = "Genel Bakış",
  role,
  fullName,
}: {
  breadcrumb?: string;
  role: UserRole;
  fullName: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-line-200 bg-surface px-6 max-md:px-4">
      <MobileNav role={role} fullName={fullName} />
      <div className="text-sm text-ink-600 max-lg:hidden">{breadcrumb}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          /* ⚠ Mobilde dokunma hedefi en az 44 px (06 §15): masaüstünde h-9
             yoğunluğu korunur, parmak için max-sm altında 44 px'e çıkar. */
          className="max-sm:min-h-11 max-sm:min-w-11 flex h-9 w-64 items-center gap-2 rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-400 hover:border-navy-500 max-md:w-9 max-md:justify-center max-md:px-0"
          aria-label="Global arama"
        >
          <Search size={15} strokeWidth={1.75} />
          <span className="flex-1 text-left max-md:hidden">Ara…</span>
          <kbd className="rounded-sm border border-line-200 bg-fill-100 px-1 text-[11px] text-ink-400 max-md:hidden">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          className="max-sm:min-h-11 max-sm:min-w-11 relative flex h-9 w-9 items-center justify-center rounded-sm text-ink-600 hover:bg-fill-100"
          aria-label="Bildirimler"
        >
          <Bell size={17} strokeWidth={1.75} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
      </div>
    </header>
  );
}
