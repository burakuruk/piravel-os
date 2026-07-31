/**
 * AKTİVASYON ONAYI + STEP-UP — wireframe (Sprint 3 §11.8)
 *
 * Akışın üç durumu tek sayfada, `giris-durumlar` deseniyle sunulur.
 *
 * Tartışmaya açılan kararlar:
 *   · Onay ile kimlik doğrulama AYRI iki adım: onay penceresine parola alanı
 *     gömülürse kullanıcı ne onayladığını okumadan parolayı yazıyor
 *   · Onay penceresi NE OLACAĞINI sayar: durum değişir, marka durumu değişir,
 *     tarih işlenir. "Emin misiniz?" tek başına bilgi vermiyor
 *   · Aktivasyonun alacak kaydı ÜRETMEDİĞİ açıkça yazılır — kullanıcı
 *     "onaylayınca faturalar mı kesilecek" diye tereddüt ediyor
 *   · Aday markada aktivasyon markayı da müşteriye çevirir; bu YAN ETKİ
 *     onaydan önce görünür olmalı
 *   · Uygun olmayan marka durumunda pencere onay değil AÇIKLAMA gösterir ve
 *     birincil düğme bulunmaz — çıkmaz bir onay düğmesi sunulmaz
 */
import { SozlesmeNo, StepUpAlani, TutarSatiri } from "../_sozlesme";
import { Dugme, Rozet } from "../_app-shell";

function Tuval({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-900 px-4 py-8 sm:px-8">
      <h1 className="mb-6 font-display text-xl text-gold-500">{baslik}</h1>
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">{children}</div>
    </div>
  );
}

function Panel({
  label,
  baslik,
  aciklama,
  children,
  eylem,
}: {
  label: string;
  baslik: string;
  aciklama?: string;
  children?: React.ReactNode;
  eylem: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-xs font-medium tracking-widest text-shell-muted">{label}</div>
      <div className="w-full max-w-[440px] rounded-md border border-line-200 bg-surface p-5 shadow-lg">
        <h2 className="mb-1 text-base font-semibold text-ink-900">{baslik}</h2>
        {aciklama && <p className="mb-4 text-sm text-ink-600">{aciklama}</p>}
        {children}
        <div className="mt-5 flex flex-wrap justify-end gap-2">{eylem}</div>
      </div>
    </div>
  );
}

export default function SozlesmeAktivasyonWireframe() {
  return (
    <Tuval baslik="Sözleşmeyi yürürlüğe alma">
      <Panel
        label="1 · ONAY"
        baslik="Sözleşmeyi yürürlüğe al"
        aciklama="Onayladığınızda sözleşme yürürlüğe girer ve bilgileri kilitlenir."
        eylem={
          <>
            <Dugme>Vazgeç</Dugme>
            <Dugme tur="birincil">Yürürlüğe al</Dugme>
          </>
        }
      >
        <div className="rounded-sm border border-line-200 bg-fill-100 px-3 py-2.5">
          <div className="mb-2">
            <SozlesmeNo no="PRV-2026-0002" />
          </div>
          <div className="text-sm text-ink-900">SEO ve içerik üretimi</div>
          <div className="text-xs text-ink-400">Test Klinik · 01.08.2026 – 31.07.2027</div>
          <div className="mt-2 max-w-[300px]">
            <TutarSatiri etiket="Net tutar" deger="18.500,00 ₺" />
            <TutarSatiri etiket="Brüt tutar" deger="22.200,00 ₺" ikincil />
          </div>
        </div>

        <ul className="mt-3 space-y-1.5 text-[13px] text-ink-600">
          <li>· Durum <strong>Taslak</strong> → <strong>Aktif</strong> olur.</li>
          <li>· Yürürlük tarihi bugün olarak işlenir.</li>
          <li>· Tutar, tarih ve kalemler bundan sonra değiştirilemez.</li>
          <li>
            · <strong>Basın ilişkileri</strong> hizmeti <strong>Test Klinik</strong>{" "}
            markasının hizmet listesine eklenir.
          </li>
        </ul>

        <p className="mt-3 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
          Bu işlem alacak veya fatura kaydı oluşturmaz. Vade takvimini “Ödeme
          planını gör” ile inceleyebilirsiniz.
        </p>
      </Panel>

      <Panel
        label="2 · KİMLİK DOĞRULAMA"
        baslik="Kimliğinizi doğrulayın"
        aciklama="Bu işlem hassastır. Devam etmek için parolanızı ve doğrulama kodunuzu girin."
        eylem={
          <>
            <Dugme>Vazgeç</Dugme>
            <Dugme tur="birincil">Doğrula ve yürürlüğe al</Dugme>
          </>
        }
      >
        <StepUpAlani />
      </Panel>

      <Panel
        label="ADAY MARKA — YAN ETKİ UYARISI"
        baslik="Sözleşmeyi yürürlüğe al"
        aciklama="Bu markanın durumu da değişecek."
        eylem={
          <>
            <Dugme>Vazgeç</Dugme>
            <Dugme tur="birincil">Yürürlüğe al</Dugme>
          </>
        }
      >
        <div className="rounded-sm border border-line-200 bg-fill-100 px-3 py-2.5">
          <div className="mb-2">
            <SozlesmeNo no="PRV-2026-0003" />
          </div>
          <div className="text-sm text-ink-900">Lansman kampanyası</div>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            Sahte Ajans <Rozet ton="info">Aday</Rozet>
          </div>
        </div>

        <p className="mt-3 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
          <strong>Sahte Ajans</strong> şu anda aday marka. Sözleşmeyi yürürlüğe
          aldığınızda marka da <strong>Aktif</strong> müşteriye çevrilir.
        </p>
      </Panel>

      <Panel
        label="UYGUN OLMAYAN MARKA — İŞLEM YAPILAMAZ"
        baslik="Bu sözleşme yürürlüğe alınamaz"
        eylem={<Dugme>Kapat</Dugme>}
      >
        <div className="rounded-sm border border-line-200 bg-fill-100 px-3 py-2.5">
          <div className="mb-2">
            <SozlesmeNo no="PRV-2026-0006" />
          </div>
          <div className="text-sm text-ink-900">Yıllık bakım</div>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            Örnek Mimarlık <Rozet ton="warning">Askıda</Rozet>
          </div>
        </div>

        <p className="mt-3 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger">
          <strong>Örnek Mimarlık</strong> markası askıda. Askıdaki veya ayrılmış
          markalara yeni yükümlülük yazılamaz. Önce markayı yeniden aktifleştirin.
        </p>
      </Panel>
    </Tuval>
  );
}
