"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AG_HATASI, hataMetni, tarihYaz, tutarYaz } from "../etiketler";

/**
 * Ödeme planı önizlemesi.
 *
 * ⚠ "Bu önizleme kayıt oluşturmaz" ibaresi panelin HEM ÜSTÜNDE HEM ALTINDA
 * durur: uzun listede üst şerit ekrandan çıkıyor ve kullanıcı 12 satırlık bir
 * vade tablosu görünce doğal olarak "bunlar sisteme yazıldı mı" diye soruyor.
 *
 * ⚠ Panelde indirme/kaydetme düğmesi YOK: üretilmemiş bir plana eylem
 * bağlamak onu kalıcı sanmaya davet eder.
 *
 * ⚠ 120 sınırı aşılırsa liste KISALTILMAZ; sunucu 422 döner ve kullanıcı
 * açık bir hata görür (`PREVIEW_TOO_LONG` → etiketler.ts).
 */

interface PlanSatiri {
  sira: number;
  vadeTarihi: string;
  netMinor: number;
  kdvMinor: number;
  brutMinor: number;
}

function Serit() {
  return (
    <p className="flex items-start gap-2 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5h.01" />
      </svg>
      <span>
        <strong>Bu önizleme kayıt oluşturmaz.</strong> Vadeler yalnız hesaplanarak
        gösterilir; sisteme alacak veya fatura olarak yazılmaz.
      </span>
    </p>
  );
}

export function OdemePlani({
  contractId,
  temelEtiket,
}: {
  contractId: string;
  temelEtiket: string;
}) {
  const [acik, setAcik] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [plan, setPlan] = useState<{
    satirlar: PlanSatiri[];
    toplam: { netMinor: number; kdvMinor: number; brutMinor: number };
    currencyCode: string;
    sinirliOnizleme: boolean;
  } | null>(null);

  async function getir() {
    setBekliyor(true);
    setHata(null);
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}/payment-preview`);
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setPlan(json);
        setAcik(true);
        return;
      }
      setPlan(null);
      setAcik(true);
      setHata(hataMetni(json));
    } catch {
      setPlan(null);
      setAcik(true);
      setHata(AG_HATASI);
    } finally {
      setBekliyor(false);
    }
  }

  if (!acik) {
    return (
      <Button onClick={getir} disabled={bekliyor}>
        {bekliyor ? "Hesaplanıyor…" : "Ödeme planını gör"}
      </Button>
    );
  }

  const pb = plan?.currencyCode ?? "TRY";

  return (
    <section
      className="rounded-md border border-line-200 bg-surface"
      aria-label="Ödeme planı önizlemesi"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">Ödeme planı önizlemesi</h2>
        <span className="text-xs text-ink-400">{temelEtiket}</span>
      </div>

      <div className="p-5">
        <Serit />

        {hata && (
          <p role="alert" className="mt-3 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {hata}
          </p>
        )}

        {plan && (
          <>
            {plan.sinirliOnizleme && (
              <p className="mt-3 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
                Bu sözleşmede bitiş tarihi ve taksit sayısı belirtilmemiş. Önizleme yalnız
                <strong> ilk {plan.satirlar.length} dönemi</strong> örnek olarak gösteriyor —
                sözleşmenin toplamı süresiz olduğu için tanımlı değildir.
              </p>
            )}

            {/* Mobil: kart listesi — dört kolon 375 px'te yatay kayardı */}
            <ul className="mt-4 space-y-2 sm:hidden">
              {plan.satirlar.map((s) => (
                <li key={s.sira} className="rounded-sm border border-line-200 px-3 py-2.5">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink-900">{s.sira}. dönem</span>
                    <span className="text-sm tabular-nums text-ink-600">
                      {tarihYaz(s.vadeTarihi)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-600">Net</span>
                    <span className="tabular-nums text-ink-900">{tutarYaz(s.netMinor, pb)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-400">KDV</span>
                    <span className="tabular-nums text-ink-600">{tutarYaz(s.kdvMinor, pb)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-line-200 pt-1 text-sm">
                    <span className="font-medium text-ink-900">Brüt</span>
                    <span className="font-medium tabular-nums text-ink-900">
                      {tutarYaz(s.brutMinor, pb)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Masaüstü: tablo */}
            <table className="mt-4 hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">VADE TARİHİ</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">NET</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-medium">KDV</th>
                  <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">BRÜT</th>
                </tr>
              </thead>
              <tbody>
                {plan.satirlar.map((s) => (
                  <tr key={s.sira} className="border-b border-line-200 last:border-0">
                    <td className="py-2 pr-3 tabular-nums text-ink-400">{s.sira}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-900">
                      {tarihYaz(s.vadeTarihi)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-900">
                      {tutarYaz(s.netMinor, pb)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-600">
                      {tutarYaz(s.kdvMinor, pb)}
                    </td>
                    <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums text-ink-900">
                      {tutarYaz(s.brutMinor, pb)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line-300">
                  <td className="py-2.5 pr-3 font-medium text-ink-900" colSpan={2}>
                    {plan.satirlar.length} dönem toplamı
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-ink-900">
                    {tutarYaz(plan.toplam.netMinor, pb)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-600">
                    {tutarYaz(plan.toplam.kdvMinor, pb)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums text-ink-900">
                    {tutarYaz(plan.toplam.brutMinor, pb)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Mobilde toplam ayrı kutu */}
            <div className="mt-2 rounded-sm bg-fill-100 px-3 py-2.5 text-sm sm:hidden">
              <div className="flex justify-between">
                <span className="text-ink-600">{plan.satirlar.length} dönem toplamı (net)</span>
                <span className="tabular-nums text-ink-900">{tutarYaz(plan.toplam.netMinor, pb)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line-300 pt-1">
                <span className="font-medium text-ink-900">Brüt toplam</span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {tutarYaz(plan.toplam.brutMinor, pb)}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <Serit />
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setAcik(false); setHata(null); }}>Kapat</Button>
        </div>
      </div>
    </section>
  );
}
