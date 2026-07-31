/**
 * SÖZLEŞME DETAYI — wireframe (Sprint 3 §11.5–6), AKTİF sözleşme
 *
 * Tartışmaya açılan kararlar:
 *   · Tek sayfa, bölümler hâlinde — sekme yok (marka detayıyla aynı gerekçe)
 *   · KİLİTLİ ALANLAR FORM GİBİ GÖRÜNMEZ. Aktif sözleşmede tutar, tarih,
 *     faturalama ve kalemler düz metindir; çerçeveli kutu ya da "Düzenle"
 *     bağlantısı yoktur. Tıklanabilir görünüp tıklanınca hiçbir şey olmayan
 *     alan, kullanıcıya kilidin kendisinden daha çok zarar veriyor
 *   · Düzenlenebilen az sayıda alan (yenileme, notlar) KENDİ kartında ve
 *     yalnız o kartta "Düzenle" bağlantısı var — kilit sınırı görünür olsun
 *   · Ödeme planı bir EYLEM, kart değil: kayıt üretmediği için sayfanın
 *     kalıcı bir bölümü gibi durmamalı
 *   · Alacak/tahsilat bölümü YOK ve yer tutucusu da yok: olmayan şeyin
 *     iskeleti kullanıcıya "burada bir şey eksik" hissi veriyor
 */
import { AppWire, Bilgi, Dugme, Kart, Rozet } from "../_app-shell";
import { SAHTE_KALEMLER, SozlesmeNo, TutarSatiri } from "../_sozlesme";

export default function SozlesmeDetayWireframe() {
  return (
    <AppWire
      baslik="Sosyal medya yönetimi 2026"
      aciklama="Sahte Vize A.Ş. · SVZ"
      aktif="Sözleşmeler"
      ustEylem={
        <>
          <Dugme>Ödeme planını gör</Dugme>
          <Dugme>Sonlandır</Dugme>
          <Dugme tur="yikici">İptal et</Dugme>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <SozlesmeNo no="PRV-2026-0001" />
        <Rozet ton="success">Aktif</Rozet>
        <Rozet ton="warning">Yenileme görüşmesine 47 gün</Rozet>
        <span className="text-xs text-ink-400">Yürürlüğe alındı: 01.04.2026</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Salt okunur: düz metin, kutu yok — aktif sözleşmede bu alanlar kilitli */}
          <Kart baslik="Sözleşme bilgileri">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Bilgi etiket="Marka" deger="Sahte Vize A.Ş." />
              <Bilgi etiket="Sorumlu" deger="Sahte Yönetici" />
              <Bilgi etiket="Başlangıç" deger="01.04.2026" />
              <Bilgi etiket="Bitiş" deger="31.03.2027" />
              <Bilgi etiket="Ödeme yöntemi" deger="Havale / EFT" />
              <Bilgi etiket="Ödeme vadesi" deger="14 gün" />
            </dl>
          </Kart>

          <Kart
            baslik="Tutar ve KDV"
            eylem={<Rozet ton="info">Dönemlik tutar</Rozet>}
          >
            <div className="max-w-[380px]">
              <div className="pb-1 text-xs text-ink-400">Her faturalama döneminde</div>
              <TutarSatiri etiket="Kalem toplamı" deger="46.000,00 ₺" ikincil />
              <TutarSatiri etiket="İndirim (dönemlik)" deger="−1.000,00 ₺" ikincil />
              <TutarSatiri etiket="Net tutar" deger="45.000,00 ₺" />
              <TutarSatiri etiket="KDV (%20)" deger="9.000,00 ₺" ikincil />
              <TutarSatiri etiket="Brüt tutar" deger="54.000,00 ₺" vurgu />
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Bu tutar her ay tekrar eder; 12 dönemlik sözleşme boyunca toplam brüt
              648.000,00 ₺. Türk lirası sözleşme · kur 1,0000
            </p>
          </Kart>

          <Kart baslik="Kapsam kalemleri">
            {/* Mobil: kart · masaüstü: tablo */}
            <div className="space-y-3 sm:hidden">
              {SAHTE_KALEMLER.map((k) => (
                <div key={k.kod} className="rounded-sm border border-line-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-ink-400">{k.kod}</div>
                      <div className="text-sm text-ink-900">{k.ad}</div>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-ink-900">{k.toplam}</span>
                  </div>
                  <div className="mt-1.5 text-xs text-ink-400">
                    {k.miktar} × {k.fiyat} · {k.donem}
                  </div>
                </div>
              ))}
            </div>

            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                  <th className="pb-2 pr-4 font-medium">HİZMET</th>
                  <th className="whitespace-nowrap px-3 pb-2 text-right font-medium">MİKTAR</th>
                  <th className="whitespace-nowrap px-3 pb-2 font-medium">DÖNEM</th>
                  <th className="whitespace-nowrap px-3 pb-2 text-right font-medium">BİRİM FİYAT</th>
                  <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">TOPLAM</th>
                </tr>
              </thead>
              <tbody>
                {SAHTE_KALEMLER.map((k) => (
                  <tr key={k.kod} className="border-b border-line-200 last:border-0">
                    <td className="py-2.5 pr-4 text-ink-900">
                      <span className="mr-2 font-mono text-xs text-ink-400">{k.kod}</span>
                      {k.ad}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-600">{k.miktar}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-600">{k.donem}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-600">
                      {k.fiyat}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums text-ink-900">
                      {k.toplam}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-xs text-ink-400">
              Yürürlükteki sözleşmede kalemler değiştirilemez. Değişiklik gerekiyorsa
              sözleşmeyi sonlandırıp yenisini oluşturun.
            </p>
          </Kart>
        </div>

        <div className="space-y-4">
          <Kart baslik="Faturalama">
            <dl className="space-y-3">
              <Bilgi etiket="Sıklık" deger="Aylık (her 1 dönemde bir)" />
              <Bilgi etiket="İlk vade" deger="30.04.2026" />
              <Bilgi etiket="Taksit sayısı" deger="Bitiş tarihine kadar" />
            </dl>
            <p className="mt-3 text-xs text-ink-400">
              Vade takvimini görmek için üstteki “Ödeme planını gör” düğmesini
              kullanın.
            </p>
          </Kart>

          {/* Kilit sınırı: yalnız bu kartta düzenleme var */}
          <Kart
            baslik="Yenileme"
            eylem={<span className="text-sm text-navy-500 underline">Düzenle</span>}
          >
            <dl className="space-y-3">
              <Bilgi etiket="Yenileme görüşmesi" deger="15.09.2026" />
              <Bilgi etiket="Yenileme tarihi (yeni dönem)" deger="01.04.2027" />
              <Bilgi etiket="Hatırlatma" deger="Açık" />
            </dl>
            <div className="mt-3">
              <Rozet ton="warning">Yenileme görüşmesine 47 gün</Rozet>
            </div>
            <p className="mt-2 text-xs text-ink-400">
              Rozet <strong className="text-ink-600">görüşme</strong> tarihine göre
              sayar. Sözleşme 31.03.2027’de biter, yeni dönem 01.04.2027’de başlar.
            </p>
          </Kart>

          <Kart
            baslik="Notlar"
            eylem={<span className="text-sm text-navy-500 underline">Düzenle</span>}
          >
            <p className="text-sm text-ink-900">Görsel üretimi ayrı teklif edilecek.</p>
          </Kart>

          <Kart baslik="Son değişiklikler" eylem={<span className="text-sm text-ink-400">Son 3 kayıt</span>}>
            <ol className="space-y-3 text-sm">
              {[
                ["Sözleşme yürürlüğe alındı", "Sahte Yönetici", "01.04.2026 10:12"],
                ["Kapsam kalemleri güncellendi", "Sahte Yönetici", "29.03.2026 16:40"],
                ["Sözleşme oluşturuldu", "Örnek Finans", "27.03.2026 09:05"],
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
        </div>
      </div>
    </AppWire>
  );
}
