"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnayDialog } from "@/components/ui/onay-dialog";
import { AG_HATASI, hataMetni } from "../etiketler";

export interface MarkaHizmeti {
  serviceId: string;
  code: string;
  name: string;
  defaultUnit: string;
  isActive: boolean;
}

export interface KatalogHizmeti {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

/**
 * Markanın aldığı hizmetler.
 *
 * Hizmet TÜRÜ burada oluşturulamaz; yalnız katalogdan seçilir. Katalogda zaten
 * ekli olan hizmetler seçim listesinde çıkmaz — aynı hizmeti ikinci kez
 * eklemek sunucuda da engellidir (canlı kayıt varsa yeni satır açılmaz).
 *
 * Pasif hizmetler listede görünmez: pasifleştirme "artık satmıyoruz" demektir.
 * Markada zaten duran pasif bir hizmet ise korunur ve rozetle işaretlenir.
 */
export function MarkaHizmetleri({
  brandId,
  hizmetler,
  katalog,
  yonetebilir,
}: {
  brandId: string;
  hizmetler: MarkaHizmeti[];
  katalog: KatalogHizmeti[];
  yonetebilir: boolean;
}) {
  const router = useRouter();
  const [secim, setSecim] = useState("");
  const [cikarilacak, setCikarilacak] = useState<MarkaHizmeti | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const ekliIdler = new Set(hizmetler.map((h) => h.serviceId));
  const eklenebilir = katalog.filter((k) => k.isActive && !ekliIdler.has(k.id));

  async function istek(metod: string, serviceId: string) {
    setBekliyor(true);
    setHata(null);
    try {
      const res = await fetch(`/api/v1/brands/${brandId}/services`, {
        method: metod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      if (res.ok) {
        setSecim("");
        router.refresh();
        return;
      }
      setHata(hataMetni(await res.json().catch(() => null)));
    } catch {
      setHata(AG_HATASI);
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">Alınan hizmetler</h2>
      </div>

      <div className="p-5">
        {hata && (
          <p role="alert" className="mb-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
            {hata}
          </p>
        )}

        {hizmetler.length === 0 ? (
          <p className="text-sm text-ink-400">
            Bu markaya henüz hizmet bağlanmamış.
          </p>
        ) : (
          <ul className="divide-y divide-line-200 text-sm">
            {/* Dar ekranda alt alta: sabit genişlikli buton satırı taşırırdı */}
            {hizmetler.map((h) => (
              <li
                key={h.serviceId}
                className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-400">{h.code}</span>
                    <span className="text-ink-900">{h.name}</span>
                    {!h.isActive && <Badge variant="muted">Katalogda pasif</Badge>}
                  </div>
                  <div className="text-xs text-ink-400">Birim: {h.defaultUnit}</div>
                </div>
                {yonetebilir && (
                  <div className="sm:shrink-0">
                    <Button
                      size="table"
                      variant="ghost"
                      onClick={() => setCikarilacak(h)}
                      disabled={bekliyor}
                    >
                      Çıkar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {yonetebilir && (
          <form
            className="mt-4 flex flex-col gap-2 border-t border-line-200 pt-4 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (secim) void istek("POST", secim);
            }}
          >
            <div className="flex-1">
              <label htmlFor="mh-secim" className="mb-1 block text-sm text-ink-600">
                Katalogdan hizmet ekle
              </label>
              <select
                id="mh-secim"
                value={secim}
                onChange={(e) => setSecim(e.target.value)}
                disabled={eklenebilir.length === 0}
                className="w-full rounded-sm border border-line-300 bg-surface px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">
                  {eklenebilir.length === 0 ? "Eklenebilecek hizmet yok" : "Hizmet seçin…"}
                </option>
                {eklenebilir.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.code} · {k.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" disabled={!secim || bekliyor}>
              {bekliyor ? "Ekleniyor…" : "Ekle"}
            </Button>
          </form>
        )}

        <p className="mt-3 text-xs text-ink-400">
          Hizmetler katalogdan seçilir; buradan yeni hizmet türü oluşturulamaz.
        </p>
      </div>

      {cikarilacak && (
        <OnayDialog
          baslik="Hizmet markadan çıkarılsın mı?"
          aciklama={
            <>
              <strong>{cikarilacak.name}</strong> bu markanın hizmet listesinden
              çıkarılacak. Kayıt tarihçede kalır ve hizmet daha sonra yeniden
              eklenebilir.
            </>
          }
          onayEtiketi="Çıkar"
          yikici
          bekliyor={bekliyor}
          onKapat={() => setCikarilacak(null)}
          onOnayla={async () => {
            const hedef = cikarilacak;
            setCikarilacak(null);
            await istek("DELETE", hedef.serviceId);
          }}
        />
      )}
    </section>
  );
}
