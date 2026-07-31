"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AG_HATASI,
  hataMetni,
  SIKLIK_ETIKET,
  SIKLIKLAR,
  TEMEL_SECENEK,
  tutarYaz,
  type FaturalamaSikligi,
  type TutarTemeli,
} from "../etiketler";

/**
 * Yeni sözleşme formu.
 *
 * Tartışılıp onaylanan davranışlar:
 *   · Sözleşme numarası FORM ALANI DEĞİL — sunucuda üretilir, kullanıcı
 *     yazamaz. Kutulu bir alan "buraya yazabilirim" derdi.
 *   · TUTAR TEMELİ rakamdan ÖNCE sorulur: rakamın anlamını o belirler.
 *     Etiketler seçime göre değişir ("Dönemlik net tutar" / "Sözleşme toplam
 *     net tutarı", "Dönemlik indirim" / "Toplam indirim").
 *   · KDV girişi TEK KUTU + "KDV dahil" anahtarı; ayrıştırmayı sunucu yapar
 *     ve sonuç anında özet kutusunda görünür.
 *   · Yenileme İKİ AYRI TARİH: görüşme günü ile yeni dönem başlangıcı aynı
 *     şey değil. Süresiz sözleşmede yenileme tarihi alanı KAPANIR.
 *   · Kapsam kalemleri bu formda yok: oluşturma formu uzarsa doldurulmuyor.
 */

interface Marka {
  id: string;
  name: string;
  code: string;
}

function Alan({
  etiket,
  htmlFor,
  ipucu,
  hata,
  genis,
  children,
}: {
  etiket: string;
  htmlFor: string;
  ipucu?: string;
  hata?: string;
  genis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={genis ? "sm:col-span-2" : ""}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-ink-600">
        {etiket}
      </label>
      {children}
      {hata ? (
        <p className="mt-1 text-xs text-danger">{hata}</p>
      ) : (
        ipucu && <p className="mt-1 text-xs text-ink-400">{ipucu}</p>
      )}
    </div>
  );
}

const KUTU =
  "h-9 w-full rounded-sm border border-line-300 bg-surface px-3 text-sm max-sm:min-h-11";

function Kart({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">{baslik}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function YeniSozlesmeFormu({ markalar }: { markalar: Marka[] }) {
  const router = useRouter();
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const [brandId, setBrandId] = useState(markalar[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [renewalReviewDate, setRenewalReviewDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);

  const [amountBasis, setAmountBasis] = useState<TutarTemeli>("per_period");
  const [tutar, setTutar] = useState("");
  const [currencyCode, setCurrencyCode] = useState("TRY");
  const [vatRate, setVatRate] = useState("20");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [indirim, setIndirim] = useState("");

  const [billingFrequency, setBillingFrequency] = useState<FaturalamaSikligi>("monthly");
  const [billingInterval, setBillingInterval] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [paymentDay, setPaymentDay] = useState("");

  /** "1.234,56" ya da "1234.56" → kuruş. Boş/bozuk girdi null. */
  function kurusa(deger: string): number | null {
    const t = deger.trim().replace(/\./g, "").replace(",", ".");
    if (!t || !/^\d+(\.\d{1,2})?$/.test(t)) return null;
    return Math.round(parseFloat(t) * 100);
  }

  const girilen = kurusa(tutar);
  const oran = Number(vatRate) || 0;
  const net = girilen == null ? null : vatIncluded ? Math.round(girilen / (1 + oran / 100)) : girilen;
  const kdv = net == null ? null : Math.round((net * oran) / 100);

  const tekSeferlik = billingFrequency === "one_time";
  /** Tek seferlikte temel zorunlu olarak toplam; sunucu da aynısını söyler. */
  const etkinTemel: TutarTemeli = tekSeferlik ? "contract_total" : amountBasis;
  const suresiz = endDate.trim() === "";
  const toplamSinirEksik =
    etkinTemel === "contract_total" && !tekSeferlik && suresiz && !installmentCount.trim();

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    if (girilen == null || girilen <= 0) {
      setHata("Tutar sıfırdan büyük olmalıdır.");
      return;
    }
    setBekliyor(true);
    try {
      const res = await fetch("/api/v1/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          title: title.trim(),
          startDate,
          endDate: endDate.trim() || null,
          renewalDate: renewalDate.trim() || null,
          renewalReviewDate: renewalReviewDate.trim() || null,
          autoRenew,
          enteredAmountMinor: girilen,
          amountBasis: etkinTemel,
          currencyCode,
          vatRate: oran,
          vatIncluded,
          discountMinor: kurusa(indirim) ?? 0,
          billingFrequency,
          billingInterval: Number(billingInterval) || 1,
          firstDueDate: firstDueDate.trim() || null,
          installmentCount: installmentCount.trim() ? Number(installmentCount) : null,
          paymentDay: paymentDay.trim() ? Number(paymentDay) : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        router.push(`/sozlesmeler/${json?.contract?.id ?? ""}`);
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

  return (
    <form onSubmit={gonder} className="max-w-[760px] space-y-4">
      <Kart baslik="Temel bilgiler">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-sm bg-fill-100 px-3 py-2.5">
          <div>
            <div className="text-xs text-ink-400">Sözleşme numarası</div>
            {/* Salt okunur künye — input DEĞİL */}
            <div className="mt-0.5 text-sm text-ink-400">Kaydedildiğinde otomatik verilir</div>
          </div>
          <div>
            <div className="text-xs text-ink-400">Durum</div>
            <div className="mt-0.5 text-sm text-ink-900">Taslak</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Alan etiket="Marka *" htmlFor="ys-marka">
            <select
              id="ys-marka"
              required
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={KUTU}
            >
              {markalar.length === 0 && <option value="">Kapsamınızda marka yok</option>}
              {markalar.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} · {m.name}
                </option>
              ))}
            </select>
          </Alan>
          <Alan etiket="Sözleşme başlığı *" htmlFor="ys-baslik">
            <input
              id="ys-baslik"
              required
              minLength={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={KUTU}
            />
          </Alan>
        </div>
      </Kart>

      <Kart baslik="Tarihler">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Alan etiket="Başlangıç tarihi *" htmlFor="ys-baslangic">
            <input
              id="ys-baslangic"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={KUTU}
            />
          </Alan>
          <Alan
            etiket="Bitiş tarihi"
            htmlFor="ys-bitis"
            ipucu="Boş bırakılırsa sözleşme süresizdir."
          >
            <input
              id="ys-bitis"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={KUTU}
            />
          </Alan>
        </div>
      </Kart>

      <Kart baslik="Yenileme">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Alan
            etiket="Yenileme görüşmesi tarihi"
            htmlFor="ys-gorusme"
            ipucu="Müşteriyle yenilemeyi konuşacağınız gün. Hatırlatma bu tarihe göre çıkar."
          >
            <input
              id="ys-gorusme"
              type="date"
              value={renewalReviewDate}
              onChange={(e) => setRenewalReviewDate(e.target.value)}
              className={KUTU}
            />
          </Alan>
          <Alan
            etiket="Yenileme tarihi (yeni dönem başlangıcı)"
            htmlFor="ys-yenileme"
            ipucu={
              suresiz
                ? "Süresiz sözleşmede kullanılamaz: neyin bittiği belli değilse yeni dönemin ne zaman başladığı da tanımsızdır."
                : "Yeni dönemin başladığı gün. Bitiş tarihinden SONRA olmalı."
            }
          >
            <input
              id="ys-yenileme"
              type="date"
              value={suresiz ? "" : renewalDate}
              disabled={suresiz}
              onChange={(e) => setRenewalDate(e.target.value)}
              className={`${KUTU} disabled:bg-fill-100 disabled:text-ink-400`}
            />
          </Alan>
        </div>

        <label className="mt-4 flex items-start gap-2 text-[13px] text-ink-600 max-sm:min-h-11 max-sm:items-center">
          <input
            type="checkbox"
            checked={autoRenew}
            disabled={suresiz || !renewalDate}
            onChange={(e) => setAutoRenew(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          Otomatik yenileme bayrağı
        </label>
        <p className="mt-1 text-xs text-ink-400">
          Sözleşme kendiliğinden yenilenmez; bu işaret yalnız hatırlatma içindir ve
          yenileme tarihi girilmeden işaretlenemez.
        </p>
      </Kart>

      <Kart baslik="Tutar ve KDV">
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-sm text-ink-600">Tutar temeli *</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(TEMEL_SECENEK) as TutarTemeli[]).map((t) => {
              const secili = etkinTemel === t;
              const kilitli = tekSeferlik && t === "per_period";
              return (
                <label
                  key={t}
                  className={`rounded-sm border px-3 py-2.5 ${
                    secili ? "border-2 border-navy-900 bg-fill-100" : "border-line-300"
                  } ${kilitli ? "opacity-50" : "cursor-pointer"}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="ys-temel"
                      value={t}
                      checked={secili}
                      disabled={kilitli}
                      onChange={() => setAmountBasis(t)}
                      className="h-4 w-4"
                    />
                    <span className={`text-sm ${secili ? "font-medium" : ""} text-ink-900`}>
                      {TEMEL_SECENEK[t].baslik}
                    </span>
                  </span>
                  <span className="mt-1 block pl-6 text-xs text-ink-400">
                    {TEMEL_SECENEK[t].aciklama}
                  </span>
                </label>
              );
            })}
          </div>
          {tekSeferlik && (
            <p className="mt-2 text-xs text-ink-400">
              Tek seferlik sözleşmede tutar her zaman sözleşme toplamıdır.
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Alan
            etiket={`${etkinTemel === "per_period" ? "Dönemlik" : "Toplam"} net tutar *`}
            htmlFor="ys-tutar"
          >
            <input
              id="ys-tutar"
              required
              inputMode="decimal"
              placeholder="45.000,00"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              className={KUTU}
            />
          </Alan>
          <Alan etiket="Para birimi *" htmlFor="ys-para">
            <select
              id="ys-para"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className={KUTU}
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Alan>
          <Alan etiket="KDV oranı (%)" htmlFor="ys-kdv">
            <input
              id="ys-kdv"
              inputMode="numeric"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className={KUTU}
            />
          </Alan>
          <Alan
            etiket={`${etkinTemel === "per_period" ? "Dönemlik" : "Toplam"} indirim`}
            htmlFor="ys-indirim"
          >
            <input
              id="ys-indirim"
              inputMode="decimal"
              placeholder="0,00"
              value={indirim}
              onChange={(e) => setIndirim(e.target.value)}
              className={KUTU}
            />
          </Alan>
        </div>

        <label className="mt-4 flex items-start gap-2 text-[13px] text-ink-600 max-sm:min-h-11 max-sm:items-center">
          <input
            type="checkbox"
            checked={vatIncluded}
            onChange={(e) => setVatIncluded(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          Yazdığım tutar KDV dahildir
        </label>

        {/* Hangi rakamın saklandığı anında görünür */}
        <div className="mt-4 rounded-sm border border-line-200 bg-fill-100 px-3 py-2">
          <div className="pb-1 text-xs text-ink-400">
            {etkinTemel === "per_period" ? "Her faturalama döneminde" : "Sözleşme toplamı"}
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-ink-600">Net tutar</span>
            <span className="tabular-nums text-ink-900">
              {net == null ? "—" : tutarYaz(net, currencyCode)}
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-ink-400">KDV (%{oran})</span>
            <span className="tabular-nums text-ink-600">
              {kdv == null ? "—" : tutarYaz(kdv, currencyCode)}
            </span>
          </div>
          <div className="flex justify-between border-t border-line-200 pt-2 text-sm">
            <span className="font-medium text-ink-900">Brüt tutar</span>
            <span className="font-semibold tabular-nums text-ink-900">
              {net == null || kdv == null ? "—" : tutarYaz(net + kdv, currencyCode)}
            </span>
          </div>
        </div>
      </Kart>

      <Kart baslik="Faturalama planı">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Alan etiket="Sıklık *" htmlFor="ys-siklik">
            <select
              id="ys-siklik"
              value={billingFrequency}
              onChange={(e) => setBillingFrequency(e.target.value as FaturalamaSikligi)}
              className={KUTU}
            >
              {SIKLIKLAR.map((s) => (
                <option key={s} value={s}>
                  {SIKLIK_ETIKET[s]}
                </option>
              ))}
            </select>
          </Alan>
          <Alan etiket="Kaç dönemde bir" htmlFor="ys-aralik">
            <input
              id="ys-aralik"
              inputMode="numeric"
              value={tekSeferlik ? "1" : billingInterval}
              disabled={tekSeferlik}
              onChange={(e) => setBillingInterval(e.target.value)}
              className={`${KUTU} disabled:bg-fill-100 disabled:text-ink-400`}
            />
          </Alan>
          <Alan etiket="İlk vade tarihi" htmlFor="ys-ilkvade">
            <input
              id="ys-ilkvade"
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className={KUTU}
            />
          </Alan>
          <Alan
            etiket="Taksit sayısı"
            htmlFor="ys-taksit"
            hata={
              toplamSinirEksik
                ? "Toplam tutar temelinde taksit sayısı ya da bitiş tarihi zorunludur — toplamın kaça bölüneceği belli olmalı."
                : undefined
            }
          >
            <input
              id="ys-taksit"
              inputMode="numeric"
              value={tekSeferlik ? "" : installmentCount}
              disabled={tekSeferlik}
              onChange={(e) => setInstallmentCount(e.target.value)}
              className={`${KUTU} disabled:bg-fill-100 disabled:text-ink-400`}
            />
          </Alan>
          <Alan
            etiket="Ödeme günü (ayın kaçı)"
            htmlFor="ys-odemegunu"
            ipucu="Ayın 31'i gibi her ayda bulunmayan bir gün seçilirse o ayın son günü kullanılır."
            genis
          >
            <input
              id="ys-odemegunu"
              inputMode="numeric"
              value={paymentDay}
              onChange={(e) => setPaymentDay(e.target.value)}
              className={KUTU}
            />
          </Alan>
        </div>
      </Kart>

      {hata && (
        <p role="alert" className="rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={() => router.push("/sozlesmeler")}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" disabled={bekliyor || toplamSinirEksik}>
          {bekliyor ? "Kaydediliyor…" : "Taslak olarak kaydet"}
        </Button>
      </div>

      <p className="rounded-sm bg-info-bg px-3 py-2 text-xs text-info">
        Sözleşme numarası kayıtta otomatik verilir ve bir daha değişmez. Kapsam
        kalemlerini kaydettikten sonra detay sayfasından ekleyebilirsiniz.
      </p>
    </form>
  );
}
