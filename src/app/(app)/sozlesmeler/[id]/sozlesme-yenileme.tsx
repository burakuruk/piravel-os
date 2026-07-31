"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AG_HATASI, hataMetni, tarihYaz, yenilemeRozeti } from "../etiketler";

/**
 * Yenileme kartı — sözleşme aktifken de düzenlenebilen az sayıdaki alandan.
 *
 * ⚠ İKİ AYRI TARİH: "yenileme görüşmesi" ile "yenileme" aynı şey değil.
 * 31.03.2027'de biten bir sözleşmede 15.09.2026 yenileme tarihi olamaz; o gün
 * görüşmenin yapılacağı gündür. Rozet DAYANDIĞI ALANI söyler.
 *
 * ⚠ Süresiz sözleşmede (bitiş yok) yenileme tarihi KULLANILAMAZ, görüşme
 * tarihi kullanılabilir: neyin bittiği belli değilse yeni dönemin ne zaman
 * başladığı da tanımsızdır.
 */
export function SozlesmeYenileme({
  contractId,
  endDate,
  renewalDate,
  renewalReviewDate,
  autoRenew,
  duzenlenebilir,
}: {
  contractId: string;
  endDate: string | null;
  renewalDate: string | null;
  renewalReviewDate: string | null;
  autoRenew: boolean;
  duzenlenebilir: boolean;
}) {
  const router = useRouter();
  const [duzenle, setDuzenle] = useState(false);
  const [gorusme, setGorusme] = useState(renewalReviewDate ?? "");
  const [yenileme, setYenileme] = useState(renewalDate ?? "");
  const [oto, setOto] = useState(autoRenew);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const suresiz = !endDate;
  const rozet = yenilemeRozeti(renewalReviewDate, renewalDate);

  async function kaydet() {
    setBekliyor(true);
    setHata(null);
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renewalReviewDate: gorusme.trim() || null,
          renewalDate: suresiz ? null : yenileme.trim() || null,
          autoRenew: oto,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
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

  const KUTU =
    "h-9 w-full rounded-sm border border-line-300 bg-surface px-3 text-sm max-sm:min-h-11";

  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">Yenileme</h2>
        {duzenlenebilir && !duzenle && (
          <Button size="table" onClick={() => setDuzenle(true)}>
            Düzenle
          </Button>
        )}
      </div>

      <div className="p-5">
        {hata && (
          <p role="alert" className="mb-4 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {hata}
          </p>
        )}

        {duzenle ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="yen-gorusme" className="mb-1 block text-sm text-ink-600">
                Yenileme görüşmesi tarihi
              </label>
              <input
                id="yen-gorusme"
                type="date"
                value={gorusme}
                onChange={(e) => setGorusme(e.target.value)}
                className={KUTU}
              />
              <p className="mt-1 text-xs text-ink-400">
                Müşteriyle yenilemeyi konuşacağınız gün. Hatırlatma bu tarihe göre çıkar.
              </p>
            </div>
            <div>
              <label htmlFor="yen-yenileme" className="mb-1 block text-sm text-ink-600">
                Yenileme tarihi (yeni dönem başlangıcı)
              </label>
              <input
                id="yen-yenileme"
                type="date"
                value={suresiz ? "" : yenileme}
                disabled={suresiz}
                onChange={(e) => setYenileme(e.target.value)}
                className={`${KUTU} disabled:bg-fill-100 disabled:text-ink-400`}
              />
              <p className="mt-1 text-xs text-ink-400">
                {suresiz
                  ? "Süresiz sözleşmede kullanılamaz."
                  : `Bitiş tarihinden (${tarihYaz(endDate)}) SONRA olmalı.`}
              </p>
            </div>
            <label className="flex items-start gap-2 text-[13px] text-ink-600 max-sm:min-h-11 max-sm:items-center">
              <input
                type="checkbox"
                checked={oto}
                disabled={suresiz || !yenileme}
                onChange={(e) => setOto(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              Otomatik yenileme bayrağı — yenileme tarihi olmadan işaretlenemez
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setDuzenle(false)}>Vazgeç</Button>
              <Button variant="primary" disabled={bekliyor} onClick={kaydet}>
                {bekliyor ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Salt okunur: düz metin, kutu YOK */}
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-ink-400">Sözleşme bitişi</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{tarihYaz(endDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Yenileme görüşmesi</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{tarihYaz(renewalReviewDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Yenileme tarihi (yeni dönem)</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{tarihYaz(renewalDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Hatırlatma</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{autoRenew ? "Açık" : "Kapalı"}</dd>
              </div>
            </dl>

            {rozet ? (
              <>
                <div className="mt-3">
                  <Badge variant="warning">{rozet.metin}</Badge>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  Rozet{" "}
                  <strong className="text-ink-600">
                    {renewalReviewDate ? "görüşme" : "yenileme"}
                  </strong>{" "}
                  tarihine göre sayar.
                </p>
              </>
            ) : (
              !renewalDate &&
              !renewalReviewDate && (
                <p className="mt-3 rounded-sm bg-fill-100 px-3 py-2 text-[13px] text-ink-600">
                  Bu sözleşme için yenileme planlanmamış. Bitiş yaklaştığında uyarı almak
                  isterseniz bir görüşme tarihi ekleyin.
                </p>
              )
            )}
          </>
        )}
      </div>
    </section>
  );
}
