/**
 * MARKA DETAY — wireframe (Sprint 2 §3)
 *
 * Tartışmaya açılan kararlar:
 *   · Tek sayfa, bölümler hâlinde — sekme yok. Sekmeler bilgiyi saklar ve
 *     "bu markanın yetkilisi var mı" sorusu bir tık uzağa düşer
 *   · Sözleşme/finans BU SPRINTTE YOK ve ekranda da GÖSTERİLMEZ: olmayan bir
 *     şeyin yer tutucusu kullanıcıya "burada bir şey eksik" hissi verir
 *   · Yetkili, hizmet ve ekip bölümleri kendi kartlarında ve her biri
 *     detay sayfasından yönetilir
 *   · "Sorumlu ekip" yalnız AÇIKÇA ATANMIŞ OPS kullanıcılarını gösterir;
 *     SA/FIN rol gereği zaten görür, atanmış gibi listelenmezler
 *   · "Son değişiklikler": son üç denetim olayı. Tam denetim ekranı bu
 *     sprintte yok; ama "bu markayı en son kim değiştirdi" sorusu hemen burada
 */
import { AppWire, Bilgi, Dugme, Kart, Rozet } from "../_app-shell";

export default function MarkaDetayWireframe() {
  return (
    <AppWire
      baslik="Sahte Vize A.Ş."
      aciklama="SVZ · Danışmanlık"
      ustEylem={
        <>
          <Dugme>Düzenle</Dugme>
          <Dugme tur="yikici">Pasifleştir</Dugme>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Rozet ton="success">Aktif</Rozet>
        <span className="text-xs text-ink-400">Müşteri oldu: 12.03.2026</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Kart baslik="Kimlik ve iletişim" eylem={<span className="text-sm text-navy-500 underline">Düzenle</span>}>
            {/* Salt okunur: düz metin. Input/select yalnız "Düzenle" modunda. */}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Bilgi etiket="Marka kodu" deger="SVZ" />
              <Bilgi etiket="Sektör" deger="Danışmanlık" />
              <Bilgi etiket="Ünvan" deger="Sahte Vize Danışmanlık Ltd. Şti." genis />
              <Bilgi etiket="E-posta" deger="info@example.com" />
              <Bilgi etiket="Telefon" deger="+90 ••• ••• ••••" />
              <Bilgi etiket="Vergi no" deger="•••••••••" />
              <Bilgi etiket="Vergi dairesi" deger="Örnek VD" />
            </dl>
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
            {/* Yalnız açıkça atanmış OPS kullanıcıları; FIN burada listelenmez. */}
            <div className="space-y-2 text-sm">
              {[
                ["Sahte Operasyon", "Operasyon"],
                ["Örnek Operasyon", "Operasyon"],
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

          <Kart
            baslik="Son değişiklikler"
            eylem={<span className="text-sm text-ink-400">Son 3 kayıt</span>}
          >
            <ol className="space-y-3 text-sm">
              {[
                ["Hizmet eklendi: SEO", "Sahte Yönetici", "28.07.2026 14:32"],
                ["Yetkili güncellendi", "Sahte Operasyon", "27.07.2026 09:11"],
                ["Marka oluşturuldu", "Sahte Yönetici", "12.03.2026 16:05"],
              ].map(([islem, kisi, tarih]) => (
                <li key={tarih}>
                  <div className="text-ink-900">{islem}</div>
                  <div className="text-xs text-ink-400">
                    {kisi} · {tarih}
                  </div>
                </li>
              ))}
            </ol>
          </Kart>

          <Kart baslik="Notlar">
            <p className="text-sm text-ink-400">Henüz not yok.</p>
          </Kart>
        </div>
      </div>
    </AppWire>
  );
}
