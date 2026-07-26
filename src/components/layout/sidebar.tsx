import { ROLE_LABELS, type UserRole } from "@/lib/auth-policy";

import { BrandMark, NavList, UserBlock } from "./nav-list";

/**
 * Sabit sidebar (06 §8) — masaüstü. <1024px'te gizlenir; yerine MobileNav drawer'ı.
 * Menü role göre filtrelenir: görülmeyen modül hiç render edilmez.
 */
export function Sidebar({ role, fullName }: { role: UserRole; fullName: string }) {
  return (
    <aside data-shell className="flex w-[248px] shrink-0 flex-col bg-navy-900 max-lg:hidden">
      <BrandMark />
      <div className="mx-4 border-t border-shell-divider" />
      <NavList role={role} />
      <UserBlock fullName={fullName} roleLabel={ROLE_LABELS[role]} />
    </aside>
  );
}
