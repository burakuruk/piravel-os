"use client";

import { Bell, Search } from "lucide-react";

/**
 * Topbar (06 §8): 56px, beyaz, altta 1px çizgi.
 * Breadcrumb + global arama (⌘K — Sprint 1'de API'ye bağlanır, rol+kapsam
 * filtresi API seviyesindedir) + bildirim zili.
 */
export function Topbar({ breadcrumb = "Genel Bakış" }: { breadcrumb?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-line-200 bg-surface px-6">
      <div className="text-sm text-ink-600">{breadcrumb}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-9 w-64 items-center gap-2 rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-400 hover:border-navy-500 max-md:w-9 max-md:justify-center max-md:px-0"
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
          className="relative flex h-9 w-9 items-center justify-center rounded-sm text-ink-600 hover:bg-fill-100"
          aria-label="Bildirimler"
        >
          <Bell size={17} strokeWidth={1.75} />
          {/* Kritik bildirim noktası — Sprint 6'da gerçek veriye bağlanır */}
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
      </div>
    </header>
  );
}
