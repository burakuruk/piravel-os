/**
 * MARKAYA TANIMLI OLMAYAN HİZMETİN AKTİVASYON ETKİSİ — wireframe (REVİZE 3)
 *
 * Tartışmaya açılan kararlar:
 *   · Taslakta uyarı YETMİYOR: kullanıcı "ekleyebilirsiniz" görüp geçiyor,
 *     sonra markanın hizmet listesinde o hizmeti bulamıyor. Aktivasyon
 *     penceresi tam olarak NE OLACAĞINI kalem kalem sayar
 *   · Üç durum ayrı satır olarak gösterilir — "eklenecek", "zaten var",
 *     "pasif, eklenmeyecek". Tek bir toplu cümle hangi hizmetin ne olacağını
 *     söylemiyor
 *   · PASİF hizmet aktivasyonu ENGELLEMEZ: sözleşme imzalanmış, kalem
 *     snapshot'ı duruyor. Yalnız markaya bağlanmaz ve bu açıkça yazılır
 *   · SONLANDIRMA VE İPTAL hizmet bağlantısını KALDIRMAZ. Marka o hizmeti
 *     başka sözleşmeyle alıyor ya da operasyonel olarak kullanıyor olabilir;
 *     sessiz kaldırma veri kaybıdır. Onay penceresi bunu da yazar
 */
import { Dugme, Kart, Rozet } from "../_app-shell";
import { GerekceAlani, SozlesmeNo } from "../_sozlesme";

function Tuval({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[1000px]">
        <h1 className="font-display text-2xl font-semibold text-ink-900">{baslik}</h1>
        <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        <div className="mt-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}

function Durum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-xs font-medium tracking-widest text-ink-400">{label}</div>
      {children}
    </div>
  );
}

/** Pencere gövdesi — sayfa akışı içinde, kart görünümünde. */
function Pencere({
  baslik,
  aciklama,
  children,
  eylem,
}: {
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
  eylem: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[520px] rounded-md border border-line-200 bg-surface p-5 shadow-lg">
      <h2 className="mb-1 text-base font-semibold text-ink-900">{baslik}</h2>
      {aciklama && <p className="mb-4 text-sm text-ink-600">{aciklama}</p>}
      {children}
      <div className="mt-5 flex flex-wrap justify-end gap-2">{eylem}</div>
    </div>
  );
}

/** Aktivasyonda bir hizmetin başına ne geleceğini anlatan satır. */
function HizmetSatiri({
  kod,
  ad,
  sonuc,
  ton,
  not,
}: {
  kod: string;
  ad: string;
  sonuc: string;
  ton: string;
  not?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-line-200 py-2.5 last:border-0">
      <div className="min-w-0">
        <span className="mr-2 font-mono text-xs text-ink-400">{kod}</span>
        <span className="text-sm text-ink-900">{ad}</span>
        {not && <div className="text-xs text-ink-400">{not}</div>}
      </div>
      <Rozet ton={ton}>{sonuc}</Rozet>
    </div>
  );
}

export default function SozlesmeHizmetBaglamaWireframe() {
  return (
    <Tuval baslik="Markaya tanımlı olmayan hizmet — aktivasyon etkisi">
      <Durum label="1 · TASLAKTA KALEM UYARISI">
        <Kart baslik="Kapsam kalemleri">
          <div className="rounded-sm border border-line-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="mr-2 font-mono text-xs text-ink-400">PR</span>
                <span className="text-sm text-ink-900">Basın ilişkileri</span>
              </div>
              <span className="text-sm tabular-nums text-ink-900">7.000,00 ₺</span>
            </div>
            <p className="mt-2 rounded-sm border-l-2 border-warning bg-warning-bg px-2.5 py-1.5 text-xs text-warning">
              Bu hizmet bu markaya tanımlı değil. Ekleyebilirsiniz; sözleşmeyi
              yürürlüğe aldığınızda hizmet markanın listesine de eklenir.
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Markaya tanımlı olmayan bir hizmet seçmek engellenmez — yeni iş çoğu zaman
            böyle başlar. Bağlama işi, sözleşme gerçekten yürürlüğe girdiğinde yapılır.
          </p>
        </Kart>
      </Durum>

      <Durum label="2 · AKTİVASYON ONAYI — NE OLACAĞI KALEM KALEM">
        <Pencere
          baslik="Sözleşmeyi yürürlüğe al"
          aciklama="Onayladığınızda markanın hizmet listesi de güncellenecek."
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
            <div className="text-xs text-ink-400">Test Klinik</div>
          </div>

          <div className="mt-4">
            <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">
              MARKANIN HİZMET LİSTESİ
            </div>
            <HizmetSatiri
              kod="SEO"
              ad="Arama motoru optimizasyonu"
              sonuc="Zaten tanımlı"
              ton="muted"
              not="Değişiklik olmayacak"
            />
            <HizmetSatiri
              kod="PR"
              ad="Basın ilişkileri"
              sonuc="Eklenecek"
              ton="success"
              not="Markaya tanımlı değil"
            />
            <HizmetSatiri
              kod="PROD"
              ad="İçerik prodüksiyon"
              sonuc="Eklenmeyecek"
              ton="warning"
              not="Katalogda pasifleştirilmiş"
            />
          </div>

          <p className="mt-3 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
            Pasif hizmet aktivasyonu engellemez; sözleşmedeki kalem olduğu gibi kalır,
            yalnız markanın hizmet listesine eklenmez.
          </p>
        </Pencere>
      </Durum>

      <Durum label="3 · AKTİVASYON SONRASI — MARKA EKRANI">
        <Kart baslik="Alınan hizmetler" eylem={<span className="text-sm text-ink-400">Test Klinik</span>}>
          <div className="flex flex-wrap gap-2">
            <Rozet ton="success">Arama motoru optimizasyonu</Rozet>
            <Rozet ton="success">Basın ilişkileri</Rozet>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            “Basın ilişkileri” PRV-2026-0002 numaralı sözleşme yürürlüğe alındığında
            eklendi. Hizmeti listeden çıkarmak için bu ekrandaki kaldırma işlemini
            kullanın.
          </p>
        </Kart>
      </Durum>

      <Durum label="4 · SONLANDIRMA — HİZMET LİSTESİ DEĞİŞMEZ">
        <Pencere
          baslik="Sözleşmeyi sonlandır"
          aciklama="Sözleşme bugün itibarıyla yürürlükten kalkar ve salt okunur olur."
          eylem={
            <>
              <Dugme>Vazgeç</Dugme>
              <Dugme tur="yikici">Sonlandır</Dugme>
            </>
          }
        >
          <div className="mb-4 rounded-sm border border-line-200 bg-fill-100 px-3 py-2.5">
            <div className="mb-2">
              <SozlesmeNo no="PRV-2026-0002" />
            </div>
            <div className="text-sm text-ink-900">SEO ve içerik üretimi</div>
            <div className="text-xs text-ink-400">Test Klinik</div>
          </div>

          <GerekceAlani
            etiket="Sonlandırma gerekçesi *"
            deger="Müşteri kapsamı küçülttü; yeni sözleşme hazırlanacak."
            sayac="56 / 500"
          />

          <p className="mt-3 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
            Markanın hizmet listesi <strong>değişmez</strong>. Bu hizmetler başka bir
            sözleşmede veya operasyonda kullanılıyor olabilir; kaldırmak isterseniz
            marka ekranından tek tek yapabilirsiniz.
          </p>
        </Pencere>
      </Durum>
    </Tuval>
  );
}
