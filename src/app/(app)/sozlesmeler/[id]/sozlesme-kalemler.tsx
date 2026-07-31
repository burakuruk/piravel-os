"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AG_HATASI, donemYaz, hataMetni, tutarYaz } from "../etiketler";

/**
 * Kapsam kalemleri.
 *
 * ⚠ YALNIZ TASLAKTA DÜZENLENİR. Aktif/sonlanmış/iptal sözleşmede kalemler
 * DÜZ METİNDİR — input, select ya da "Düzenle" bağlantısı yoktur. Tıklanabilir
 * görünüp tıklanınca hiçbir şey olmayan alan, kilidin kendisinden daha çok
 * zarar verir.
 *
 * ⚠ Kalem katalogdan seçilir ama adı ve fiyatı O AN KOPYALANIR (snapshot).
 * Katalogda sonradan yapılan değişiklik imzalanmış sözleşmeyi değiştirmez.
 *
 * ⚠ OPS bu bileşene fiyat alanı almaz: sunucu sorgusu onları hiç seçmez ve
 * `finans={false}` ile sütunlar da render edilmez.
 */

export interface Kalem {
  id: string;
  serviceId: string | null;
  name: string;
  quantity: string;
  unit: string;
  period: string;
  unitPriceMinor?: number;
  totalMinor?: number;
  currencyCode?: string;
}

export interface KatalogHizmeti {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  markada: boolean;
}

interface Satir {
  serviceId: string;
  quantity: string;
  unitPrice: string;
}

function kurusa(deger: string): number {
  const t = deger.trim().replace(/\./g, "").replace(",", ".");
  if (!t || !/^\d+(\.\d{1,2})?$/.test(t)) return 0;
  return Math.round(parseFloat(t) * 100);
}

export function SozlesmeKalemler({
  contractId,
  kalemler,
  katalog,
  duzenlenebilir,
  finans,
  paraBirimi,
  toplamlar,
}: {
  contractId: string;
  kalemler: Kalem[];
  katalog: KatalogHizmeti[];
  duzenlenebilir: boolean;
  finans: boolean;
  paraBirimi: string;
  toplamlar: {
    kalemToplamiMinor: number;
    discountMinor: number;
    beklenenNetMinor: number;
    amountMinor: number;
    uyusmazlik: boolean;
    farkMinor: number;
  } | null;
}) {
  const router = useRouter();
  const [duzenle, setDuzenle] = useState(false);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [uyarilar, setUyarilar] = useState<string[]>([]);

  function duzenlemeyeGec() {
    setSatirlar(
      kalemler.map((k) => ({
        serviceId: k.serviceId ?? "",
        quantity: String(Number(k.quantity)),
        unitPrice: k.unitPriceMinor == null ? "" : (k.unitPriceMinor / 100).toFixed(2).replace(".", ","),
      })),
    );
    setHata(null);
    setUyarilar([]);
    setDuzenle(true);
  }

  async function kaydet() {
    setBekliyor(true);
    setHata(null);
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: satirlar
            .filter((s) => s.serviceId)
            .map((s) => ({
              serviceId: s.serviceId,
              quantity: Number(s.quantity.replace(",", ".")) || 1,
              unitPriceMinor: kurusa(s.unitPrice),
            })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setUyarilar(json?.warnings ?? []);
        setDuzenle(false);
        router.refresh();
        return;
      }
      setHata(hataMetni(json));
    } catch {
      setHata(AG_HATASI);
    } finally {
      setBekliyor(false);
    }
  }

  const secilebilir = katalog.filter((k) => k.isActive);

  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">Kapsam kalemleri</h2>
        {duzenlenebilir && !duzenle && (
          <Button size="table" onClick={duzenlemeyeGec}>
            Düzenle
          </Button>
        )}
      </div>

      <div className="p-5">
        {uyarilar.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {uyarilar.map((u) => (
              <li
                key={u}
                className="rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning"
              >
                {u}
              </li>
            ))}
          </ul>
        )}

        {hata && (
          <p role="alert" className="mb-4 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {hata}
          </p>
        )}

        {duzenle ? (
          /* ── DÜZENLEME (yalnız taslak) ── */
          <>
            <ul className="space-y-3">
              {satirlar.map((s, i) => {
                const hizmet = katalog.find((k) => k.id === s.serviceId);
                return (
                  <li key={i} className="rounded-sm border border-line-200 p-3">
                    <div className="grid gap-2 lg:grid-cols-[1fr_88px_140px_72px] lg:items-end">
                      <div>
                        <label htmlFor={`kalem-h-${i}`} className="mb-1 block text-xs text-ink-400">
                          Hizmet
                        </label>
                        <select
                          id={`kalem-h-${i}`}
                          value={s.serviceId}
                          onChange={(e) => {
                            const y = [...satirlar];
                            y[i] = { ...y[i]!, serviceId: e.target.value };
                            setSatirlar(y);
                          }}
                          className="h-9 w-full rounded-sm border border-line-300 bg-surface px-2.5 text-sm max-sm:min-h-11"
                        >
                          <option value="">Hizmet seçin…</option>
                          {secilebilir.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.code} · {k.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`kalem-m-${i}`} className="mb-1 block text-xs text-ink-400">
                          Miktar
                        </label>
                        <input
                          id={`kalem-m-${i}`}
                          inputMode="decimal"
                          value={s.quantity}
                          onChange={(e) => {
                            const y = [...satirlar];
                            y[i] = { ...y[i]!, quantity: e.target.value };
                            setSatirlar(y);
                          }}
                          className="h-9 w-full rounded-sm border border-line-300 bg-surface px-2.5 text-right text-sm tabular-nums max-sm:min-h-11"
                        />
                      </div>
                      <div>
                        <label htmlFor={`kalem-f-${i}`} className="mb-1 block text-xs text-ink-400">
                          Birim fiyat
                        </label>
                        <input
                          id={`kalem-f-${i}`}
                          inputMode="decimal"
                          value={s.unitPrice}
                          onChange={(e) => {
                            const y = [...satirlar];
                            y[i] = { ...y[i]!, unitPrice: e.target.value };
                            setSatirlar(y);
                          }}
                          className="h-9 w-full rounded-sm border border-line-300 bg-surface px-2.5 text-right text-sm tabular-nums max-sm:min-h-11"
                        />
                      </div>
                      <Button
                        size="table"
                        onClick={() => setSatirlar(satirlar.filter((_, j) => j !== i))}
                      >
                        Kaldır
                      </Button>
                    </div>
                    {hizmet && !hizmet.markada && (
                      <p className="mt-2 rounded-sm border-l-2 border-warning bg-warning-bg px-2.5 py-1.5 text-xs text-warning">
                        Bu hizmet bu markaya tanımlı değil. Ekleyebilirsiniz; sözleşmeyi
                        yürürlüğe aldığınızda hizmet markanın listesine de eklenir.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  setSatirlar([...satirlar, { serviceId: "", quantity: "1", unitPrice: "" }])
                }
              >
                + Kalem ekle
              </Button>
            </div>

            <p className="mt-3 text-xs text-ink-400">
              Hizmet katalogdan seçilir. Seçtiğiniz anda hizmetin adı ve fiyatı bu
              sözleşmeye kopyalanır; katalogda sonradan yapılan değişiklik bu sözleşmeyi
              etkilemez. Pasif hizmetler listede çıkmaz.
            </p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button onClick={() => setDuzenle(false)}>Vazgeç</Button>
              <Button variant="primary" disabled={bekliyor} onClick={kaydet}>
                {bekliyor ? "Kaydediliyor…" : "Kalemleri kaydet"}
              </Button>
            </div>
          </>
        ) : kalemler.length === 0 ? (
          <p className="text-sm text-ink-400">
            Henüz kalem yok.
            {duzenlenebilir
              ? " “Düzenle” ile kapsamı tanımlayabilirsiniz."
              : " Bu sözleşmeye kapsam kalemi girilmemiş."}
          </p>
        ) : (
          /* ── SALT OKUNUR — kutu yok, düz metin ── */
          <>
            <ul className="space-y-2.5 sm:hidden">
              {kalemler.map((k) => (
                <li key={k.id} className="border-b border-line-200 pb-2.5 last:border-0">
                  <div className="text-sm text-ink-900">{k.name}</div>
                  <div className="text-xs text-ink-400">
                    {Number(k.quantity)} × {donemYaz(k.period)}
                  </div>
                  {finans && (
                    <div className="mt-1 text-sm tabular-nums text-ink-900">
                      {tutarYaz(k.totalMinor, k.currencyCode ?? paraBirimi)}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                  <th className="pb-2 pr-4 font-medium">HİZMET</th>
                  <th className="whitespace-nowrap px-3 pb-2 text-right font-medium">MİKTAR</th>
                  <th className="whitespace-nowrap px-3 pb-2 font-medium">DÖNEM</th>
                  {finans && (
                    <>
                      <th className="whitespace-nowrap px-3 pb-2 text-right font-medium">
                        BİRİM FİYAT
                      </th>
                      <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">TOPLAM</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {kalemler.map((k) => (
                  <tr key={k.id} className="border-b border-line-200 last:border-0">
                    <td className="py-2.5 pr-4 text-ink-900">{k.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-600">
                      {Number(k.quantity)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-600">{donemYaz(k.period)}</td>
                    {finans && (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-600">
                          {tutarYaz(k.unitPriceMinor, k.currencyCode ?? paraBirimi)}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums text-ink-900">
                          {tutarYaz(k.totalMinor, k.currencyCode ?? paraBirimi)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {finans && toplamlar && (
              <div className="mt-4 max-w-[380px]">
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-ink-400">Kalem toplamı</span>
                  <span className="tabular-nums text-ink-900">
                    {tutarYaz(toplamlar.kalemToplamiMinor, paraBirimi)}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-ink-400">İndirim</span>
                  <span className="tabular-nums text-ink-900">
                    −{tutarYaz(toplamlar.discountMinor, paraBirimi)}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-ink-600">Kalemlerden beklenen net</span>
                  <span className="tabular-nums text-ink-900">
                    {tutarYaz(toplamlar.beklenenNetMinor, paraBirimi)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-line-200 pt-2 text-sm">
                  <span className="font-medium text-ink-900">Sözleşmeye yazılı net</span>
                  <span className="font-semibold tabular-nums text-ink-900">
                    {tutarYaz(toplamlar.amountMinor, paraBirimi)}
                  </span>
                </div>

                {toplamlar.uyusmazlik && (
                  <p className="mt-3 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
                    Kalemlerden beklenen net tutar, sözleşmeye yazılı tutardan{" "}
                    <strong className="tabular-nums">
                      {tutarYaz(Math.abs(toplamlar.farkMinor), paraBirimi)}
                    </strong>{" "}
                    {toplamlar.farkMinor > 0 ? "fazla" : "eksik"}. Kaydedebilirsiniz; yalnız
                    dikkatinizi çekmek için gösteriliyor.
                  </p>
                )}
              </div>
            )}

            {!duzenlenebilir && kalemler.length > 0 && (
              <p className="mt-3 text-xs text-ink-400">
                <Badge variant="muted">Kilitli</Badge>{" "}
                Yürürlükteki sözleşmede kalemler değiştirilemez. Değişiklik gerekiyorsa
                sözleşmeyi sonlandırıp yenisini oluşturun.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
