/**
 * KAPSAM KALEMLERİ DÜZENLEME — wireframe (Sprint 3 §11.7), TASLAK sözleşme
 *
 * Tartışmaya açılan kararlar:
 *   · Kalemler yalnız TASLAK sözleşmede düzenlenir; ekran bu yüzden taslak
 *     durumunda gösterilir
 *   · Kalem katalogdan seçilir ama ADI ve FİYATI o an KOPYALANIR: katalogda
 *     sonradan yapılan değişiklik imzalanmış sözleşmeyi geriye dönük
 *     değiştirmemeli. Kullanıcıya bu "bu sözleşmeye kopyalandı" diliyle
 *     anlatılır, teknik gerekçeyle değil
 *   · Uyuşmazlık KAYDI ENGELLEMEZ, uyarır: gerçek hayatta pazarlık sonucu
 *     toplam ile kalemler tutmayabilir
 *   · Markaya bağlı olmayan hizmet engellenmez, satır içinde uyarılır
 *   · Pasif hizmet listede seçilemez
 *   · MOBİLDE satırlar kart olur: yedi kolonlu düzenleme tablosu 375 px'e
 *     sığmaz ve yatay kaydırma form doldurmayı imkânsız kılar
 */
import { AppWire, Dugme, Kart, Rozet } from "../_app-shell";
import { SozlesmeNo, TutarSatiri } from "../_sozlesme";

/** Düzenleme sırasındaki kalemler — PR kalemi 6.000 → 7.000 yapılmış hâli. */
const KALEMLER = [
  { kod: "SM", ad: "Sosyal medya yönetimi", miktar: "1", birim: "Aylık", fiyat: "30.000,00", toplam: "30.000,00 ₺", uyari: null },
  { kod: "SEO", ad: "Arama motoru optimizasyonu", miktar: "1", birim: "Aylık", fiyat: "10.000,00", toplam: "10.000,00 ₺", uyari: null },
  { kod: "PR", ad: "Basın ilişkileri", miktar: "1", birim: "Aylık", fiyat: "7.000,00", toplam: "7.000,00 ₺", uyari: "Bu hizmet bu markaya tanımlı değil. Ekleyebilirsiniz; sözleşmeyi yürürlüğe aldığınızda hizmet markanın listesine de eklenir." },
];

/** Küçük, satır içi düzenleme kutusu. */
function Kutu({ deger, sag, genislik }: { deger: string; sag?: boolean; genislik?: string }) {
  return (
    <div
      className={`flex h-9 items-center rounded-sm border border-line-300 bg-surface px-2.5 text-sm text-ink-900 ${
        sag ? "justify-end tabular-nums" : ""
      } ${genislik ?? ""}`}
    >
      {deger}
    </div>
  );
}

export default function SozlesmeKalemlerWireframe() {
  return (
    <AppWire
      baslik="Kapsam kalemleri"
      aciklama="SEO ve içerik üretimi · Test Klinik"
      aktif="Sözleşmeler"
    >
      <div className="max-w-[900px] space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SozlesmeNo no="PRV-2026-0002" />
          <Rozet ton="muted">Taslak</Rozet>
        </div>

        <Kart baslik="Kalemler" eylem={<span className="text-sm text-navy-500 underline">+ Kalem ekle</span>}>
          {/* ── Mobil: kart düzeni ── */}
          <div className="space-y-3 lg:hidden">
            {KALEMLER.map((k) => (
              <div key={k.kod} className="rounded-sm border border-line-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-ink-400">{k.kod}</span>
                  <span className="text-xs text-danger underline">Kaldır</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 text-xs text-ink-400">Hizmet</div>
                    <Kutu deger={`${k.ad} ▾`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-1 text-xs text-ink-400">Miktar</div>
                      <Kutu deger={k.miktar} sag />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-ink-400">Dönem</div>
                      <Kutu deger={`${k.birim} ▾`} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-ink-400">Birim fiyat (₺)</div>
                    <Kutu deger={k.fiyat} sag />
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs text-ink-400">Satır toplamı</span>
                    <span className="text-sm font-medium tabular-nums text-ink-900">{k.toplam}</span>
                  </div>
                </div>
                {k.uyari && (
                  <p className="mt-2 rounded-sm border-l-2 border-warning bg-warning-bg px-2.5 py-1.5 text-xs text-warning">
                    {k.uyari}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* ── Masaüstü: düzenleme tablosu ── */}
          <div className="hidden lg:block">
            <div className="mb-2 grid grid-cols-[1fr_88px_120px_140px_120px_64px] gap-3 text-xs tracking-wide text-ink-400">
              <span>HİZMET</span>
              <span className="text-right">MİKTAR</span>
              <span>DÖNEM</span>
              <span className="text-right">BİRİM FİYAT (₺)</span>
              <span className="text-right">TOPLAM</span>
              <span />
            </div>
            <div className="space-y-2">
              {KALEMLER.map((k) => (
                <div key={k.kod}>
                  <div className="grid grid-cols-[1fr_88px_120px_140px_120px_64px] items-center gap-3">
                    <Kutu deger={`${k.kod} · ${k.ad} ▾`} />
                    <Kutu deger={k.miktar} sag />
                    <Kutu deger={`${k.birim} ▾`} />
                    <Kutu deger={k.fiyat} sag />
                    <span className="text-right text-sm tabular-nums text-ink-900">{k.toplam}</span>
                    <span className="text-right text-sm text-danger underline">Kaldır</span>
                  </div>
                  {k.uyari && (
                    <p className="mt-1.5 rounded-sm border-l-2 border-warning bg-warning-bg px-2.5 py-1.5 text-xs text-warning">
                      {k.uyari}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs text-ink-400">
            Hizmet katalogdan seçilir. Seçtiğiniz anda hizmetin adı ve fiyatı bu
            sözleşmeye kopyalanır; katalogda sonradan yapılan değişiklik bu sözleşmeyi
            etkilemez. Pasif hizmetler listede çıkmaz.
          </p>
          <p className="mt-2 text-xs text-ink-400">
            Markaya tanımlı olmayan bir hizmet seçebilirsiniz. Sözleşme yürürlüğe
            girdiğinde bu hizmetler markanın hizmet listesine eklenir; sözleşme daha
            sonra sonlansa da orada kalır.
          </p>
        </Kart>

        <Kart baslik="Toplam">
          <div className="max-w-[380px]">
            <TutarSatiri etiket="Kalem toplamı" deger="47.000,00 ₺" />
            <TutarSatiri etiket="İndirim" deger="−1.000,00 ₺" ikincil />
            <TutarSatiri etiket="Kalemlerden beklenen net" deger="46.000,00 ₺" />
            <TutarSatiri etiket="Sözleşmeye yazılı net" deger="45.000,00 ₺" vurgu />
          </div>

          <div className="mt-4 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
            Kalemlerden beklenen net tutar, sözleşmeye yazılı tutardan{" "}
            <strong className="tabular-nums">1.000,00 ₺</strong> fazla. Kaydedebilirsiniz;
            yalnız dikkatinizi çekmek için gösteriliyor.
          </div>
        </Kart>

        <div className="flex flex-wrap justify-end gap-2">
          <Dugme>Vazgeç</Dugme>
          <Dugme tur="birincil">Kalemleri kaydet</Dugme>
        </div>
      </div>
    </AppWire>
  );
}
