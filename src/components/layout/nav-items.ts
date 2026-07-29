import {
  ArrowLeftRight,
  Banknote,
  Bell,
  FileText,
  LayoutDashboard,
  ListChecks,
  MonitorSmartphone,
  Package,
  PiggyBank,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import type { UserRole } from "@/lib/auth-policy";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: readonly UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL = ["super_admin", "finance", "operations", "member"] as const;
const FINANS = ["super_admin", "finance"] as const;
const SA = ["super_admin"] as const;

/**
 * Navigasyon tanımı — yetki matrisi (docs/02 §3) ile birebir.
 *
 * ⚠ Kural: kullanıcının görmediği modül menüde HİÇ RENDER EDİLMEZ —
 * soluk veya kilitli gösterilmez. Sistemin kapsamı kullanıcıya sızdırılmaz.
 * Bu yalnız görsel bir kolaylıktır; asıl yetki API katmanındadır.
 */
const GROUPS: NavGroup[] = [
  {
    label: "GENEL",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ALL }],
  },
  {
    label: "MÜŞTERİ",
    items: [
      { href: "/markalar", label: "Markalar", icon: Store, roles: ["super_admin", "finance", "operations"] },
      // Katalogu SA yönetir; FIN ve OPS okur (docs/02 §3.2)
      { href: "/hizmetler", label: "Hizmetler", icon: Package, roles: ["super_admin", "finance", "operations"] },
      { href: "/sozlesmeler", label: "Sözleşmeler", icon: FileText, roles: ["super_admin", "finance", "operations"] },
    ],
  },
  {
    label: "FİNANS",
    items: [
      { href: "/alacaklar", label: "Alacaklar", icon: Receipt, roles: FINANS },
      { href: "/giderler", label: "Giderler", icon: Wallet, roles: FINANS },
      { href: "/banka", label: "Banka & Kasa", icon: Banknote, roles: FINANS },
      { href: "/eslestirme", label: "Eşleştirme", icon: ArrowLeftRight, roles: FINANS },
      { href: "/avanslar", label: "Avanslar", icon: PiggyBank, roles: FINANS },
    ],
  },
  {
    label: "OPERASYON",
    items: [{ href: "/gorevler", label: "Görevler", icon: ListChecks, roles: ALL }],
  },
  {
    label: "SİSTEM",
    items: [
      { href: "/bildirimler", label: "Bildirimler", icon: Bell, roles: ALL },
      { href: "/kullanicilar", label: "Kullanıcılar", icon: Users, roles: SA },
      { href: "/ayarlar", label: "Ayarlar", icon: Settings, roles: SA },
      // Kendi oturumları: her rol kendi hesabını yönetebilmeli
      { href: "/ayarlar/oturumlar", label: "Oturumlarım", icon: MonitorSmartphone, roles: ALL },
      { href: "/denetim", label: "Denetim", icon: ShieldCheck, roles: FINANS },
      { href: "/cop-kutusu", label: "Çöp Kutusu", icon: Trash2, roles: SA },
    ],
  },
];

/** Role göre filtrelenmiş menü; boş kalan gruplar tamamen düşer. */
export function navGroupsFor(role: UserRole): NavGroup[] {
  return GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}
