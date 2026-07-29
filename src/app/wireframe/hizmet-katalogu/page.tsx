/**
 * HİZMET KATALOĞU — wireframe (Sprint 2 §5)
 *
 * Tartışmaya açılan kararlar:
 *   · Katalog SA'ya özel: hizmet türü eklemek fiyatlandırma ve sözleşme
 *     şablonlarını etkiler, operasyon ekibinin işi değil
 *   · Hizmet SİLİNMEZ, pasifleştirilir — geçmiş sözleşmeler ona referans verir
 *   · "Kaç markada kullanılıyor" sütunu: pasifleştirmeden önce etkiyi gösterir
 *   · Birim (Aylık/Proje/Saatlik) sözleşme satırlarının temeli olacak
 *   · MASAÜSTÜNDE sağ panel zaten açık olduğu için üstte "Yeni hizmet" butonu
 *     YOK — iki eylem aynı işi yapıyordu
 *   · MOBİLDE tablo yerine kart; yatay kaydırma yok. "Yeni hizmet" butonu
 *     mobilde AYRI FORM EKRANINI (sheet) açar, sağ panel gösterilmez
 */
import { AppWire, Dugme, Kart, Rozet, SAHTE_HIZMETLER } from "../_app-shell";

export default function HizmetKataloguWireframe() {
  return (
    <AppWire
      baslik="Hizmet kataloğu"
      aciklama="Ajansın sunduğu hizmet türleri. Markalara bu katalogdan atanır."
      aktif="Hizmetler"
      /* Masaüstünde sağ panel açık → üst buton yalnız mobilde. */
      ustEylem={
        <span className="lg:hidden">
          <Dugme tur="birincil">Yeni hizmet</Dugme>
        </span>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* ── Mobil: kart listesi ── */}
          <div className="space-y-3 lg:hidden">
            {SAHTE_HIZMETLER.map((h) => (
              <div key={h.kod} className="rounded-md border border-line-200 bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-ink-400">{h.kod}</div>
                    <div className="mt-0.5 text-[15px] font-medium text-ink-900">{h.ad}</div>
                  </div>
                  {h.aktif ? <Rozet ton="success">Aktif</Rozet> : <Rozet>Pasif</Rozet>}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-ink-400">Birim</dt>
                    <dd className="text-ink-600">{h.birim}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Kullanan marka</dt>
                    <dd className="tabular-nums text-ink-600">{h.marka}</dd>
                  </div>
                </dl>

                <div className="mt-3 border-t border-line-200 pt-3">
                  <span className="text-sm text-navy-500 underline">Düzenle</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Masaüstü: tablo ── */}
          <div className="hidden rounded-md border border-line-200 bg-surface lg:block">
            <table className="w-full text-sm">
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
        </div>

        {/* Sağ panel yalnız masaüstünde; mobilde üstteki buton sheet'i açar. */}
        <div className="hidden lg:block">
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
      </div>
    </AppWire>
  );
}
