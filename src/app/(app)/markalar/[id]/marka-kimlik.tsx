"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OnayDialog } from "@/components/ui/onay-dialog";
import { StepUpDialog } from "@/components/ui/step-up-dialog";
import { AG_HATASI, DURUM_ETIKET, DURUMLAR, hataMetni, type MarkaDurumu } from "../etiketler";

export interface MarkaAlanlari {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  industry?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  /** OPS yanıtında bu iki alan HİÇ BULUNMAZ — undefined ile "boş" farklıdır. */
  taxNumber?: string | null;
  taxOffice?: string | null;
  status: string;
}

/**
 * Kimlik ve iletişim kartı — salt okunur görünüm + düzenleme modu.
 *
 * ⚠ Salt okunur değerler DÜZ METİN gösterilir. Çerçeveli bir kutu kullanıcıya
 * "buraya yazabilirim" der ve tıklayınca hiçbir şey olmaz; input, select ve
 * form alanları yalnız "Düzenle" modunda DOM'a girer.
 *
 * Marka kodu düzenleme modunda da input DEĞİLDİR: oluşturulduktan sonra
 * değiştirilemez ve bunu denemeye açık bırakmak, reddedilecek bir işi
 * kullanıcıya yaptırmak olurdu.
 */
export function MarkaKimlik({
  marka,
  duzenleyebilir,
  durumDegistirebilir,
  /**
   * OPS yalnız OPERASYONEL alanları düzenler. Yasal unvan sunucuda zaten
   * süzülüp düşer; düzenlenebilir gibi göstermek kullanıcıya kaydedilmeyecek
   * bir alan doldurtmak olurdu.
   */
  sinirliDuzenleme = false,
}: {
  marka: MarkaAlanlari;
  duzenleyebilir: boolean;
  durumDegistirebilir: boolean;
  sinirliDuzenleme?: boolean;
}) {
  const router = useRouter();
  const vergiGorunur = "taxNumber" in marka || "taxOffice" in marka;

  const [duzenleme, setDuzenleme] = useState(false);
  const [taslak, setTaslak] = useState(marka);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [stepUpAcik, setStepUpAcik] = useState(false);
  const [bekleyen, setBekleyen] = useState<(() => Promise<void>) | null>(null);
  const [durumOnayi, setDurumOnayi] = useState<MarkaDurumu | null>(null);

  /** Kritik işlemlerin ortak akışı: SESSION_STALE → pencere → aynı işlem. */
  async function calistir(islem: () => Promise<Response>, basari: string) {
    setBekliyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await islem();
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setMesaj(basari);
        setDuzenleme(false);
        router.refresh();
        return;
      }
      if (json?.error?.code === "SESSION_STALE") {
        setBekleyen(() => async () => {
          await calistir(islem, basari);
        });
        setStepUpAcik(true);
        return;
      }
      setHata(hataMetni(json));
    } catch {
      setHata(AG_HATASI);
    } finally {
      setBekliyor(false);
    }
  }

  function kaydet() {
    const govde: Record<string, unknown> = {
      name: taslak.name,
      ...(sinirliDuzenleme ? {} : { legalName: taslak.legalName ?? "" }),
      industry: taslak.industry ?? "",
      email: taslak.email ?? "",
      phone: taslak.phone ?? "",
      website: taslak.website ?? "",
      address: taslak.address ?? "",
    };
    if (vergiGorunur) {
      govde.taxNumber = taslak.taxNumber ?? "";
      govde.taxOffice = taslak.taxOffice ?? "";
    }
    void calistir(
      () =>
        fetch(`/api/v1/brands/${marka.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(govde),
        }),
      "Marka bilgileri güncellendi.",
    );
  }

  const satirlar: Array<[string, string | null | undefined]> = [
    ["Marka kodu", marka.code],
    ["Sektör", marka.industry],
    ["Yasal unvan", marka.legalName],
    ["E-posta", marka.email],
    ["Telefon", marka.phone],
    ["Web sitesi", marka.website],
    ["Adres", marka.address],
  ];
  if (vergiGorunur) {
    satirlar.push(["Vergi numarası", marka.taxNumber], ["Vergi dairesi", marka.taxOffice]);
  }

  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="flex items-center justify-between border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">Kimlik ve iletişim</h2>
        {duzenleyebilir && !duzenleme && (
          <Button
            size="table"
            onClick={() => {
              setTaslak(marka);
              setDuzenleme(true);
              setMesaj(null);
            }}
          >
            Düzenle
          </Button>
        )}
      </div>

      <div className="p-5">
        {mesaj && (
          <p role="status" className="mb-4 rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            {mesaj}
          </p>
        )}
        {hata && (
          <p role="alert" className="mb-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
            {hata}
          </p>
        )}

        {duzenleme ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              kaydet();
            }}
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Kod düzenlenemez: DB'de de trigger ile kilitli */}
              <div>
                <span className="mb-1 block text-sm text-ink-600">Marka kodu</span>
                <p className="flex h-[38px] items-center rounded-sm bg-fill-100 px-3 font-mono text-sm text-ink-600">
                  {marka.code}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Marka kodu değiştirilemez.
                </p>
              </div>

              <Alan
                id="mk-ad"
                etiket="Marka adı *"
                deger={taslak.name}
                onChange={(v) => setTaslak((o) => ({ ...o, name: v }))}
              />
              {sinirliDuzenleme ? (
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-sm text-ink-600">Yasal unvan</span>
                  <p className="flex min-h-[38px] items-center rounded-sm bg-fill-100 px-3 text-sm text-ink-600">
                    {marka.legalName || "—"}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Yasal unvanı yönetici veya finans düzenleyebilir.
                  </p>
                </div>
              ) : (
                <Alan
                  id="mk-unvan"
                  etiket="Yasal unvan"
                  genis
                  deger={taslak.legalName ?? ""}
                  onChange={(v) => setTaslak((o) => ({ ...o, legalName: v }))}
                />
              )}
              <Alan
                id="mk-sektor"
                etiket="Sektör"
                deger={taslak.industry ?? ""}
                onChange={(v) => setTaslak((o) => ({ ...o, industry: v }))}
              />
              <Alan
                id="mk-eposta"
                etiket="E-posta"
                deger={taslak.email ?? ""}
                onChange={(v) => setTaslak((o) => ({ ...o, email: v }))}
              />
              <Alan
                id="mk-telefon"
                etiket="Telefon"
                deger={taslak.phone ?? ""}
                onChange={(v) => setTaslak((o) => ({ ...o, phone: v }))}
              />
              <Alan
                id="mk-web"
                etiket="Web sitesi"
                deger={taslak.website ?? ""}
                onChange={(v) => setTaslak((o) => ({ ...o, website: v }))}
              />
              <Alan
                id="mk-adres"
                etiket="Adres"
                genis
                deger={taslak.address ?? ""}
                onChange={(v) => setTaslak((o) => ({ ...o, address: v }))}
              />

              {vergiGorunur && (
                <>
                  <Alan
                    id="mk-vergino"
                    etiket="Vergi numarası"
                    deger={taslak.taxNumber ?? ""}
                    onChange={(v) => setTaslak((o) => ({ ...o, taxNumber: v }))}
                  />
                  <Alan
                    id="mk-vergidairesi"
                    etiket="Vergi dairesi"
                    deger={taslak.taxOffice ?? ""}
                    onChange={(v) => setTaslak((o) => ({ ...o, taxOffice: v }))}
                  />
                  <p className="text-xs text-warning sm:col-span-2">
                    Vergi bilgisi değişikliği kaydedilirken kimliğiniz yeniden
                    doğrulanır.
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" onClick={() => setDuzenleme(false)} disabled={bekliyor}>
                Vazgeç
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={bekliyor || taslak.name.trim().length < 2}
              >
                {bekliyor ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {satirlar.map(([etiket, deger]) => (
              <div key={etiket} className={etiket === "Adres" ? "sm:col-span-2" : ""}>
                <dt className="text-xs text-ink-400">{etiket}</dt>
                <dd
                  className={`mt-0.5 text-sm text-ink-900 ${
                    etiket === "Marka kodu" ? "font-mono" : ""
                  }`}
                >
                  {deger || "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {durumDegistirebilir && !duzenleme && (
          <div className="mt-6 border-t border-line-200 pt-4">
            <h3 className="mb-1 text-sm font-medium text-ink-900">Marka durumu</h3>
            <p className="mb-3 text-sm text-ink-400">
              Durum değişimi faturalama ve sözleşme tarafını etkiler; kimlik
              doğrulaması ister.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {DURUMLAR.filter((d) => d !== marka.status).map((d) => (
                <Button key={d} size="table" onClick={() => setDurumOnayi(d)} disabled={bekliyor}>
                  {DURUM_ETIKET[d]} yap
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {durumOnayi && (
        <OnayDialog
          baslik={`Marka durumu "${DURUM_ETIKET[durumOnayi]}" olarak değiştirilsin mi?`}
          aciklama={
            <>
              <strong>{marka.name}</strong> markasının durumu değişecek. Askıya
              alınan veya ayrılan markalar raporlarda ve listelerde farklı
              görünür.
            </>
          }
          onayEtiketi="Durumu değiştir"
          yikici={durumOnayi === "churned" || durumOnayi === "suspended"}
          bekliyor={bekliyor}
          onKapat={() => setDurumOnayi(null)}
          onOnayla={() => {
            const hedef = durumOnayi;
            setDurumOnayi(null);
            void calistir(
              () =>
                fetch(`/api/v1/brands/${marka.id}/status`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: hedef }),
                }),
              `Marka durumu "${DURUM_ETIKET[hedef]}" olarak güncellendi.`,
            );
          }}
        />
      )}

      {stepUpAcik && (
        <StepUpDialog
          onKapat={() => {
            setStepUpAcik(false);
            setBekleyen(null);
            setHata("İşlem iptal edildi; değişiklik kaydedilmedi.");
          }}
          onBasarili={async () => {
            setStepUpAcik(false);
            const islem = bekleyen;
            setBekleyen(null);
            if (islem) await islem();
          }}
        />
      )}
    </section>
  );
}

function Alan({
  id,
  etiket,
  deger,
  onChange,
  genis,
}: {
  id: string;
  etiket: string;
  deger: string;
  onChange: (v: string) => void;
  genis?: boolean;
}) {
  return (
    <div className={genis ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="mb-1 block text-sm text-ink-600">
        {etiket}
      </label>
      <input
        id={id}
        value={deger}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
