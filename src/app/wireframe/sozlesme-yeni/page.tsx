/**
 * YENİ SÖZLEŞME — wireframe (Sprint 3 §11.3–4)
 *
 * Tartışmaya açılan kararlar:
 *   · Sözleşme numarası FORM ALANI DEĞİL: sunucuda üretilir, kullanıcı
 *     yazamaz. Kutulu bir alan "buraya yazabilirim" derdi
 *   · Sözleşme TASLAK olarak doğar; durum seçici yok. Yürürlüğe alma ayrı ve
 *     onaylı bir işlemdir (aktivasyon ekranı)
 *   · KDV girişi TEK KUTU + "KDV dahil" anahtarı: kullanıcı elindeki rakamı
 *     olduğu gibi yazar, ayrıştırmayı sistem yapar ve sonucu HEMEN gösterir.
 *     İki ayrı "net/brüt" kutusu kullanıcıyı hangi rakamı nereye yazacağı
 *     sorusuyla baş başa bırakıyordu
 *   · Kapsam kalemleri BU FORMDA YOK: oluşturma formu uzarsa doldurulmuyor.
 *     Kalemler taslak kaydedildikten sonra detaydan eklenir
 *   · Faturalama sıklığı ayrı bir kart: vade tarihlerini bu dört alan belirler
 *   · Mobilde alanlar tek kolona iner (`sm:grid-cols-2`)
 */
import { Alan, AppWire, Dugme, Kart } from "../_app-shell";
import { SozlesmeNo, TutarSatiri } from "../_sozlesme";

export default function SozlesmeYeniWireframe() {
  return (
    <AppWire
      baslik="Yeni sözleşme"
      aciklama="Sözleşme taslak olarak kaydedilir. Kapsam kalemleri ve yürürlüğe alma sonraki adımlardır."
      aktif="Sözleşmeler"
    >
      <div className="max-w-[760px] space-y-4">
        <Kart baslik="Temel bilgiler">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-sm bg-fill-100 px-3 py-2.5">
            <SozlesmeNo olusacak />
            <div>
              <div className="text-xs text-ink-400">Durum</div>
              <div className="mt-0.5 text-sm text-ink-900">Taslak</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Alan etiket="Marka *" deger="Sahte Vize A.Ş. ▾" />
            <Alan etiket="Sözleşme başlığı *" deger="Sosyal medya yönetimi 2026" />
            <Alan etiket="Sorumlu" deger="Sahte Yönetici ▾" />
            <Alan etiket="Ödeme yöntemi" deger="Havale / EFT ▾" />
          </div>
        </Kart>

        <Kart baslik="Tarihler">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Alan etiket="Başlangıç tarihi *" deger="01.04.2026" />
            <Alan etiket="Bitiş tarihi" deger="31.03.2027" />
            <Alan etiket="Fiyat gözden geçirme" deger="—" genis />
          </div>
        </Kart>

        {/* Yenileme kendi kartında: iki tarih iki farklı iş (REVİZE 3) */}
        <Kart baslik="Yenileme">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Alan etiket="Yenileme görüşmesi tarihi" deger="15.09.2026" />
            <Alan etiket="Yenileme tarihi (yeni dönem başlangıcı)" deger="01.04.2027" />
          </div>
          <ul className="mt-3 space-y-1 text-xs text-ink-400">
            <li>
              · <strong className="text-ink-600">Görüşme tarihi</strong>: müşteriyle
              yenilemeyi konuşacağınız gün. Hatırlatma bu tarihe göre çıkar.
            </li>
            <li>
              · <strong className="text-ink-600">Yenileme tarihi</strong>: yeni dönemin
              başladığı gün. Bitiş tarihinden önce olamaz.
            </li>
          </ul>

          <label className="mt-4 flex items-start gap-2 text-[13px] text-ink-600">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-line-300 bg-surface" />
            Yenileme görüşmesi yaklaşınca bana hatırlat
          </label>
          <p className="mt-2 text-xs text-ink-400">
            Sözleşme kendiliğinden yenilenmez; bu işaret yalnız hatırlatma içindir.
          </p>
        </Kart>

        <Kart baslik="Tutar ve KDV">
          {/* Tutar temeli — rakamdan ÖNCE sorulur, çünkü rakamın anlamını o belirler */}
          <div className="mb-4">
            <div className="mb-1.5 text-sm text-ink-600">Tutar temeli *</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-sm border-2 border-navy-900 bg-fill-100 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[5px] border-navy-900 bg-surface" />
                  <span className="text-sm font-medium text-ink-900">
                    Dönemlik net tutar
                  </span>
                </div>
                <p className="mt-1 pl-6 text-xs text-ink-400">
                  Yazdığınız tutar her faturalama döneminde tekrar eder.
                </p>
              </div>
              <div className="rounded-sm border border-line-300 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded-full border border-line-300 bg-surface" />
                  <span className="text-sm text-ink-900">Sözleşme toplam net tutarı</span>
                </div>
                <p className="mt-1 pl-6 text-xs text-ink-400">
                  Yazdığınız tutar taksitlere/dönemlere bölünür.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Alan etiket="Dönemlik net tutar *" deger="45.000,00" />
            <Alan etiket="Para birimi *" deger="TRY ▾" />
            <Alan etiket="KDV oranı" deger="%20 ▾" />
            <Alan etiket="Dönemlik indirim" deger="1.000,00" />
          </div>

          <label className="mt-4 flex items-start gap-2 text-[13px] text-ink-600">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-line-300 bg-surface" />
            Yazdığım tutar KDV dahildir
          </label>

          {/* Kullanıcı yazdıkça güncellenen özet — hangi rakamın saklandığı görünsün */}
          <div className="mt-4 rounded-sm border border-line-200 bg-fill-100 px-3 py-2">
            <div className="pb-1 text-xs text-ink-400">Her faturalama döneminde</div>
            <TutarSatiri etiket="Net tutar" deger="45.000,00 ₺" />
            <TutarSatiri etiket="KDV (%20)" deger="9.000,00 ₺" ikincil />
            <TutarSatiri etiket="Brüt tutar" deger="54.000,00 ₺" vurgu />
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Türk lirası sözleşmelerde kur 1,0000 kabul edilir; döviz seçerseniz kur
            alanı açılır ve sözleşme tarihinde sabitlenir.
          </p>
        </Kart>

        <Kart baslik="Faturalama planı">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Alan etiket="Sıklık *" deger="Aylık ▾" />
            <Alan etiket="Kaç dönemde bir" deger="1" />
            <Alan etiket="İlk vade tarihi" deger="30.04.2026" />
            <Alan etiket="Taksit sayısı" deger="—" />
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Taksit sayısı boşsa vadeler bitiş tarihine kadar sürer. Ayın 31’i gibi her
            ayda bulunmayan bir gün seçilirse o ayın son günü kullanılır.
          </p>
          <p className="mt-2 text-xs text-ink-400">
            <strong className="text-ink-600">Toplam tutar</strong> temelini seçerseniz
            taksit sayısı ya da bitiş tarihi zorunlu olur — toplamın kaça bölüneceği
            belli olmalı.
          </p>
        </Kart>

        <div className="flex flex-wrap justify-end gap-2">
          <Dugme>Vazgeç</Dugme>
          <Dugme tur="birincil">Taslak olarak kaydet</Dugme>
        </div>

        <p className="rounded-sm bg-info-bg px-3 py-2 text-xs text-info">
          Sözleşme numarası kayıtta otomatik verilir ve bir daha değişmez. Kapsam
          kalemlerini kaydettikten sonra detay sayfasından ekleyebilirsiniz.
        </p>
      </div>
    </AppWire>
  );
}
