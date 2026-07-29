"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Onay penceresi — geri alması pahalı işlemler için.
 *
 * Pasifleştirme ve erişim kaldırma tek tıkla olmamalı: ikisi de kullanıcının
 * göremediği bir yerde sonuç doğurur (fatura tarafı, başkasının açık sekmesi).
 * Pencere, yapılacak işi ADIYLA söyler — "Emin misiniz?" tek başına neyin
 * onaylandığını anlatmaz.
 *
 * Klavye: Escape kapatır, açılışta odak yıkıcı olmayan düğmededir. Odak
 * pencerenin dışına kaçtığında geri çekilir — kullanıcı arkadaki formda
 * gezinip yanlışlıkla başka bir şey tetiklemesin.
 */
export function OnayDialog({
  baslik,
  aciklama,
  onayEtiketi = "Onayla",
  yikici = false,
  bekliyor = false,
  onKapat,
  onOnayla,
}: {
  baslik: string;
  aciklama: React.ReactNode;
  onayEtiketi?: string;
  yikici?: boolean;
  bekliyor?: boolean;
  onKapat: () => void;
  onOnayla: () => void;
}) {
  const kutu = useRef<HTMLDivElement>(null);
  const vazgec = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    vazgec.current?.focus();
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
    };
    const odak = (e: FocusEvent) => {
      if (kutu.current && !kutu.current.contains(e.target as Node)) {
        vazgec.current?.focus();
      }
    };
    document.addEventListener("keydown", tus);
    document.addEventListener("focusin", odak);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("focusin", odak);
    };
  }, [onKapat]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onay-baslik"
    >
      <div
        ref={kutu}
        className="w-full max-w-[420px] rounded-md border border-line-200 bg-surface p-5 shadow-lg"
      >
        <h2 id="onay-baslik" className="mb-1 text-base font-semibold text-ink-900">
          {baslik}
        </h2>
        <div className="mb-4 text-sm text-ink-600">{aciklama}</div>
        <div className="flex justify-end gap-2">
          <Button ref={vazgec} type="button" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Button>
          <Button
            type="button"
            variant={yikici ? "destructive" : "primary"}
            onClick={onOnayla}
            disabled={bekliyor}
          >
            {bekliyor ? "İşleniyor…" : onayEtiketi}
          </Button>
        </div>
      </div>
    </div>
  );
}
