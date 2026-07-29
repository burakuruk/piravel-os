/**
 * HİZMET KATALOĞU — wireframe (Sprint 2 §5)
 *
 * Tartışmaya açılan kararlar:
 *   · Katalog SA'ya özel: hizmet türü eklemek fiyatlandırma ve sözleşme
 *     şablonlarını etkiler, operasyon ekibinin işi değil
 *   · Hizmet SİLİNMEZ, pasifleştirilir — geçmiş sözleşmeler ona referans verir
 *   · "Kaç markada kullanılıyor" sütunu: pasifleştirmeden önce etkiyi gösterir
 *   · Birim (Aylık/Proje/Saatlik) sözleşme satırlarının temeli olacak
 */
import { AppWire, Dugme, Kart, Rozet, SAHTE_HIZMETLER } from "../_app-shell";

export default function HizmetKataloguWireframe() {
  return (
    <AppWire
      baslik="Hizmet kataloğu"
      aciklama="Ajansın sunduğu hizmet türleri. Markalara bu katalogdan atanır."
      aktif="Hizmetler"
      ustEylem={<Dugme tur="birincil">Yeni hizmet</Dugme>}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-md border border-line-200 bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-medium">KOD</th>
                  <th className="px-4 py-3 font-medium">HİZMET</th>
                  <th className="px-4 py-3 font-medium">BİRİM</th>
                  <th className="px-4 py-3 text-right font-medium">KULLANAN MARKA</th>
                  <th className="px-4 py-3 font-medium">DURUM</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {SAHTE_HIZMETLER.map((h) => (
                  <tr key={h.kod} className="border-b border-line-200 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-ink-600">{h.kod}</td>
                    <td className="px-4 py-3 text-ink-900">{h.ad}</td>
                    <td className="px-4 py-3 text-ink-600">{h.birim}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-600">{h.marka}</td>
                    <td className="px-4 py-3">
                      {h.aktif ? <Rozet ton="success">Aktif</Rozet> : <Rozet>Pasif</Rozet>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-navy-500 underline">Düzenle</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 rounded-sm bg-info-bg px-3 py-2 text-xs text-info">
            Karar notu: hizmet <strong>silinmez</strong>, pasifleştirilir. Geçmiş
            sözleşmeler ve faturalar ona referans verecek; silinirse tarihsel
            kayıtlar anlamını yitirir. Pasif hizmet yeni markalara atanamaz,
            mevcut atamalar korunur.
          </p>
        </div>

        <Kart baslik="Yeni hizmet">
          <div className="space-y-3">
            {[
              ["Kod *", "SM"],
              ["Hizmet adı *", "Sosyal medya yönetimi"],
              ["Birim", "Aylık ▾"],
            ].map(([e, d]) => (
              <div key={e}>
                <div className="mb-1 text-sm text-ink-600">{e}</div>
                <div className="flex h-9 items-center rounded-sm border border-line-300 px-3 text-sm text-ink-400">
                  {d}
                </div>
              </div>
            ))}
            <div>
              <div className="mb-1 text-sm text-ink-600">Açıklama</div>
              <div className="h-16 rounded-sm border border-line-300" />
            </div>
            <div className="flex justify-end pt-1">
              <Dugme tur="birincil">Ekle</Dugme>
            </div>
          </div>
        </Kart>
      </div>
    </AppWire>
  );
}
