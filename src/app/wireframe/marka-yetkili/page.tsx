/**
 * MARKA YETKİLİSİ EKLE/DÜZENLE — wireframe (Sprint 2 §4)
 *
 * Tartışmaya açılan kararlar:
 *   · Yetkili bir KULLANICI DEĞİLDİR — sisteme giriş yapmaz, yalnız iletişim
 *     kaydıdır. Bu ayrım net olmazsa "yetkiliye davet gönderelim mi" karışıklığı
 *     çıkar
 *   · Marka başına tek "birincil" yetkili; ikinciyi işaretlemek öncekini düşürür
 *   · Silme yerine pasifleştirme yok — yetkili kaydı soft-delete edilir
 */
import { Alan, AppWire, Dugme, Kart, Rozet } from "../_app-shell";

export default function MarkaYetkiliWireframe() {
  return (
    <AppWire baslik="Sahte Vize A.Ş. › Yetkili kişi" aciklama="Marka tarafındaki iletişim kişisi.">
      <div className="max-w-[640px] space-y-4">
        <Kart baslik="Yetkili bilgileri">
          <div className="grid grid-cols-2 gap-4">
            <Alan etiket="Ad soyad *" deger="Sahte Yetkili" />
            <Alan etiket="Ünvan" deger="Pazarlama Müdürü" />
            <Alan etiket="E-posta" deger="sahte.yetkili@example.com" />
            <Alan etiket="Telefon" deger="+90 ••• ••• ••••" />
            <Alan etiket="Not" deger="—" genis />
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm text-ink-600">
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-sm border border-line-300 bg-navy-900 text-[10px] text-white">
              ✓
            </span>
            <span>
              Birincil yetkili
              <span className="block text-xs text-ink-400">
                Markanın ana muhatabı. İşaretlenirse mevcut birincil yetkili
                otomatik olarak sıradan yetkiliye döner.
              </span>
            </span>
          </label>
        </Kart>

        <div className="flex items-center justify-between">
          <Dugme tur="yikici">Yetkiliyi kaldır</Dugme>
          <div className="flex gap-2">
            <Dugme>Vazgeç</Dugme>
            <Dugme tur="birincil">Kaydet</Dugme>
          </div>
        </div>

        <div className="rounded-sm bg-warning-bg px-3 py-2 text-xs text-warning">
          <strong>Karar notu:</strong> Yetkili bir sistem kullanıcısı DEĞİLDİR —
          Piravel OS&apos;a giriş yapamaz, davet almaz. Yalnız marka tarafındaki
          iletişim kaydıdır. Sisteme erişecek kişiler{" "}
          <span className="underline">Kullanıcılar</span> modülünden davet edilir.
        </div>

        <Kart baslik="Mevcut yetkililer">
          <div className="divide-y divide-line-200 text-sm">
            {[
              ["Sahte Yetkili", "Pazarlama Müdürü", true],
              ["Örnek Kişi", "Finans", false],
            ].map(([ad, unvan, birincil]) => (
              <div key={String(ad)} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-ink-900">{String(ad)}</span>
                  <span className="text-xs text-ink-400">{String(unvan)}</span>
                </div>
                {birincil ? <Rozet ton="info">Birincil</Rozet> : <Rozet>Yetkili</Rozet>}
              </div>
            ))}
          </div>
        </Kart>
      </div>
    </AppWire>
  );
}
