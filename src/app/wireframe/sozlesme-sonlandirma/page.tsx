/**
 * SONLANDIRMA VE İPTAL ONAYI — wireframe (Sprint 3 §11.9)
 *
 * Tartışmaya açılan kararlar:
 *   · SONLANDIRMA ile İPTAL ayrı işlemler ve dili ayrı: sonlandırma yürürlükte
 *     kalmış bir sözleşmeyi bitirir, iptal ise "bu sözleşme hiç yürümedi/
 *     yürümeyecek" der. İkisi tek düğmede toplanırsa geçmiş okunamaz hâle gelir
 *   · GEREKÇE HER İKİSİNDE DE ZORUNLU ve serbest metin: aylar sonra "neden
 *     bitti" sorusunun tek cevabı bu alan olacak
 *   · TASLAK İPTALİ DE onay ve kimlik doğrulaması ister — numara verilmiş bir
 *     belge iz bırakmadan yok edilmemeli
 *   · Eksik gerekçe satır içinde ve alanın yanında uyarır; birincil düğme
 *     pasif kalır
 *   · İşlemin geri alınamadığı, onaydan ÖNCE yazılır
 */
import { Dugme, Rozet } from "../_app-shell";
import { GerekceAlani, SozlesmeNo, StepUpAlani } from "../_sozlesme";

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

function Kunye({
  no,
  baslik,
  alt,
  durum,
  ton,
}: {
  no: string;
  baslik: string;
  alt: string;
  durum: string;
  ton: string;
}) {
  return (
    <div className="mb-4 rounded-sm border border-line-200 bg-fill-100 px-3 py-2.5">
      <div className="mb-2">
        <SozlesmeNo no={no} />
      </div>
      <div className="text-sm text-ink-900">{baslik}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        {alt} <Rozet ton={ton}>{durum}</Rozet>
      </div>
    </div>
  );
}

export default function SozlesmeSonlandirmaWireframe() {
  return (
    <Tuval baslik="Sonlandırma ve iptal">
      <Panel
        label="SONLANDIRMA — AKTİF SÖZLEŞME"
        baslik="Sözleşmeyi sonlandır"
        aciklama="Sözleşme bugün itibarıyla yürürlükten kalkar ve salt okunur olur."
        eylem={
          <>
            <Dugme>Vazgeç</Dugme>
            <Dugme tur="yikici">Sonlandır</Dugme>
          </>
        }
      >
        <Kunye
          no="PRV-2026-0001"
          baslik="Sosyal medya yönetimi 2026"
          alt="Sahte Vize A.Ş."
          durum="Aktif"
          ton="success"
        />
        <GerekceAlani
          etiket="Sonlandırma gerekçesi *"
          deger="Müşteri hizmet kapsamını küçülttü; yeni sözleşme hazırlanacak."
          sayac="62 / 500"
        />
        <p className="mt-3 text-[13px] text-ink-600">
          Bu işlem geri alınamaz. Sonlandırılan sözleşme düzenlenemez.
        </p>
      </Panel>

      <Panel
        label="SONLANDIRMA — GEREKÇE EKSİK"
        baslik="Sözleşmeyi sonlandır"
        aciklama="Sözleşme bugün itibarıyla yürürlükten kalkar ve salt okunur olur."
        eylem={
          <>
            <Dugme>Vazgeç</Dugme>
            <span className="inline-flex h-9 items-center rounded-sm bg-fill-100 px-4 text-sm font-medium text-ink-400">
              Sonlandır
            </span>
          </>
        }
      >
        <Kunye
          no="PRV-2026-0001"
          baslik="Sosyal medya yönetimi 2026"
          alt="Sahte Vize A.Ş."
          durum="Aktif"
          ton="success"
        />
        <GerekceAlani
          etiket="Sonlandırma gerekçesi *"
          sayac="0 / 500"
          hata="Gerekçe zorunludur; en az 3 karakter yazın."
        />
      </Panel>

      <Panel
        label="İPTAL — AKTİF SÖZLEŞME"
        baslik="Sözleşmeyi iptal et"
        aciklama="İptal, sözleşmenin hükümsüz sayıldığını kaydeder."
        eylem={
          <>
            <Dugme>Vazgeç</Dugme>
            <Dugme tur="yikici">İptal et</Dugme>
          </>
        }
      >
        <Kunye
          no="PRV-2026-0005"
          baslik="Web sitesi yenileme"
          alt="Sahte Vize A.Ş."
          durum="Aktif"
          ton="success"
        />
        <GerekceAlani
          etiket="İptal gerekçesi *"
          deger="Karşılıklı mutabakatla feshedildi; hiçbir hizmet verilmedi."
          sayac="58 / 500"
        />
        <p className="mt-3 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
          Sözleşme yürürlükte olduğu için “Sonlandır” çoğu durumda daha doğru
          seçimdir. İptal, sözleşmenin baştan hükümsüz sayıldığı hâller içindir.
        </p>
      </Panel>

      <Panel
        label="İPTAL — TASLAK (KİMLİK DOĞRULAMA GEREKİR)"
        baslik="Kimliğinizi doğrulayın"
        aciklama="Taslak iptali de kalıcı bir kayıttır. Devam etmek için parolanızı ve doğrulama kodunuzu girin."
        eylem={
          <>
            <Dugme>Vazgeç</Dugme>
            <Dugme tur="birincil">Doğrula ve iptal et</Dugme>
          </>
        }
      >
        <Kunye
          no="PRV-2026-0003"
          baslik="Lansman kampanyası"
          alt="Sahte Ajans"
          durum="Taslak"
          ton="muted"
        />
        <StepUpAlani />
        <p className="mt-3 text-[13px] text-ink-600">
          Numara <span className="font-mono">PRV-2026-0003</span> iptal edilse de
          başka bir sözleşmeye verilmez.
        </p>
      </Panel>
    </Tuval>
  );
}
