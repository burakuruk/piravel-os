/**
 * SÖZLEŞME LİSTESİ — BOŞ VE FİLTRELİ DURUMLAR — wireframe (Sprint 3 §11.11)
 *
 * Üç durum tek sayfada, üstten alta:
 *   1. Filtre uygulanmış liste (etkin filtreler rozet olarak görünür)
 *   2. Filtre sonucu boş (filtreyi temizleme yolu gösterilir)
 *   3. Hiç sözleşme yok (ilk kullanım — birincil eylem öne çıkar)
 *
 * Tartışmaya açılan kararlar:
 *   · İKİ FARKLI BOŞLUK aynı şey değil: "filtren bir şey bulmadı" ile "burada
 *     hiç kayıt yok" farklı cümleler ve farklı çıkış yolları ister. Tek bir
 *     "Kayıt bulunamadı" metni kullanıcıyı filtrede kilitli bırakıyor
 *   · Etkin filtreler ROZET olarak listelenir ve tek tek kaldırılabilir;
 *     kullanıcı hangi filtrenin sonucu daralttığını görmeden temizleyemiyor
 *   · Boş durumda CSV düğmesi gösterilmez — boş dosya indirmek bir çıktı değil
 */
import { Dugme, Rozet } from "../_app-shell";
import { SAHTE_SOZLESMELER } from "../_sozlesme";

function Bolum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-2 text-xs font-medium tracking-widest text-ink-400">{label}</div>
      <div className="rounded-md border border-line-200 bg-surface p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Kaldırılabilir filtre rozeti. */
function FiltreRozeti({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line-300 bg-fill-100 px-2 text-xs text-ink-600">
      {children}
      <span className="text-ink-400" aria-hidden="true">
        ×
      </span>
    </span>
  );
}

export default function SozlesmeListeDurumlarWireframe() {
  const filtreli = SAHTE_SOZLESMELER.filter((s) => s.durum === "Aktif");

  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[960px] space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            Sözleşme listesi — boş ve filtreli durumlar
          </h1>
          <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        </div>

        <Bolum label="1 · FİLTRE UYGULANMIŞ LİSTE">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-400">Etkin filtreler:</span>
            <FiltreRozeti>Durum: Aktif</FiltreRozeti>
            <FiltreRozeti>Marka: Sahte Vize A.Ş.</FiltreRozeti>
            <span className="text-xs text-navy-500 underline">Tümünü temizle</span>
          </div>

          <div className="space-y-2">
            {filtreli.map((s) => (
              <div
                key={s.no}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-sm border border-line-200 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-ink-400">{s.no}</div>
                  <div className="truncate text-sm text-ink-900">{s.baslik}</div>
                  <div className="truncate text-xs text-ink-400">{s.marka}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums text-ink-900">{s.tutar}</span>
                  <Rozet ton={s.ton}>{s.durum}</Rozet>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-400">
            5 sözleşmeden 1’i gösteriliyor · 2 filtre etkin
          </p>
        </Bolum>

        <Bolum label="2 · FİLTRE SONUCU BOŞ">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-400">Etkin filtreler:</span>
            <FiltreRozeti>Durum: İptal</FiltreRozeti>
            <FiltreRozeti>Marka: Test Klinik</FiltreRozeti>
            <FiltreRozeti>Arama: “bakım”</FiltreRozeti>
          </div>

          <div className="rounded-sm border border-dashed border-line-300 px-4 py-10 text-center">
            <p className="text-sm text-ink-900">Bu filtrelerle eşleşen sözleşme yok.</p>
            <p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-400">
              Arama sözcüğünü kısaltmayı ya da durum ve marka filtrelerini
              gevşetmeyi deneyin.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Dugme>Filtreleri temizle</Dugme>
            </div>
          </div>
        </Bolum>

        <Bolum label="3 · HİÇ SÖZLEŞME YOK (İLK KULLANIM)">
          <div className="rounded-sm border border-dashed border-line-300 px-4 py-12 text-center">
            <p className="text-base font-medium text-ink-900">Henüz sözleşme yok.</p>
            <p className="mx-auto mt-1 max-w-[52ch] text-sm text-ink-400">
              Bir markayla anlaştığınızda sözleşmeyi buradan oluşturursunuz. Sözleşme
              önce taslak olarak kaydedilir; hazır olduğunda yürürlüğe alırsınız.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Dugme tur="birincil">Yeni sözleşme</Dugme>
            </div>
          </div>
        </Bolum>
      </div>
    </div>
  );
}
