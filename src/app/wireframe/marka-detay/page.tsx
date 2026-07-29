/**
 * MARKA DETAY — wireframe (Sprint 2 §3)
 *
 * Tartışmaya açılan kararlar:
 *   · Tek sayfa, bölümler hâlinde — sekme yok. Sekmeler bilgiyi saklar ve
 *     "bu markanın yetkilisi var mı" sorusu bir tık uzağa düşer
 *   · Sözleşme/finans bölümleri BU SPRINTTE YOK; yerleri sonraki sprintler
 *     için işaretlendi ki düzen sonradan bozulmasın
 *   · Yetkili, hizmet ve ekip bölümleri kendi kartlarında ve her biri
 *     detay sayfasından yönetilir
 */
import { Alan, AppWire, Dugme, Kart, Rozet } from "../_app-shell";

export default function MarkaDetayWireframe() {
  return (
    <AppWire
      baslik="Sahte Vize A.Ş."
      aciklama="SVZ · Danışmanlık"
      ustEylem={
        <div className="flex gap-2">
          <Dugme>Düzenle</Dugme>
          <Dugme tur="yikici">Pasifleştir</Dugme>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Rozet ton="success">Aktif</Rozet>
        <span className="text-xs text-ink-400">Müşteri oldu: 12.03.2026</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Kart baslik="Kimlik ve iletişim" eylem={<span className="text-sm text-navy-500 underline">Düzenle</span>}>
            <div className="grid grid-cols-2 gap-4">
              <Alan etiket="Marka kodu" deger="SVZ" />
              <Alan etiket="Sektör" deger="Danışmanlık" />
              <Alan etiket="Ünvan" deger="Sahte Vize Danışmanlık Ltd. Şti." genis />
              <Alan etiket="E-posta" deger="info@example.com" />
              <Alan etiket="Telefon" deger="+90 ••• ••• ••••" />
              <Alan etiket="Vergi no" deger="•••••••••" />
              <Alan etiket="Vergi dairesi" deger="Örnek VD" />
            </div>
          </Kart>

          <Kart
            baslik="Yetkili kişiler"
            eylem={<span className="text-sm text-navy-500 underline">+ Yetkili ekle</span>}
          >
            <div className="divide-y divide-line-200 text-sm">
              {[
                ["Sahte Yetkili", "Pazarlama Müdürü", "sahte.yetkili@example.com", true],
                ["Örnek Kişi", "Finans", "ornek.kisi@example.com", false],
              ].map(([ad, unvan, mail, birincil]) => (
                <div key={String(mail)} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-900">{String(ad)}</span>
                      {birincil && <Rozet ton="info">Birincil</Rozet>}
                    </div>
                    <div className="text-xs text-ink-400">
                      {String(unvan)} · {String(mail)}
                    </div>
                  </div>
                  <span className="text-sm text-navy-500 underline">Düzenle</span>
                </div>
              ))}
            </div>
          </Kart>

          <Kart
            baslik="Alınan hizmetler"
            eylem={<span className="text-sm text-navy-500 underline">+ Hizmet ekle</span>}
          >
            <div className="flex flex-wrap gap-2">
              <Rozet ton="success">Sosyal medya yönetimi</Rozet>
              <Rozet ton="success">SEO</Rozet>
              <Rozet ton="success">Basın ilişkileri</Rozet>
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Hizmetler katalogdan seçilir; buradan yeni hizmet TÜRÜ oluşturulamaz.
            </p>
          </Kart>
        </div>

        <div className="space-y-4">
          <Kart
            baslik="Sorumlu ekip"
            eylem={<span className="text-sm text-navy-500 underline">Ata</span>}
          >
            <div className="space-y-2 text-sm">
              {[
                ["Test operations", "Operasyon"],
                ["Test finance", "Finans"],
              ].map(([ad, rol]) => (
                <div key={ad} className="flex items-center justify-between">
                  <div>
                    <div className="text-ink-900">{ad}</div>
                    <div className="text-xs text-ink-400">{rol}</div>
                  </div>
                  <span className="text-xs text-navy-500 underline">Kaldır</span>
                </div>
              ))}
            </div>
          </Kart>

          <Kart baslik="Notlar">
            <p className="text-sm text-ink-400">Henüz not yok.</p>
          </Kart>

          {/* Sonraki sprintlerin yeri — şimdiden işaretli */}
          <div className="rounded-md border border-dashed border-line-300 bg-fill-100 p-5">
            <p className="text-xs tracking-widest text-ink-400">SONRAKİ SPRINTLER</p>
            <p className="mt-2 text-sm text-ink-400">
              Sözleşmeler · Alacaklar · Tahsilat geçmişi
            </p>
            <p className="mt-2 text-xs text-ink-400">
              Bu sprintte geliştirilmiyor; yeri düzen bozulmasın diye ayrıldı.
            </p>
          </div>
        </div>
      </div>
    </AppWire>
  );
}
