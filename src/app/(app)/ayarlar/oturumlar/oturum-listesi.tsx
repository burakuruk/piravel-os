"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OturumOzeti } from "@/lib/session-admin";

/**
 * Oturum listesi ve iptal işlemleri.
 *
 * ⚠ Sunucudan gelen model bilerek dardır: token, tam IP ve iç kimlikler
 * buraya hiç ulaşmaz. Bileşen yalnız gösterilen alanları bilir.
 */
type Onay =
  | { tur: "tek"; oturum: OturumOzeti }
  | { tur: "digerleri" }
  | null;

function tarih(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OturumListesi({ oturumlar }: { oturumlar: OturumOzeti[] }) {
  const router = useRouter();
  const [onay, setOnay] = useState<Onay>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const digerSayisi = oturumlar.filter((o) => !o.mevcut).length;

  async function uygula() {
    if (!onay) return;
    setBekliyor(true);
    setHata(null);

    const res =
      onay.tur === "digerleri"
        ? await fetch("/api/v1/sessions", { method: "DELETE" })
        : await fetch(`/api/v1/sessions/${onay.oturum.id}`, { method: "DELETE" });

    const json = await res.json().catch(() => null);
    setBekliyor(false);

    if (!res.ok) {
      setHata(json?.error?.message ?? "Oturum kapatılamadı.");
      setOnay(null);
      return;
    }

    // Kendi oturumunu kapattıysa artık yetkisi yok: giriş ekranına
    if (json?.kendiniKapatti) {
      window.location.href = "/giris";
      return;
    }
    setOnay(null);
    router.refresh();
  }

  return (
    <>
      {hata && (
        <p role="alert" className="mb-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-line-200 bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
              <th className="px-4 py-3 font-medium">CİHAZ</th>
              <th className="px-4 py-3 font-medium">SON KULLANIM</th>
              <th className="px-4 py-3 font-medium">AÇILIŞ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {oturumlar.map((o) => (
              <tr key={o.id} className="border-b border-line-200 last:border-0">
                <td className="px-4 py-3">
                  <span className="text-ink-900">{o.cihaz}</span>
                  {o.mevcut && (
                    <Badge variant="success" className="ml-2">
                      Bu oturum
                    </Badge>
                  )}
                  {o.ag && <div className="mt-0.5 text-xs text-ink-400">Ağ: {o.ag}</div>}
                </td>
                <td className="px-4 py-3 text-ink-600">{tarih(o.sonKullanim)}</td>
                <td className="px-4 py-3 text-ink-600">{tarih(o.olusturulma)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="table"
                    variant={o.mevcut ? "secondary" : "destructive"}
                    onClick={() => setOnay({ tur: "tek", oturum: o })}
                  >
                    {o.mevcut ? "Çıkış yap" : "Kapat"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-md border border-line-200 bg-surface p-5">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Diğer tüm oturumları kapat</h2>
          <p className="mt-1 text-sm text-ink-400">
            Bu cihazdaki oturumunuz açık kalır; diğer {digerSayisi} oturum kapanır.
          </p>
        </div>
        <Button
          variant="destructive"
          disabled={digerSayisi === 0}
          onClick={() => setOnay({ tur: "digerleri" })}
        >
          Diğerlerini kapat
        </Button>
      </div>

      {onay && (
        <OnayPenceresi
          onay={onay}
          bekliyor={bekliyor}
          digerSayisi={digerSayisi}
          onVazgec={() => setOnay(null)}
          onUygula={uygula}
        />
      )}
    </>
  );
}

function OnayPenceresi({
  onay,
  bekliyor,
  digerSayisi,
  onVazgec,
  onUygula,
}: {
  onay: NonNullable<Onay>;
  bekliyor: boolean;
  digerSayisi: number;
  onVazgec: () => void;
  onUygula: () => void;
}) {
  const kendisi = onay.tur === "tek" && onay.oturum.mevcut;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oturum-onay-baslik"
    >
      <div className="w-full max-w-[400px] rounded-md border border-line-200 bg-surface p-5 shadow-lg">
        <h2 id="oturum-onay-baslik" className="mb-2 text-base font-semibold text-ink-900">
          {onay.tur === "digerleri"
            ? "Diğer oturumlar kapatılsın mı?"
            : kendisi
              ? "Bu cihazdan çıkış yapılsın mı?"
              : "Oturum kapatılsın mı?"}
        </h2>

        {/* Mevcut oturumu kapatmak kullanıcıyı sistemden atar — açıkça uyarılır */}
        {kendisi ? (
          <p className="mb-4 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
            Şu anda kullandığınız oturum bu. Kapatırsanız hemen çıkış yapılır ve
            yeniden giriş yapmanız gerekir.
          </p>
        ) : (
          <p className="mb-4 text-sm text-ink-600">
            {onay.tur === "digerleri"
              ? `Bu cihaz dışındaki ${digerSayisi} oturum kapanacak. O cihazlarda yeniden giriş gerekir.`
              : `“${onay.oturum.cihaz}” oturumu kapanacak ve o cihazda yeniden giriş gerekir.`}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onVazgec} disabled={bekliyor}>
            Vazgeç
          </Button>
          <Button variant="destructive" onClick={onUygula} disabled={bekliyor}>
            {bekliyor ? "Kapatılıyor…" : kendisi ? "Çıkış yap" : "Kapat"}
          </Button>
        </div>
      </div>
    </div>
  );
}
