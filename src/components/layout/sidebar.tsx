"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  FileText,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  Wallet,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sidebar (06 §8): lacivert kabuk, gruplu menü, solda 2px ALTIN aktif çubuk.
 * İkonlar yalnızca burada — içerikte ikon cimriliği kuralı.
 * Rol filtresi Sprint 1'de: kullanıcının görmediği modül menüde hiç görünmez.
 */

const groups: { label: string; items: { href: string; label: string; icon: React.ElementType }[] }[] = [
  {
    label: "GENEL",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "MÜŞTERİ",
    items: [
      { href: "/markalar", label: "Markalar", icon: Store },
      { href: "/sozlesmeler", label: "Sözleşmeler", icon: FileText },
    ],
  },
  {
    label: "FİNANS",
    items: [
      { href: "/alacaklar", label: "Alacaklar", icon: Receipt },
      { href: "/giderler", label: "Giderler", icon: Wallet },
      { href: "/banka", label: "Banka & Kasa", icon: Banknote },
      { href: "/eslestirme", label: "Eşleştirme", icon: ArrowLeftRight },
      { href: "/avanslar", label: "Avanslar", icon: PiggyBank },
    ],
  },
  {
    label: "OPERASYON",
    items: [{ href: "/gorevler", label: "Görevler", icon: ListChecks }],
  },
  {
    label: "SİSTEM",
    items: [
      { href: "/bildirimler", label: "Bildirimler", icon: Bell },
      { href: "/ayarlar", label: "Ayarlar", icon: Settings },
      { href: "/denetim", label: "Denetim", icon: ShieldCheck },
      { href: "/cop-kutusu", label: "Çöp Kutusu", icon: Trash2 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      data-shell
      className="flex w-[248px] shrink-0 flex-col bg-navy-900 max-lg:hidden"
    >
      {/* Logo alanı — altın imza (06 §3) */}
      <div className="flex h-14 items-center px-5">
        <span className="font-display text-lg font-semibold tracking-wide text-gold-500">
          PIRAVEL
        </span>
        <span className="ml-1.5 text-lg font-light text-shell-muted">OS</span>
      </div>
      <div className="mx-4 border-t border-shell-divider" />

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
                  className={cn(
                    "relative flex h-9 items-center gap-2.5 px-5 text-sm text-shell-text transition-colors hover:bg-navy-950 hover:text-white",
                    active && "bg-navy-800 text-white",
                  )}
                >
                  {/* Aktif gösterge: 2px altın çubuk */}
                  {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-gold-500" />}
                  <Icon size={16} strokeWidth={1.75} className={cn(active && "text-gold-200")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Kullanıcı bloğu — Sprint 1'de gerçek oturum bağlanır */}
      <div className="border-t border-shell-divider px-5 py-3">
        <div className="text-sm text-white">Ahmet Burak</div>
        <div className="text-xs text-shell-muted">Süper Yönetici</div>
      </div>
    </aside>
  );
}
