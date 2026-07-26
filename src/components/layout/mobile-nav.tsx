"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { ROLE_LABELS, type UserRole } from "@/lib/auth-policy";

import { BrandMark, NavList, UserBlock } from "./nav-list";

/**
 * Mobil navigasyon drawer'ı — lacivert overlay (06 §14).
 *
 * Gereksinimler:
 *   · rol bazlı menü filtresi (görülmeyen modül hiç render edilmez)
 *   · aktif menüde altın gösterge
 *   · dışarı tıklama ve Escape ile kapanma
 *   · klavye odak kontrolü: açılışta panele odak, kapanışta düğmeye dönüş,
 *     açıkken odak panel içinde tutulur (odak tuzağı)
 */
export function MobileNav({ role, fullName }: { role: UserRole; fullName: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Escape ile kapanma + odak tuzağı
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    // Açılışta panele odaklan
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Kapanışta odağı açan düğmeye geri ver
  useEffect(() => {
    if (!open) triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        aria-expanded={open}
        aria-controls="mobil-menu"
        className="hidden h-9 w-9 items-center justify-center rounded-sm text-ink-600 hover:bg-fill-100 max-lg:flex"
      >
        <Menu size={19} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" data-shell>
          {/* Dışarı tıklama ile kapanma */}
          <div
            className="absolute inset-0 bg-navy-950/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id="mobil-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Ana menü"
            className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] flex-col bg-navy-900 shadow-lg"
          >
            <div className="flex items-center justify-between pr-2">
              <BrandMark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Menüyü kapat"
                className="flex h-9 w-9 items-center justify-center rounded-sm text-shell-text hover:bg-navy-800 hover:text-white"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="mx-4 border-t border-shell-divider" />
            <NavList role={role} onNavigate={() => setOpen(false)} />
            <UserBlock fullName={fullName} roleLabel={ROLE_LABELS[role]} />
          </div>
        </div>
      )}
    </>
  );
}
