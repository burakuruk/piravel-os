/**
 * MARKA LİSTESİ — wireframe (Sprint 2 §1)
 *
 * Tartışmaya açılan kararlar:
 *   · Arama tek kutuda: ad VE kod üzerinde çalışır
 *   · Filtreler satır içinde (durum, sektör) — ayrı bir panel açılmaz
 *   · CSV dışa aktarma listenin O ANKİ filtresini dışa aktarır
 *   · Yetkili ve hizmet sayısı listede: "hangi marka boşta" sorusu için
 *   · OPS yalnız ATANDIĞI markaları görür (API katmanında zorlanır)
 *   · MOBİLDE tablo değil KART düzeni: 375 px'te sekiz sütunlu tablo ya yatay
 *     kayar ya da sütun gizler; ikisi de bilgi kaybı. Kartta listedeki her
 *     alan (kod, ad, durum, sektör, birincil yetkili, hizmet, ekip) durur.
 *   · Kartın tamamı TEK bir <a>: chevron + ayrı "Detay" bağlantısı aynı işi
 *     iki kez yapıyordu. Gerçek bağlantı kullanılır ki klavye ve ekran
 *     okuyucu çalışsın; salt `onClick` erişilebilir değildir.
 */
import { AppWire, Dugme, Rozet, SAHTE_MARKALAR } from "../_app-shell";

export default function MarkaListesiWireframe() {
  return (
    <AppWire
      baslik="Markalar"
      aciklama="Müşteri markaları, yetkilileri ve aldıkları hizmetler."
      ustEylem={<Dugme tur="birincil">Yeni marka</Dugme>}
    >
      {/* Arama + filtreler + dışa aktarma */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-9 flex-1 min-w-[240px] items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-400">
          Marka adı veya kodunda ara…
        </span>
        <span className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-600">
          Durum: Tümü ▾
        </span>
        <span className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-600">
          Sektör: Tümü ▾
        </span>
        <Dugme>CSV indir</Dugme>
      </div>

      {/* ── Mobil: kart listesi (lg altında) ── */}
      <div className="space-y-3 lg:hidden">
        {SAHTE_MARKALAR.map((m) => (
          /*
            Kartın TAMAMI tek bir bağlantıdır: chevron ile ayrı bir "Detay"
            bağlantısı aynı işi iki kez yapıyordu. Gerçek <a> kullanılır —
            yalnız onClick klavyeyle ve ekran okuyucuyla erişilemez olurdu.
          */
          <a
            key={m.kod}
            href={`/markalar/${m.kod}`}
            className="block rounded-md border border-line-200 bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-ink-400">{m.kod}</div>
                <div className="mt-0.5 truncate text-[15px] font-medium text-ink-900">{m.ad}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Rozet ton={m.ton}>{m.durum}</Rozet>
                <span className="text-lg leading-none text-ink-400">›</span>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="col-span-2">
                <dt className="text-xs text-ink-400">Sektör</dt>
                <dd className="text-ink-600">{m.sektor}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-ink-400">Birincil yetkili</dt>
                <dd className="text-ink-600">{m.yetkili}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Hizmet</dt>
                <dd className="tabular-nums text-ink-600">{m.hizmet}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Atanan ekip</dt>
                <dd className="tabular-nums text-ink-600">{m.ekip}</dd>
              </div>
            </dl>
          </a>
        ))}
      </div>

      {/* ── Masaüstü: tablo (md ve üstü) ── */}
      <div className="hidden rounded-md border border-line-200 bg-surface lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
              <th className="px-4 py-3 font-medium">KOD</th>
              <th className="px-4 py-3 font-medium">MARKA</th>
              <th className="px-4 py-3 font-medium">SEKTÖR</th>
              <th className="px-4 py-3 font-medium">BİRİNCİL YETKİLİ</th>
              <th className="px-4 py-3 text-right font-medium">HİZMET</th>
              <th className="px-4 py-3 text-right font-medium">EKİP</th>
              <th className="px-4 py-3 font-medium">DURUM</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {SAHTE_MARKALAR.map((m) => (
              <tr key={m.kod} className="border-b border-line-200 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-ink-600">{m.kod}</td>
                <td className="px-4 py-3 text-ink-900">{m.ad}</td>
                <td className="px-4 py-3 text-ink-600">{m.sektor}</td>
                <td className="px-4 py-3 text-ink-600">{m.yetkili}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-600">{m.hizmet}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-600">{m.ekip}</td>
                <td className="px-4 py-3">
                  <Rozet ton={m.ton}>{m.durum}</Rozet>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-navy-500 underline">Detay</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
        <span>4 marka · filtre uygulanmadı</span>
        <span>Sayfa 1 / 1</span>
      </div>
    </AppWire>
  );
}
