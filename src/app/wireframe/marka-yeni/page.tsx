/**
 * YENİ MARKA — wireframe (Sprint 2 §2)
 *
 * Tartışmaya açılan kararlar:
 *   · Kod ZORUNLU ve benzersiz; sözleşme/fatura numaralarında kullanılacak
 *   · Yalnız kimlik bilgileri burada; yetkili ve hizmet DETAYDA eklenir —
 *     oluşturma formu uzarsa kimse doldurmaz
 *   · Vergi bilgileri isteğe bağlı: aday (lead) aşamasında henüz bilinmiyor
 */
import { Alan, AppWire, Dugme, Kart } from "../_app-shell";

export default function MarkaYeniWireframe() {
  return (
    <AppWire
      baslik="Yeni marka"
      aciklama="Marka oluşturulduktan sonra yetkili, hizmet ve ekip ataması detay sayfasından yapılır."
    >
      <div className="max-w-[720px] space-y-4">
        <Kart baslik="Kimlik">
          <div className="grid grid-cols-2 gap-4">
            <Alan etiket="Marka kodu *" deger="SVZ" />
            <Alan etiket="Marka adı *" deger="Sahte Vize A.Ş." />
            <Alan etiket="Ünvan (yasal ad)" deger="Sahte Vize Danışmanlık Ltd. Şti." genis />
            <Alan etiket="Sektör" deger="Danışmanlık ▾" />
            <Alan etiket="Durum" deger="Aday ▾" />
          </div>
        </Kart>

        <Kart baslik="İletişim">
          <div className="grid grid-cols-2 gap-4">
            <Alan etiket="E-posta" deger="info@example.com" />
            <Alan etiket="Telefon" deger="+90 ••• ••• ••••" />
            <Alan etiket="Web sitesi" deger="example.com" />
            <Alan etiket="Adres" deger="—" />
          </div>
        </Kart>

        <Kart baslik="Vergi bilgileri">
          <div className="grid grid-cols-2 gap-4">
            <Alan etiket="Vergi numarası" />
            <Alan etiket="Vergi dairesi" />
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Aday aşamasında boş bırakılabilir; sözleşme oluşturmadan önce zorunlu olur.
          </p>
        </Kart>

        <div className="flex justify-end gap-2">
          <Dugme>Vazgeç</Dugme>
          <Dugme tur="birincil">Markayı oluştur</Dugme>
        </div>

        <p className="rounded-sm bg-info-bg px-3 py-2 text-xs text-info">
          Karar notu: kod benzersizdir ve sonradan değiştirilemez — sözleşme ve
          fatura numaraları ona dayanacak.
        </p>
      </div>
    </AppWire>
  );
}
