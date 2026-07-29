/**
 * MARKA LİSTESİ — wireframe (Sprint 2 §1)
 *
 * Tartışmaya açılan kararlar:
 *   · Arama tek kutuda: ad VE kod üzerinde çalışır
 *   · Filtreler satır içinde (durum, sektör) — ayrı bir panel açılmaz
 *   · CSV dışa aktarma listenin O ANKİ filtresini dışa aktarır
 *   · Yetkili ve hizmet sayısı listede: "hangi marka boşta" sorusu için
 *   · OPS yalnız ATANDIĞI markaları görür (API katmanında zorlanır)
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

      <div className="overflow-x-auto rounded-md border border-line-200 bg-surface">
        <table className="w-full min-w-[760px] text-sm">
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

      <p className="mt-6 rounded-sm bg-info-bg px-3 py-2 text-xs text-info">
        Karar notu: OPS rolü bu listede yalnız <strong>atandığı</strong> markaları
        görür; süzme UI&apos;da değil sorgu katmanında yapılır.
      </p>
    </AppWire>
  );
}
