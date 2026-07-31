/**
 * OPS SALT OKUMA GÖRÜNÜMÜ — wireframe (Sprint 3 §11.12)
 *
 * ⚠ Bu ekranda TUTAR, KDV, KUR, İNDİRİM ve ÖDEME/FATURALAMA bilgisi HİÇ
 * BULUNMAZ — gizlenmez, maskelenmez, "•••" ile örtülmez: hiç yoktur.
 * Maskelenmiş bir alan bile "burada bir rakam var" bilgisini sızdırır ve
 * kullanıcıya erişemeyeceği bir şeyi işaret eder.
 *
 * Tartışmaya açılan kararlar:
 *   · OPS yalnız ATANDIĞI markaların sözleşmelerini görür; liste zaten kapsam
 *     içinde gelir, ayrı bir "yetkim yok" satırı gösterilmez
 *   · Yazma eylemi YOK: "Yeni sözleşme", "Düzenle", "Sonlandır", "İptal",
 *     "Ödeme planını gör" ve "CSV indir" düğmeleri hiç çizilmez. Pasif
 *     görünen bir düğme, kullanıcıyı olmayan bir yetkiye özendirir
 *   · Kalem listesi kapsamı gösterir ama FİYAT SÜTUNU YOKTUR: operasyon
 *     "ne yapacağım" bilgisine ihtiyaç duyar, "kaça" bilgisine değil
 *   · Finansal alanların yokluğu tek, sakin bir cümleyle açıklanır — kullanıcı
 *     eksik bir ekran gördüğünü sanmasın
 */
import { AppWire, Bilgi, Kart, Rozet } from "../_app-shell";
import { SAHTE_KALEMLER, SozlesmeNo } from "../_sozlesme";

/** OPS kapsamındaki sözleşmeler — yalnız Sahte Vize A.Ş. atanmış. */
const KAPSAM = [
  {
    no: "PRV-2026-0001",
    baslik: "Sosyal medya yönetimi 2026",
    marka: "Sahte Vize A.Ş.",
    baslangic: "01.04.2026",
    bitis: "31.03.2027",
    durum: "Aktif",
    ton: "success",
  },
  {
    no: "PRV-2026-0005",
    baslik: "Web sitesi yenileme",
    marka: "Sahte Vize A.Ş.",
    baslangic: "01.05.2026",
    bitis: "—",
    durum: "İptal",
    ton: "warning",
  },
];

export default function SozlesmeOpsWireframe() {
  return (
    <AppWire
      baslik="Sözleşmeler"
      aciklama="Atandığınız markaların sözleşmeleri."
      aktif="Sözleşmeler"
    >
      {/* Arama + filtre var; dışa aktarma ve oluşturma YOK */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-9 min-w-[240px] flex-1 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-400">
          Sözleşme numarası veya başlıkta ara…
        </span>
        <span className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-600">
          Durum: Tümü ▾
        </span>
      </div>

      {/* ── Mobil: kart listesi ── */}
      <div className="space-y-3 lg:hidden">
        {KAPSAM.map((s) => (
          <a
            key={s.no}
            href={`/sozlesmeler/${s.no}`}
            className="block rounded-md border border-line-200 bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-ink-400">{s.no}</div>
                <div className="mt-0.5 truncate text-[15px] font-medium text-ink-900">
                  {s.baslik}
                </div>
                <div className="truncate text-xs text-ink-400">{s.marka}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Rozet ton={s.ton}>{s.durum}</Rozet>
                <span className="text-lg leading-none text-ink-400">›</span>
              </div>
            </div>
            <dl className="mt-3 text-sm">
              <dt className="text-xs text-ink-400">Dönem</dt>
              <dd className="text-ink-600">
                {s.baslangic} – {s.bitis}
              </dd>
            </dl>
          </a>
        ))}
      </div>

      {/* ── Masaüstü: tablo — tutar ve faturalama sütunu YOK ── */}
      <div className="hidden rounded-md border border-line-200 bg-surface lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
              <th className="px-4 py-3 font-medium">NUMARA</th>
              <th className="px-4 py-3 font-medium">MARKA</th>
              <th className="px-4 py-3 font-medium">BAŞLIK</th>
              <th className="px-4 py-3 font-medium">DÖNEM</th>
              <th className="px-4 py-3 font-medium">DURUM</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {KAPSAM.map((s) => (
              <tr key={s.no} className="border-b border-line-200 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-ink-600">{s.no}</td>
                <td className="px-4 py-3 text-ink-600">{s.marka}</td>
                <td className="px-4 py-3 text-ink-900">{s.baslik}</td>
                <td className="px-4 py-3 tabular-nums text-ink-600">
                  {s.baslangic} – {s.bitis}
                </td>
                <td className="px-4 py-3">
                  <Rozet ton={s.ton}>{s.durum}</Rozet>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-navy-500 underline">Detay</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-400">2 sözleşme · yalnız atandığınız markalar</p>

      {/* ── Aynı sayfada: OPS detay görünümü ── */}
      <div className="mt-8">
        <div className="mb-2 text-xs font-medium tracking-widest text-ink-400">
          DETAY GÖRÜNÜMÜ
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Kart baslik="Sosyal medya yönetimi 2026">
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <SozlesmeNo no="PRV-2026-0001" />
                <Rozet ton="success">Aktif</Rozet>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Bilgi etiket="Marka" deger="Sahte Vize A.Ş." />
                <Bilgi etiket="Sorumlu" deger="Sahte Yönetici" />
                <Bilgi etiket="Başlangıç" deger="01.04.2026" />
                <Bilgi etiket="Bitiş" deger="31.03.2027" />
              </dl>
            </Kart>

            {/* Kapsam: ne yapılacağı — fiyat sütunu yok */}
            <Kart baslik="Kapsam kalemleri">
              <div className="space-y-2.5">
                {SAHTE_KALEMLER.map((k) => (
                  <div
                    key={k.kod}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-200 pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <span className="mr-2 font-mono text-xs text-ink-400">{k.kod}</span>
                      <span className="text-sm text-ink-900">{k.ad}</span>
                    </div>
                    <span className="shrink-0 text-sm text-ink-600">
                      {k.miktar} × {k.donem}
                    </span>
                  </div>
                ))}
              </div>
            </Kart>
          </div>

          <div className="space-y-4">
            <Kart baslik="Sorumlu ekip">
              <div className="space-y-2 text-sm">
                {[
                  ["Sahte Operasyon", "Operasyon"],
                  ["Örnek Operasyon", "Operasyon"],
                ].map(([ad, rol]) => (
                  <div key={ad}>
                    <div className="text-ink-900">{ad}</div>
                    <div className="text-xs text-ink-400">{rol}</div>
                  </div>
                ))}
              </div>
            </Kart>

            <Kart baslik="Notlar">
              <p className="text-sm text-ink-600">
                Görsel üretimi ayrı teklif edilecek.
              </p>
            </Kart>

            <p className="rounded-sm bg-fill-100 px-3 py-2.5 text-xs text-ink-400">
              Sözleşmelerin finansal bilgileri rolünüz kapsamında değildir ve bu
              ekranda yer almaz.
            </p>
          </div>
        </div>
      </div>
    </AppWire>
  );
}
