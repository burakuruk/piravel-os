"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StepUpDialog } from "@/components/ui/step-up-dialog";
import { AG_HATASI, hataMetni } from "../etiketler";

/**
 * Sözleşme yaşam döngüsü işlemleri: yürürlüğe al · sonlandır · iptal et.
 *
 * Üçü de STEP-UP ister. Akış her üçünde aynı:
 *   1. Onay penceresi NE OLACAĞINI sayar (sadece "emin misiniz?" değil)
 *   2. Sonlandırma/iptalde gerekçe zorunlu (3-500, trim'li)
 *   3. Sunucu SESSION_STALE dönerse step-up penceresi açılır
 *   4. Doğrulama başarılıysa AYNI işlem otomatik tekrar denenir
 *   5. Kullanıcı step-up'tan vazgeçerse işlem yapılmaz ve bunu görür
 *
 * ⚠ İptal, TASLAK sözleşmede de step-up ister: numara verilmiş bir belge iz
 * bırakmadan yok edilmemeli.
 */

type Islem = "activate" | "end" | "cancel";

const BASLIK: Record<Islem, string> = {
  activate: "Sözleşmeyi yürürlüğe al",
  end: "Sözleşmeyi sonlandır",
  cancel: "Sözleşmeyi iptal et",
};

const DUGME: Record<Islem, string> = {
  activate: "Yürürlüğe al",
  end: "Sonlandır",
  cancel: "İptal et",
};

export function SozlesmeIslemler({
  contractId,
  contractNo,
  status,
  markaAdi,
  markaDurumu,
  baglanacakHizmetler,
}: {
  contractId: string;
  contractNo: string;
  status: string;
  markaAdi: string;
  markaDurumu: string;
  /** Aktivasyonda markanın hizmet listesine eklenecek olanlar (ad listesi). */
  baglanacakHizmetler: string[];
}) {
  const router = useRouter();
  const [acik, setAcik] = useState<Islem | null>(null);
  const [gerekce, setGerekce] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [stepUpAcik, setStepUpAcik] = useState(false);
  const [bekleyen, setBekleyen] = useState<(() => Promise<void>) | null>(null);

  const aktiflestirilebilir = status === "draft";
  const sonlandirilabilir = status === "active";
  const iptalEdilebilir = status === "draft" || status === "active";

  if (!aktiflestirilebilir && !sonlandirilabilir && !iptalEdilebilir) {
    return (
      <p className="text-sm text-ink-400">
        Bu sözleşme salt okunur. Sonlanmış veya iptal edilmiş sözleşmede işlem yapılamaz.
      </p>
    );
  }

  async function calistir(islem: Islem, neden: string) {
    setBekliyor(true);
    setHata(null);
    setMesaj(null);
    try {
      const govde =
        islem === "end"
          ? { endReason: neden }
          : islem === "cancel"
            ? { cancelReason: neden }
            : {};
      const res = await fetch(`/api/v1/contracts/${contractId}/${islem}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      const json = await res.json().catch(() => null);

      if (res.ok) {
        setAcik(null);
        setGerekce("");
        const ek =
          islem === "activate" && json?.markaAktiflestirildi
            ? ` ${markaAdi} markası da aktif müşteriye çevrildi.`
            : "";
        const uyarilar: string[] = json?.warnings ?? [];
        setMesaj(
          `${contractNo} ${
            islem === "activate" ? "yürürlüğe alındı" : islem === "end" ? "sonlandırıldı" : "iptal edildi"
          }.${ek}${uyarilar.length ? ` ${uyarilar.join(" ")}` : ""}`,
        );
        router.refresh();
        return;
      }

      if (json?.error?.code === "SESSION_STALE") {
        setBekleyen(() => async () => {
          await calistir(islem, neden);
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

  const gerekceUzunluk = gerekce.trim().length;
  const gerekceGecerli = gerekceUzunluk >= 3 && gerekceUzunluk <= 500;
  const gerekceGerekli = acik === "end" || acik === "cancel";
  const markaUygunDegil =
    acik === "activate" && (markaDurumu === "suspended" || markaDurumu === "churned");

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {aktiflestirilebilir && (
          <Button variant="primary" onClick={() => { setAcik("activate"); setHata(null); }}>
            Yürürlüğe al
          </Button>
        )}
        {sonlandirilabilir && (
          <Button onClick={() => { setAcik("end"); setGerekce(""); setHata(null); }}>
            Sonlandır
          </Button>
        )}
        {iptalEdilebilir && (
          <Button
            variant="destructive"
            onClick={() => { setAcik("cancel"); setGerekce(""); setHata(null); }}
          >
            İptal et
          </Button>
        )}
      </div>

      {mesaj && (
        <p role="status" className="mt-3 rounded-sm border-l-2 border-success bg-success-bg px-3 py-2 text-sm text-success">
          {mesaj}
        </p>
      )}
      {hata && !acik && (
        <p role="alert" className="mt-3 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}

      {acik && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-900/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label={BASLIK[acik]}
        >
          <div className="w-full max-w-[460px] rounded-md border border-line-200 bg-surface p-5 shadow-lg">
            <h2 className="mb-1 text-base font-semibold text-ink-900">{BASLIK[acik]}</h2>

            <div className="mb-4 rounded-sm border border-line-200 bg-fill-100 px-3 py-2.5">
              <div className="text-xs text-ink-400">Sözleşme numarası</div>
              <div className="font-mono text-sm text-ink-900">{contractNo}</div>
              <div className="mt-1 text-xs text-ink-400">{markaAdi}</div>
            </div>

            {acik === "activate" && (
              <>
                <ul className="mb-3 space-y-1.5 text-[13px] text-ink-600">
                  <li>· Durum <strong>Taslak</strong> → <strong>Aktif</strong> olur.</li>
                  <li>· Yürürlük tarihi bugün olarak işlenir.</li>
                  <li>· Tutar, tarih ve kalemler bundan sonra değiştirilemez.</li>
                  {baglanacakHizmetler.length > 0 && (
                    <li>
                      · <strong>{baglanacakHizmetler.join(", ")}</strong>{" "}
                      {markaAdi} markasının hizmet listesine eklenir.
                    </li>
                  )}
                </ul>
                {(markaDurumu === "lead" || markaDurumu === "proposal_sent") && (
                  <p className="mb-3 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
                    <strong>{markaAdi}</strong> şu anda aday marka. Sözleşmeyi yürürlüğe
                    aldığınızda marka da <strong>aktif müşteriye</strong> çevrilir.
                  </p>
                )}
                {markaUygunDegil && (
                  <p className="mb-3 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger">
                    <strong>{markaAdi}</strong> markası{" "}
                    {markaDurumu === "suspended" ? "askıda" : "ayrılmış"}. Askıdaki veya
                    ayrılmış markalara yeni yükümlülük yazılamaz. Önce markayı yeniden
                    aktifleştirin.
                  </p>
                )}
                <p className="mb-3 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
                  Bu işlem alacak veya fatura kaydı oluşturmaz.
                </p>
              </>
            )}

            {gerekceGerekli && (
              <div className="mb-1">
                <label htmlFor="soz-gerekce" className="mb-1 block text-sm text-ink-600">
                  {acik === "end" ? "Sonlandırma gerekçesi *" : "İptal gerekçesi *"}
                </label>
                <textarea
                  id="soz-gerekce"
                  autoFocus
                  rows={3}
                  value={gerekce}
                  onChange={(e) => setGerekce(e.target.value)}
                  placeholder="Bu işlemin nedenini yazın…"
                  className="w-full rounded-sm border border-line-300 bg-surface px-3 py-2 text-sm"
                />
                <div className="mt-1 flex justify-between text-xs">
                  <span className={gerekceUzunluk > 0 && !gerekceGecerli ? "text-danger" : "text-ink-400"}>
                    En az 3, en çok 500 karakter.
                  </span>
                  <span className="tabular-nums text-ink-400">{gerekceUzunluk} / 500</span>
                </div>
                <p className="mt-2 text-[13px] text-ink-600">
                  Bu işlem geri alınamaz.
                  {acik === "end" && " Markanın hizmet listesi değişmez."}
                </p>
              </div>
            )}

            {hata && (
              <p role="alert" className="mt-3 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
                {hata}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button onClick={() => { setAcik(null); setHata(null); }}>Vazgeç</Button>
              <Button
                variant={acik === "activate" ? "primary" : "destructive"}
                disabled={bekliyor || (gerekceGerekli && !gerekceGecerli) || markaUygunDegil}
                onClick={() => calistir(acik, gerekce.trim())}
              >
                {bekliyor ? "İşleniyor…" : DUGME[acik]}
              </Button>
            </div>
          </div>
        </div>
      )}

      {stepUpAcik && (
        <StepUpDialog
          onKapat={() => {
            setStepUpAcik(false);
            setBekleyen(null);
            /* Vazgeçilen doğrulama sessizce geçmez: kullanıcı işlemin
               yapılmadığını görmeli. */
            setHata("İşlem yapılmadı: kimlik doğrulaması tamamlanmadı.");
          }}
          onBasarili={async () => {
            setStepUpAcik(false);
            const islev = bekleyen;
            setBekleyen(null);
            if (islev) await islev();
          }}
        />
      )}
    </div>
  );
}
