"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnayDialog } from "@/components/ui/onay-dialog";
import { AG_HATASI, hataMetni } from "../etiketler";

export interface Yetkili {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

const BOS = { fullName: "", title: "", email: "", phone: "", isPrimary: false };

/**
 * Marka yetkilileri.
 *
 * ⚠ Yetkili bir SİSTEM KULLANICISI DEĞİLDİR: Piravel OS'a giriş yapmaz, davet
 * almaz, `users` tablosuna satır açılmaz. Bu ayrım ekranda da yazılıdır, yoksa
 * "yetkiliye davet gönderelim mi" karışıklığı çıkar.
 *
 * Marka başına tek birincil yetkili; yenisi işaretlenince eskisi sunucuda
 * aynı transaction'da düşer.
 */
export function MarkaYetkilileri({
  brandId,
  yetkililer,
  ekleyebilir,
  silebilir,
}: {
  brandId: string;
  yetkililer: Yetkili[];
  ekleyebilir: boolean;
  silebilir: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<typeof BOS | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<Yetkili | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function istek(url: string, metod: string, govde?: unknown) {
    setBekliyor(true);
    setHata(null);
    try {
      const res = await fetch(url, {
        method: metod,
        headers: { "Content-Type": "application/json" },
        body: govde === undefined ? undefined : JSON.stringify(govde),
      });
      if (res.ok) {
        setForm(null);
        setDuzenlenen(null);
        router.refresh();
        return true;
      }
      setHata(hataMetni(await res.json().catch(() => null)));
      return false;
    } catch {
      setHata(AG_HATASI);
      return false;
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="flex items-center justify-between border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">Yetkili kişiler</h2>
        {ekleyebilir && !form && (
          <Button size="table" onClick={() => setForm({ ...BOS })}>
            + Yetkili ekle
          </Button>
        )}
      </div>

      <div className="p-5">
        {hata && (
          <p role="alert" className="mb-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
            {hata}
          </p>
        )}

        {yetkililer.length === 0 && !form && (
          <p className="text-sm text-ink-400">
            Bu markada henüz yetkili yok. Yetkili, marka tarafındaki iletişim
            kaydıdır; sisteme giriş yapmaz.
          </p>
        )}

        <ul className="divide-y divide-line-200 text-sm">
          {yetkililer.map((y) =>
            duzenlenen === y.id ? (
              <li key={y.id} className="py-3">
                <YetkiliFormu
                  baslangic={{
                    fullName: y.fullName,
                    title: y.title ?? "",
                    email: y.email ?? "",
                    phone: y.phone ?? "",
                    isPrimary: y.isPrimary,
                  }}
                  bekliyor={bekliyor}
                  onVazgec={() => setDuzenlenen(null)}
                  onKaydet={(d) => istek(`/api/v1/contacts/${y.id}`, "PATCH", d)}
                />
              </li>
            ) : (
              /*
                ⚠ Satır dar ekranda ALT ALTA geçer ve buton grubu SARAR.
                `shrink-0` bir buton grubu 375 px'te satırı viewport'tan
                taşırır: kart genişler, sayfa yatay kayar ve butonlar ekranın
                dışında kalır.
              */
              <li
                key={y.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-900">{y.fullName}</span>
                    {y.isPrimary && <Badge variant="info">Birincil</Badge>}
                  </div>
                  <div className="text-xs break-words text-ink-400">
                    {[y.title, y.email, y.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                {ekleyebilir && (
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    {!y.isPrimary && (
                      <Button
                        size="table"
                        disabled={bekliyor}
                        onClick={() =>
                          istek(`/api/v1/contacts/${y.id}`, "PATCH", { isPrimary: true })
                        }
                      >
                        Birincil yap
                      </Button>
                    )}
                    <Button size="table" onClick={() => setDuzenlenen(y.id)}>
                      Düzenle
                    </Button>
                    {silebilir && (
                      <Button size="table" variant="ghost" onClick={() => setSilinecek(y)}>
                        Kaldır
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ),
          )}
        </ul>

        {form && (
          <div className="mt-4 rounded-sm border border-line-200 bg-fill-100 p-4">
            <h3 className="mb-3 text-sm font-medium text-ink-900">Yeni yetkili</h3>
            <YetkiliFormu
              baslangic={form}
              bekliyor={bekliyor}
              onVazgec={() => setForm(null)}
              onKaydet={(d) => istek(`/api/v1/brands/${brandId}/contacts`, "POST", d)}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-ink-400">
          Marka yetkilisi bir sistem kullanıcısı değildir: Piravel OS&apos;a giriş
          yapmaz ve davet almaz. Sisteme erişecek kişiler Kullanıcılar
          modülünden davet edilir.
        </p>
      </div>

      {silinecek && (
        <OnayDialog
          baslik="Yetkili kaldırılsın mı?"
          aciklama={
            <>
              <strong>{silinecek.fullName}</strong> markanın yetkili listesinden
              çıkarılacak. Kayıt tarihçede kalır, geçmiş belgeler etkilenmez.
            </>
          }
          onayEtiketi="Kaldır"
          yikici
          bekliyor={bekliyor}
          onKapat={() => setSilinecek(null)}
          onOnayla={async () => {
            const hedef = silinecek;
            setSilinecek(null);
            await istek(`/api/v1/contacts/${hedef.id}`, "DELETE");
          }}
        />
      )}
    </section>
  );
}

function YetkiliFormu({
  baslangic,
  bekliyor,
  onVazgec,
  onKaydet,
}: {
  baslangic: typeof BOS;
  bekliyor: boolean;
  onVazgec: () => void;
  onKaydet: (d: typeof BOS) => void;
}) {
  const [d, setD] = useState(baslangic);
  const gecerli = d.fullName.trim().length >= 2;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onKaydet(d);
      }}
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="myk-ad" className="mb-1 block text-xs text-ink-600">
            Ad soyad *
          </label>
          <input
            id="myk-ad"
            value={d.fullName}
            onChange={(e) => setD((o) => ({ ...o, fullName: e.target.value }))}
            className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="myk-unvan" className="mb-1 block text-xs text-ink-600">
            Ünvan
          </label>
          <input
            id="myk-unvan"
            value={d.title}
            onChange={(e) => setD((o) => ({ ...o, title: e.target.value }))}
            className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="myk-eposta" className="mb-1 block text-xs text-ink-600">
            E-posta
          </label>
          <input
            id="myk-eposta"
            type="email"
            value={d.email}
            onChange={(e) => setD((o) => ({ ...o, email: e.target.value }))}
            className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="myk-telefon" className="mb-1 block text-xs text-ink-600">
            Telefon
          </label>
          <input
            id="myk-telefon"
            value={d.phone}
            onChange={(e) => setD((o) => ({ ...o, phone: e.target.value }))}
            className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={d.isPrimary}
          onChange={(e) => setD((o) => ({ ...o, isPrimary: e.target.checked }))}
        />
        Birincil yetkili yap
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" onClick={onVazgec} disabled={bekliyor}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" disabled={bekliyor || !gecerli}>
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
