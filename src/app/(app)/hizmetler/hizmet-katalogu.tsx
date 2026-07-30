"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnayDialog } from "@/components/ui/onay-dialog";
import { StepUpDialog } from "@/components/ui/step-up-dialog";
import { AG_HATASI, hataMetni } from "../markalar/etiketler";

export interface Hizmet {
  id: string;
  code: string;
  name: string;
  /** Boş bırakılabilir; katalogda ve marka detayında salt okunur görünür. */
  description: string | null;
  defaultUnit: string;
  isActive: boolean;
  kullananMarka: number;
}

const BOS = { code: "", name: "", defaultUnit: "Aylık", description: "" };

/**
 * Hizmet kataloğu.
 *
 * ⚠ YAZMA KONTROLLERİ YALNIZ SA İÇİN RENDER EDİLİR. `yazabilir` false ise
 * form paneli, "Yeni hizmet" butonu ve satır işlemleri DOM'a hiç girmez —
 * `disabled` bırakmak, çalışmayan bir kapıyı göstermek olurdu. Asıl yetki
 * elbette API katmanındadır.
 *
 * Hizmet SİLİNMEZ, pasifleştirilir: geçmiş sözleşmeler ve faturalar ona
 * referans verir. "Kullanan marka" sütunu pasifleştirmeden önce etkiyi
 * gösterir.
 *
 * Mobilde tablo yerine kart; yeni hizmet formu ayrı bir panel olarak açılır ve
 * yatay taşma olmaz.
 */
export function HizmetKatalogu({
  hizmetler,
  yazabilir,
}: {
  hizmetler: Hizmet[];
  yazabilir: boolean;
}) {
  const router = useRouter();
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState(BOS);
  const [duzenlenen, setDuzenlenen] = useState<Hizmet | null>(null);
  const [pasiflesecek, setPasiflesecek] = useState<Hizmet | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [stepUpAcik, setStepUpAcik] = useState(false);
  const [bekleyen, setBekleyen] = useState<(() => Promise<void>) | null>(null);

  async function calistir(islem: () => Promise<Response>, basari: string) {
    setBekliyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await islem();
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setMesaj(basari);
        setForm(BOS);
        setFormAcik(false);
        setDuzenlenen(null);
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

  /**
   * Düzenlemeye alırken form MEVCUT DEĞERLERLE dolar.
   *
   * Boş bir formla açmak, kullanıcıya "her alanı yeniden yaz" dedirtir ve
   * gönderilen gövde alanları sessizce boşaltabilirdi.
   */
  function duzenlemeyeAl(h: Hizmet) {
    setDuzenlenen(h);
    setForm({
      code: h.code,
      name: h.name,
      defaultUnit: h.defaultUnit,
      description: h.description ?? "",
    });
    setFormAcik(true);
    setMesaj(null);
    setHata(null);
  }

  const kod = form.code.trim().toUpperCase();
  const kodGecerli = /^[A-Z0-9][A-Z0-9-]{0,14}[A-Z0-9]$/.test(kod);
  const adGecerli = form.name.trim().length >= 2;

  return (
    <>
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

      {/* Mobilde yeni hizmet ayrı panel açar; masaüstünde sağ panel zaten açık */}
      {yazabilir && (
        <div className="mb-4 lg:hidden">
          <Button variant="primary" onClick={() => setFormAcik((a) => !a)}>
            {formAcik ? "Formu kapat" : "Yeni hizmet"}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={yazabilir ? "lg:col-span-2" : "lg:col-span-3"}>
          {hizmetler.length === 0 ? (
            <div className="rounded-md border border-line-200 bg-surface px-6 py-12 text-center">
              <p className="text-sm text-ink-900">Katalogda henüz hizmet yok.</p>
              <p className="mt-1 text-sm text-ink-400">
                {yazabilir
                  ? "İlk hizmet türünü ekleyerek başlayın."
                  : "Hizmet türlerini yönetici tanımlar."}
              </p>
            </div>
          ) : (
            <>
              {/* ── Mobil: kart ── */}
              <ul className="space-y-3 lg:hidden">
                {hizmetler.map((h) => (
                  <li key={h.id} className="rounded-md border border-line-200 bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-ink-400">{h.code}</div>
                        <div className="mt-0.5 text-[15px] font-medium text-ink-900">{h.name}</div>
                        {h.description && (
                          <p className="mt-1 text-xs text-ink-600">{h.description}</p>
                        )}
                      </div>
                      <Badge variant={h.isActive ? "success" : "muted"}>
                        {h.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-ink-400">Birim</dt>
                        <dd className="text-ink-600">{h.defaultUnit}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-400">Kullanan marka</dt>
                        <dd className="tabular-nums text-ink-600">{h.kullananMarka}</dd>
                      </div>
                    </dl>
                    {yazabilir && (
                      <div className="mt-3 flex gap-2 border-t border-line-200 pt-3">
                        <Button size="table" onClick={() => duzenlemeyeAl(h)}>
                          Düzenle
                        </Button>
                        {h.isActive && (
                          <Button size="table" variant="ghost" onClick={() => setPasiflesecek(h)}>
                            Pasifleştir
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* ── Masaüstü: tablo ── */}
              <div className="hidden rounded-md border border-line-200 bg-surface lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                      <th className="px-4 py-3 font-medium">KOD</th>
                      <th className="px-4 py-3 font-medium">HİZMET</th>
                      <th className="px-4 py-3 font-medium">BİRİM</th>
                      <th className="px-4 py-3 text-right font-medium">KULLANAN MARKA</th>
                      <th className="px-4 py-3 font-medium">DURUM</th>
                      {yazabilir && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {hizmetler.map((h) => (
                      <tr key={h.id} className="border-b border-line-200 last:border-0">
                        <td className="px-4 py-3 align-top font-mono text-xs text-ink-600">
                          {h.code}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="text-ink-900">{h.name}</div>
                          {h.description && (
                            <p className="mt-0.5 max-w-[46ch] text-xs text-ink-600">
                              {h.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-ink-600">{h.defaultUnit}</td>
                        <td className="px-4 py-3 text-right align-top tabular-nums text-ink-600">
                          {h.kullananMarka}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant={h.isActive ? "success" : "muted"}>
                            {h.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        {yazabilir && (
                          <td className="px-4 py-3 align-top">
                            <div className="flex justify-end gap-2">
                              <Button size="table" onClick={() => setDuzenlenen(h)}>
                                Düzenle
                              </Button>
                              {h.isActive && (
                                <Button
                                  size="table"
                                  variant="ghost"
                                  onClick={() => setPasiflesecek(h)}
                                >
                                  Pasifleştir
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {yazabilir && (
          <div className={formAcik ? "block" : "hidden lg:block"}>
            <section className="rounded-md border border-line-200 bg-surface">
              <div className="border-b border-line-200 px-5 py-3">
                <h2 className="text-base font-semibold text-ink-900">
                  {duzenlenen ? "Hizmeti düzenle" : "Yeni hizmet"}
                </h2>
              </div>
              <form
                className="space-y-3 p-5"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (duzenlenen) {
                    void calistir(
                      () =>
                        fetch(`/api/v1/services/${duzenlenen.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: form.name.trim() || duzenlenen.name,
                            defaultUnit: form.defaultUnit,
                            /**
                             * Açıklama BOŞ GÖNDERİLEBİLİR: kullanıcı metni
                             * silmek isteyebilir. Alanı "doluysa gönder"
                             * yapmak, silmeyi imkânsız kılardı.
                             */
                            description: form.description,
                            // Kod ancak GEÇERLİ ve DEĞİŞMİŞSE gönderilir
                            ...(kodGecerli && kod !== duzenlenen.code ? { code: kod } : {}),
                          }),
                        }),
                      "Hizmet güncellendi.",
                    );
                    return;
                  }
                  void calistir(
                    () =>
                      fetch("/api/v1/services", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...form, code: kod }),
                      }),
                    "Hizmet katalogla eklendi.",
                  );
                }}
              >
                <div>
                  <label htmlFor="hz-kod" className="mb-1 block text-sm text-ink-600">
                    Kod *
                  </label>
                  <input
                    id="hz-kod"
                    value={form.code}
                    onChange={(e) => setForm((o) => ({ ...o, code: e.target.value }))}
                    className="w-full rounded-sm border border-line-300 px-3 py-2 font-mono text-sm uppercase"
                  />
                  {form.code.length > 0 && !kodGecerli && (
                    <p role="alert" className="mt-1 text-xs text-danger">
                      Kod 2-16 karakter olmalı; harf, rakam ve tire.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="hz-ad" className="mb-1 block text-sm text-ink-600">
                    Hizmet adı *
                  </label>
                  <input
                    id="hz-ad"
                    value={form.name}
                    onChange={(e) => setForm((o) => ({ ...o, name: e.target.value }))}
                    className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="hz-aciklama" className="mb-1 block text-sm text-ink-600">
                    Açıklama
                  </label>
                  <textarea
                    id="hz-aciklama"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((o) => ({ ...o, description: e.target.value }))}
                    className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-ink-400">
                    İsteğe bağlı. Hizmetin kapsamını satış ve operasyon
                    tarafına anlatır; marka detayında da görünür.
                  </p>
                </div>

                <div>
                  <label htmlFor="hz-birim" className="mb-1 block text-sm text-ink-600">
                    Birim
                  </label>
                  <select
                    id="hz-birim"
                    value={form.defaultUnit}
                    onChange={(e) => setForm((o) => ({ ...o, defaultUnit: e.target.value }))}
                    className="w-full rounded-sm border border-line-300 bg-surface px-3 py-2 text-sm"
                  >
                    {["Aylık", "Proje", "Saatlik", "Adet"].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {duzenlenen && (
                    <Button
                      type="button"
                      onClick={() => {
                        setDuzenlenen(null);
                        setForm(BOS);
                      }}
                    >
                      Vazgeç
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={bekliyor || (!duzenlenen && (!kodGecerli || !adGecerli))}
                  >
                    {bekliyor ? "Kaydediliyor…" : duzenlenen ? "Kaydet" : "Ekle"}
                  </Button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>

      {pasiflesecek && (
        <OnayDialog
          baslik="Hizmet pasifleştirilsin mi?"
          aciklama={
            <>
              <strong>{pasiflesecek.name}</strong> yeni markalara atanamaz hâle
              gelecek. Şu anda <strong>{pasiflesecek.kullananMarka} markada</strong>{" "}
              kullanılıyor; mevcut atamalar korunur ve geçmiş belgeler
              etkilenmez. İşlem kimlik doğrulaması ister.
            </>
          }
          onayEtiketi="Pasifleştir"
          yikici
          bekliyor={bekliyor}
          onKapat={() => setPasiflesecek(null)}
          onOnayla={() => {
            const hedef = pasiflesecek;
            setPasiflesecek(null);
            void calistir(
              () =>
                fetch(`/api/v1/services/${hedef.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isActive: false }),
                }),
              "Hizmet pasifleştirildi.",
            );
          }}
        />
      )}

      {stepUpAcik && (
        <StepUpDialog
          onKapat={() => {
            setStepUpAcik(false);
            setBekleyen(null);
            setHata("İşlem iptal edildi; hizmet değişmedi.");
          }}
          onBasarili={async () => {
            setStepUpAcik(false);
            const islem = bekleyen;
            setBekleyen(null);
            if (islem) await islem();
          }}
        />
      )}
    </>
  );
}
