"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth-policy";
import { navGroupsFor } from "./nav-items";

/**
 * Paylaşılan menü listesi — hem sabit sidebar hem mobil drawer kullanır.
 * Aktif göstergesi: solda 2px ALTIN çubuk (06 §3, onaylı üç altın alanından biri).
 *
 * ⚠ Menü ROL'e göre BURADA (istemcide) üretilir. Sunucu bileşeninden hazır
 * grup dizisi geçirmek, ikon bileşenlerini (fonksiyon) RSC sınırından geçirmeye
 * çalışmak demektir ve çalışmaz.
 */
export function NavList({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = navGroupsFor(role);

  return (
    <nav className="flex-1 overflow-y-auto py-3">
      {groups.map((group) => (
        <div key={group.label} className="mb-3">
          <div className="px-5 py-1.5 text-[11px] font-medium tracking-widest text-shell-muted">
            {group.label}
          </div>
          {group.items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 px-5 text-sm text-shell-text transition-colors hover:bg-navy-950 hover:text-white",
                  active && "bg-navy-800 text-white",
                )}
              >
                {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-gold-500" />}
                <Icon size={16} strokeWidth={1.75} className={cn(active && "text-gold-200")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-14 items-center px-5", className)}>
      <span className="font-display text-lg font-semibold tracking-wide text-gold-500">
        PIRAVEL
      </span>
      <span className="ml-1.5 text-lg font-light text-shell-muted">OS</span>
    </div>
  );
}

export function UserBlock({ fullName, roleLabel }: { fullName: string; roleLabel: string }) {
  return (
    <div className="border-t border-shell-divider px-5 py-3">
      <div className="text-sm text-white">{fullName}</div>
      <div className="text-xs text-shell-muted">{roleLabel}</div>
    </div>
  );
}
