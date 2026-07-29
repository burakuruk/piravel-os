"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AG_HATASI, hataMetni } from "../etiketler";

/**
 * Yeni marka formu.
 *
 * Yalnız KİMLİK bilgileri: yetkili, hizmet ve ekip detay sayfasından eklenir.
 * Oluşturma formu uzarsa doldurulmaz ve marka hiç açılmaz.
 *
 * Vergi alanları yalnız SA/FIN'e gösterilir; OPS bu ekrana zaten gelemez
 * (marka oluşturma yetkisi yok) ama form tek yerde tutulduğu için koşul
 * burada da açıkça yazılır.
 */
export function YeniMarkaFormu({ vergiGorunur }: { vergiGorunur: boolean }) {
  const router = useRouter();
  const [alanlar, setAlanlar] = useState({
    code: "",
    name: "",
    legalName: "",
    industry: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    taxNumber: "",
    taxOffice: "",
  });
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const yaz = (alan: keyof typeof alanlar) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAlanlar((o) => ({ ...o, [alan]: e.target.value }));

  const kod = alanlar.code.trim().toUpperCase();
  const kodGecerli = /^[A-Z0-9][A-Z0-9-]{0,14}[A-Z0-9]$/.test(kod);
  const adGecerli = alanlar.name.trim().length >= 2;
  const gonderilebilir = kodGecerli && adGecerli && !bekliyor;

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    try {
      const res = await fetch("/api/v1/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...alanlar, code: kod }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        router.push(`/markalar/${json.brand.id}`);
        router.refresh();
        return;
      }
      setHata(hataMetni(json, "Marka oluşturulamadı."));
    } catch {
      setHata(AG_HATASI);
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <form onSubmit={gonder} className="max-w-[760px] space-y-4" noValidate>
      <section className="rounded-md border border-line-200 bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-900">Kimlik</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ym-kod" className="mb-1 block text-sm text-ink-600">
              Marka kodu *
            </label>
            <input
              id="ym-kod"
              value={alanlar.code}
              onChange={yaz("code")}
              aria-describedby="ym-kod-not"
              className="w-full rounded-sm border border-line-300 px-3 py-2 font-mono text-sm uppercase"
            />
            <p id="ym-kod-not" className="mt-1 text-xs text-ink-400">
              2-16 karakter; harf, rakam ve tire. Büyük harfe çevrilir.{" "}
              <strong className="text-warning">
                Oluşturduktan sonra değiştirilemez
              </strong>{" "}
              — sözleşme ve fatura numaraları bu koda dayanır.
            </p>
            {alanlar.code.length > 0 && !kodGecerli && (
              <p role="alert" className="mt-1 text-xs text-danger">
                Kod 2-16 karakter olmalı; yalnız harf, rakam ve tire içerebilir.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ym-ad" className="mb-1 block text-sm text-ink-600">
              Marka adı *
            </label>
            <input
              id="ym-ad"
              value={alanlar.name}
              onChange={yaz("name")}
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
            {alanlar.name.length > 0 && !adGecerli && (
              <p role="alert" className="mt-1 text-xs text-danger">
                Marka adı en az 2 karakter olmalıdır.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ym-unvan" className="mb-1 block text-sm text-ink-600">
              Yasal unvan
            </label>
            <input
              id="ym-unvan"
              value={alanlar.legalName}
              onChange={yaz("legalName")}
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="ym-sektor" className="mb-1 block text-sm text-ink-600">
              Sektör
            </label>
            <input
              id="ym-sektor"
              value={alanlar.industry}
              onChange={yaz("industry")}
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <span className="mb-1 block text-sm text-ink-600">Durum</span>
            <p className="flex h-[38px] items-center rounded-sm border border-dashed border-line-300 px-3 text-sm text-ink-400">
              Aday olarak başlar
            </p>
            <p className="mt-1 text-xs text-ink-400">
              Durum, marka açıldıktan sonra detay ekranından değiştirilir.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-line-200 bg-surface p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-900">İletişim</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ym-eposta" className="mb-1 block text-sm text-ink-600">
              E-posta
            </label>
            <input
              id="ym-eposta"
              type="email"
              value={alanlar.email}
              onChange={yaz("email")}
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ym-telefon" className="mb-1 block text-sm text-ink-600">
              Telefon
            </label>
            <input
              id="ym-telefon"
              value={alanlar.phone}
              onChange={yaz("phone")}
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ym-web" className="mb-1 block text-sm text-ink-600">
              Web sitesi
            </label>
            <input
              id="ym-web"
              value={alanlar.website}
              onChange={yaz("website")}
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ym-adres" className="mb-1 block text-sm text-ink-600">
              Adres
            </label>
            <input
              id="ym-adres"
              value={alanlar.address}
              onChange={yaz("address")}
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {vergiGorunur && (
        <section className="rounded-md border border-line-200 bg-surface p-5">
          <h2 className="mb-1 text-base font-semibold text-ink-900">Vergi bilgileri</h2>
          <p className="mb-4 text-sm text-ink-400">
            Faturaya ve resmî belgelere gider. Sonradan değiştirmek kimlik
            doğrulaması ister.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ym-vergino" className="mb-1 block text-sm text-ink-600">
                Vergi numarası
              </label>
              <input
                id="ym-vergino"
                value={alanlar.taxNumber}
                onChange={yaz("taxNumber")}
                inputMode="numeric"
                className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ym-vergidairesi" className="mb-1 block text-sm text-ink-600">
                Vergi dairesi
              </label>
              <input
                id="ym-vergidairesi"
                value={alanlar.taxOffice}
                onChange={yaz("taxOffice")}
                className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>
      )}

      {hata && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link href="/markalar">
          <Button type="button">Vazgeç</Button>
        </Link>
        <Button type="submit" variant="primary" disabled={!gonderilebilir}>
          {bekliyor ? "Oluşturuluyor…" : "Markayı oluştur"}
        </Button>
      </div>
    </form>
  );
}
