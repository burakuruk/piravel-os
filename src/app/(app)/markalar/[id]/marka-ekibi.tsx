"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OnayDialog } from "@/components/ui/onay-dialog";
import { StepUpDialog } from "@/components/ui/step-up-dialog";
import { AG_HATASI, hataMetni } from "../etiketler";

export interface Atama {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  assignedAt: string;
}

interface Aday {
  id: string;
  fullName: string;
  email: string;
}

/**
 * Sorumlu ekip.
 *
 * ⚠ Atama bir YETKİ SINIRIDIR: kaldırıldığı anda operasyon kullanıcısı markayı
 * ve ona bağlı kayıtları göremez. Bu yüzden yalnız SA işlem yapabilir, her
 * işlem kimlik doğrulaması (step-up) ister ve kaldırma onay penceresi ister.
 *
 * FIN ve kapsam içindeki OPS listeyi görür ama hiçbir yazma kontrolü DOM'a
 * girmez — buton gizlemek yetki değildir, ama gereksiz yere göstermek de
 * kullanıcıya çalışmayacak bir kapı açar.
 *
 * Listede yalnız açıkça atanmış OPS kullanıcıları bulunur; SA ve FIN rolleri
 * gereği tüm markaları zaten görür ve burada listelenmezler.
 */
export function MarkaEkibi({
  brandId,
  atamalar,
  yonetebilir,
}: {
  brandId: string;
  atamalar: Atama[];
  yonetebilir: boolean;
}) {
  const router = useRouter();
  const [adaylar, setAdaylar] = useState<Aday[] | null>(null);
  const [arama, setArama] = useState("");
  const [secim, setSecim] = useState("");
  const [kaldirilacak, setKaldirilacak] = useState<Atama | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [stepUpAcik, setStepUpAcik] = useState(false);
  const [bekleyen, setBekleyen] = useState<(() => Promise<void>) | null>(null);

  async function adaylariGetir(q: string) {
    setHata(null);
    try {
      const res = await fetch(
        `/api/v1/brands/${brandId}/assignments/candidates${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      );
      if (!res.ok) {
        setHata(hataMetni(await res.json().catch(() => null)));
        return;
      }
      const json = await res.json();
      setAdaylar(json.candidates ?? []);
      setSecim("");
    } catch {
      setHata(AG_HATASI);
    }
  }

  /** Kritik işlem akışı: SESSION_STALE → step-up → aynı işlem tekrar. */
  async function calistir(islem: () => Promise<Response>, basari: string) {
    setBekliyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const res = await islem();
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setMesaj(basari);
        setSecim("");
        setAdaylar(null);
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

  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">Sorumlu ekip</h2>
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

        {atamalar.length === 0 ? (
          <p className="text-sm text-ink-400">
            Bu markaya henüz operasyon kullanıcısı atanmamış.
          </p>
        ) : (
          <ul className="divide-y divide-line-200 text-sm">
            {/* Dar ekranda alt alta: sabit genişlikli buton satırı taşırırdı */}
            {atamalar.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="text-ink-900">{a.fullName}</div>
                  <div className="text-xs break-words text-ink-400">
                    {a.email} · {new Date(a.assignedAt).toLocaleDateString("tr-TR")} tarihinde
                    atandı
                  </div>
                </div>
                {yonetebilir && (
                  <div className="sm:shrink-0">
                    <Button
                      size="table"
                      variant="ghost"
                      disabled={bekliyor}
                      onClick={() => setKaldirilacak(a)}
                    >
                      Kaldır
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {yonetebilir && (
          <div className="mt-4 border-t border-line-200 pt-4">
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void adaylariGetir(arama);
              }}
            >
              <div className="flex-1">
                <label htmlFor="ekip-ara" className="mb-1 block text-sm text-ink-600">
                  Operasyon kullanıcısı ara
                </label>
                <input
                  id="ekip-ara"
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  placeholder="Ad veya e-posta…"
                  className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit">Ara</Button>
            </form>
            <p className="mt-2 text-xs text-ink-400">
              Aramada yalnız operasyon rolündeki aktif kullanıcılar çıkar.
              Yönetici ve finans rolleri tüm markaları rolleri gereği zaten
              görür; atanmaları gerekmez.
            </p>

            {adaylar !== null && (
              <div className="mt-3 rounded-sm border border-line-200 bg-fill-100 p-3">
                <div className="mb-2 text-xs tracking-widest text-ink-400">ARAMA SONUCU</div>
                {adaylar.length === 0 ? (
                  <p className="text-sm text-ink-400">
                    Eşleşen atanabilir kullanıcı yok.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-2 text-sm">
                      {adaylar.map((k) => (
                        <li key={k.id} className="flex items-center justify-between gap-3">
                          <label className="flex min-w-0 items-center gap-2">
                            <input
                              type="radio"
                              name="aday"
                              value={k.id}
                              checked={secim === k.id}
                              onChange={() => setSecim(k.id)}
                            />
                            <span className="min-w-0">
                              <span className="block text-ink-900">{k.fullName}</span>
                              <span className="block truncate text-xs text-ink-400">
                                {k.email}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="primary"
                        size="table"
                        disabled={!secim || bekliyor}
                        onClick={() =>
                          calistir(
                            () =>
                              fetch(`/api/v1/brands/${brandId}/assignments`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId: secim }),
                              }),
                            "Kullanıcı markaya atandı.",
                          )
                        }
                      >
                        {bekliyor ? "Atanıyor…" : "Ata"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {kaldirilacak && (
        <OnayDialog
          baslik="Marka ataması kaldırılsın mı?"
          aciklama={
            <>
              <strong>{kaldirilacak.fullName}</strong> bu markayı ve ona bağlı
              kayıtları <strong>anında göremez</strong> hâle gelecek; açık
              sekmesinde de bir sonraki istekte erişimi kesilir. Kayıt tarihçede
              kalır, atama daha sonra yeniden verilebilir.
            </>
          }
          onayEtiketi="Atamayı kaldır"
          yikici
          bekliyor={bekliyor}
          onKapat={() => setKaldirilacak(null)}
          onOnayla={() => {
            const hedef = kaldirilacak;
            setKaldirilacak(null);
            void calistir(
              () =>
                fetch(`/api/v1/brands/${brandId}/assignments`, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: hedef.userId }),
                }),
              "Atama kaldırıldı.",
            );
          }}
        />
      )}

      {stepUpAcik && (
        <StepUpDialog
          onKapat={() => {
            setStepUpAcik(false);
            setBekleyen(null);
            setHata("İşlem iptal edildi; atama değişmedi.");
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
