import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

/**
 * Tasarım sistemi referansı — 06 §1-16.
 *
 * ⚠ ÜRETİMDE TAMAMEN KAPALIDIR. Bu sayfa uygulamanın iç yapısını (token
 * adları, bileşen varyantları, hata metinleri) tek yerde sergiler; üretimde
 * erişilebilir kalması gereksiz bir keşif yüzeyi olurdu. Kapatma `notFound()`
 * ile yapılır — 403 değil 404, yani sayfanın VARLIĞI da sızmaz.
 *
 * Kapı NODE_ENV'e bağlıdır ve bilinçli olarak bir bayrağa bağlanmamıştır:
 * styleguide bir geliştirme aracıdır, üretimde açılmasının meşru bir sebebi
 * yoktur. (Karşılaştırma: AUDIT_TEST_RUN_ID_ENABLED bayrağa bağlandı çünkü
 * CI'ın gerçek production sunucusuna karşı test etmesi gerekiyordu.)
 */
export const dynamic = "force-dynamic";

/**
 * ⚠ `metadata` EXPORT'U YOK — bilerek.
 *
 * Next, metadata'yı bileşenden BAĞIMSIZ değerlendirir: sayfa `notFound()`
 * çağırsa bile başlık üretilir ve 404 yanıtının RSC yüküne gömülür. Bu,
 * üretimde `/styleguide` yoklayan birine rotanın var olduğunu ve adını
 * doğrulardı. Başlık bunun yerine bileşenin İÇİNDE render edilir; sayfa
 * gerçekten çizilmediğinde hiç üretilmez.
 */

const RENKLER: Array<[string, string, string]> = [
  ["navy-900", "bg-navy-900", "Kabuk yüzeyi"],
  ["navy-500", "bg-navy-500", "Bağlantı, vurgu"],
  ["gold-500", "bg-gold-500", "Altın aksan"],
  ["paper", "bg-paper", "Sayfa zemini"],
  ["surface", "bg-surface", "Kart yüzeyi"],
  ["fill-100", "bg-fill-100", "Pasif dolgu"],
  ["line-200", "bg-line-200", "İnce çizgi"],
  ["ink-900", "bg-ink-900", "Ana metin"],
  ["ink-600", "bg-ink-600", "İkincil metin"],
  ["ink-400", "bg-ink-400", "Sönük metin"],
  ["success", "bg-success", "Olumlu"],
  ["warning", "bg-warning", "Uyarı"],
  ["danger", "bg-danger", "Hata"],
  ["info", "bg-info", "Bilgi"],
];

function Bolum({
  no,
  baslik,
  aciklama,
  children,
}: {
  no: string;
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 scroll-mt-6" id={`bolum-${no}`}>
      <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">{no}</div>
      <h2 className="text-lg font-semibold text-ink-900">{baslik}</h2>
      {aciklama && <p className="mt-1 mb-4 max-w-[64ch] text-sm text-ink-600">{aciklama}</p>}
      <div className={aciklama ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 lg:px-8">
      {/* React bunları head'e taşır; yalnız sayfa render olduğunda üretilir. */}
      <title>Styleguide — Piravel OS</title>
      <meta name="robots" content="noindex, nofollow" />

      <header className="mb-10">
        <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">
          GELİŞTİRME ARACI
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Styleguide</h1>
        <div className="mt-2 h-0.5 w-12 bg-gold-500" />
        <p className="mt-3 max-w-[68ch] text-sm text-ink-600">
          Tasarım sisteminin tek referansı. Bu sayfa üretim derlemesinde{" "}
          <strong className="text-ink-900">tamamen kapalıdır</strong> ve 404 döner.
        </p>
      </header>

      <Bolum
        no="01"
        baslik="Renk token'ları"
        aciklama="Renkler doğrudan hex ile değil token adıyla kullanılır; tema değişimi tek yerden yapılabilsin diye."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {RENKLER.map(([ad, sinif, rol]) => (
            <div key={ad}>
              <div className={`h-14 rounded-sm border border-line-200 ${sinif}`} />
              <div className="mt-1.5 font-mono text-xs text-ink-900">{ad}</div>
              <div className="text-xs text-ink-400">{rol}</div>
            </div>
          ))}
        </div>
      </Bolum>

      <Bolum no="02" baslik="Tipografi ölçeği">
        <div className="space-y-3 rounded-md border border-line-200 bg-surface p-5">
          <p className="font-display text-3xl font-semibold text-ink-900">
            Display 30 — sayfa başlığı
          </p>
          <p className="text-2xl font-semibold text-ink-900">Başlık 24 — bölüm</p>
          <p className="text-lg font-semibold text-ink-900">Alt başlık 18</p>
          <p className="text-sm text-ink-900">Gövde 14 — ana okuma boyutu</p>
          <p className="text-sm text-ink-600">Gövde ikincil 14</p>
          <p className="text-xs text-ink-400">Yardımcı 12 — açıklama, meta</p>
          <p className="font-mono text-xs text-ink-600">Mono 12 — kimlik, kod, IBAN</p>
        </div>
      </Bolum>

      <Bolum
        no="03"
        baslik="Butonlar"
        aciklama="Yıkıcı işlemler kırmızıdır ve daima bir onay penceresi ister; renk tek başına uyarı sayılmaz."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-200 bg-surface p-5">
          <Button variant="primary">Birincil</Button>
          <Button>İkincil</Button>
          <Button variant="ghost">Hayalet</Button>
          <Button variant="destructive">Yıkıcı</Button>
          <Button disabled>Pasif</Button>
          <Button size="table">Tablo içi</Button>
        </div>
      </Bolum>

      <Bolum
        no="04"
        baslik="Form kontrolleri"
        aciklama="Her alanın görünür bir etiketi vardır; yer tutucu etiket yerine geçmez."
      >
        <div className="grid gap-4 rounded-md border border-line-200 bg-surface p-5 sm:grid-cols-2">
          <div>
            <label htmlFor="sg-metin" className="mb-1 block text-sm text-ink-600">
              Metin alanı
            </label>
            <input
              id="sg-metin"
              defaultValue="Sahte değer"
              className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="sg-secim" className="mb-1 block text-sm text-ink-600">
              Seçim
            </label>
            <select
              id="sg-secim"
              className="w-full rounded-sm border border-line-300 bg-surface px-3 py-2 text-sm"
            >
              <option>Birinci seçenek</option>
              <option>İkinci seçenek</option>
            </select>
          </div>
          <div>
            <label htmlFor="sg-hatali" className="mb-1 block text-sm text-ink-600">
              Hatalı alan
            </label>
            <input
              id="sg-hatali"
              defaultValue="gecersiz"
              aria-invalid="true"
              aria-describedby="sg-hatali-mesaj"
              className="w-full rounded-sm border border-danger px-3 py-2 text-sm"
            />
            <p id="sg-hatali-mesaj" className="mt-1 text-xs text-danger">
              Bu alan geçerli bir değer içermeli.
            </p>
          </div>
          <div>
            <label htmlFor="sg-salt" className="mb-1 block text-sm text-ink-600">
              Salt okunur
            </label>
            <input
              id="sg-salt"
              readOnly
              aria-readonly="true"
              defaultValue="degistirilemez@example.com"
              className="w-full rounded-sm border border-line-300 bg-fill-100 px-3 py-2 text-sm text-ink-600"
            />
          </div>
        </div>
      </Bolum>

      <Bolum
        no="05"
        baslik="Mesaj tonları"
        aciklama="Dört ton; hata mesajları kullanıcıya ne yapacağını söyler, sistemin iç durumunu değil."
      >
        <div className="space-y-3">
          <p className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            Kaydedildi. Değişiklikler hemen geçerli.
          </p>
          <p className="rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
            Bu bağlantı yalnız bir kez gösterilir; sayfadan ayrılırsanız geri getirilemez.
          </p>
          <p className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
            İşlem tamamlanamadı. Lütfen tekrar deneyin.
          </p>
          <p className="rounded-sm bg-info-bg px-3 py-2 text-sm text-info">
            Rolünüz için iki aşamalı doğrulama zorunludur.
          </p>
        </div>
      </Bolum>

      <Bolum no="06" baslik="Rozet ve durumlar">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line-200 bg-surface p-5">
          <Badge variant="success">Aktif</Badge>
          <Badge variant="warning">Davet bekliyor</Badge>
          <Badge variant="danger">Gecikti</Badge>
          <Badge variant="info">Taslak</Badge>
          <Badge variant="muted">Pasif</Badge>
          <Badge>Nötr</Badge>
        </div>
      </Bolum>

      <Bolum
        no="07"
        baslik="Tablo"
        aciklama="Tutarlar sağa hizalanır ve mono rakamlarla dizilir; göz sütunu aşağı tarayabilsin diye."
      >
        <div className="overflow-x-auto rounded-md border border-line-200 bg-surface">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                <th className="px-4 py-3 font-medium">MARKA</th>
                <th className="px-4 py-3 font-medium">DURUM</th>
                <th className="px-4 py-3 text-right font-medium">TUTAR</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Sahte Vize A.Ş.", "success", "Ödendi", 8_600_000],
                ["Test Klinik", "warning", "Kısmi", 1_750_000],
                ["Sahte Ajans", "danger", "Gecikti", 4_500_00],
              ].map(([ad, ton, durum, tutar]) => (
                <tr key={String(ad)} className="border-b border-line-200 last:border-0">
                  <td className="px-4 py-3 text-ink-900">{String(ad)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ton as "success"}>{String(durum)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-900">
                    {formatMoney(Number(tutar), "TRY")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 mb-2 text-xs tracking-widest text-ink-400">YOĞUN</p>
        <div className="overflow-x-auto rounded-md border border-line-200 bg-surface">
          <table className="w-full min-w-[520px] text-[13px]">
            <tbody>
              {["Satır bir", "Satır iki", "Satır üç"].map((s) => (
                <tr key={s} className="border-b border-line-200 last:border-0">
                  <td className="px-3 py-1.5 text-ink-900">{s}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-ink-600">
                    {formatMoney(123_456, "TRY")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bolum>

      <Bolum no="08" baslik="Kart">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kart başlığı</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-600">
                Kartlar ilişkili bilgiyi gruplar. Gölge yerine ince çizgi kullanılır.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Metrik</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl tabular-nums text-ink-900">
                {formatMoney(25_705_000, "TRY")}
              </p>
              <p className="mt-1 text-xs text-ink-400">örnek veri</p>
            </CardContent>
          </Card>
        </div>
      </Bolum>

      <Bolum
        no="09"
        baslik="Modal ve drawer"
        aciklama="Gerçek örnekleri uygulamada: step-up penceresi (kullanıcı detayı) ve mobil menü. İkisi de role=dialog + aria-modal taşır, odak tuzağı kurar ve arka planı inert yapar."
      >
        <div className="rounded-md border border-line-200 bg-surface p-5">
          <div className="mx-auto max-w-[380px] rounded-md border border-line-200 bg-surface p-5 shadow-lg">
            <h3 className="mb-1 text-base font-semibold text-ink-900">Kimliğinizi doğrulayın</h3>
            <p className="mb-4 text-sm text-ink-600">
              Bu işlem hassastır. Devam etmek için parolanızı girin.
            </p>
            <div className="flex justify-end gap-2">
              <Button>Vazgeç</Button>
              <Button variant="primary">Doğrula</Button>
            </div>
          </div>
        </div>
      </Bolum>

      <Bolum no="10" baslik="Yükleme, boş ve hata durumları">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-line-200 bg-surface p-5">
            <p className="mb-3 text-xs tracking-widest text-ink-400">YÜKLENİYOR</p>
            <div className="space-y-2">
              <div className="h-3 w-3/4 rounded-sm bg-fill-100" />
              <div className="h-3 w-full rounded-sm bg-fill-100" />
              <div className="h-3 w-1/2 rounded-sm bg-fill-100" />
            </div>
          </div>
          <div className="rounded-md border border-line-200 bg-surface p-5">
            <p className="mb-3 text-xs tracking-widest text-ink-400">BOŞ</p>
            <p className="text-sm text-ink-600">Henüz kayıt yok.</p>
            <Button size="table" className="mt-3">
              İlkini ekle
            </Button>
          </div>
          <div className="rounded-md border border-line-200 bg-surface p-5">
            <p className="mb-3 text-xs tracking-widest text-ink-400">HATA</p>
            <p className="text-sm text-danger">Liste yüklenemedi.</p>
            <Button size="table" className="mt-3">
              Tekrar dene
            </Button>
          </div>
        </div>
      </Bolum>

      <Bolum
        no="11"
        baslik="Biçimler"
        aciklama="Para, tarih ve kimlik biçimleri tek yerden gelir; ekranlar kendi biçimlendirmesini yazmaz."
      >
        <div className="overflow-x-auto rounded-md border border-line-200 bg-surface">
          <table className="w-full min-w-[520px] text-sm">
            <tbody>
              {[
                ["Para (TRY)", formatMoney(8_600_000, "TRY")],
                ["Para (USD)", formatMoney(312_000, "USD")],
                ["Para (EUR)", formatMoney(45_050, "EUR")],
                ["Tarih", new Date("2026-08-15T10:30:00Z").toLocaleDateString("tr-TR")],
                ["Tarih + saat", new Date("2026-08-15T10:30:00Z").toLocaleString("tr-TR")],
                ["IBAN (maskeli)", "TR•• •••• •••• •••• •••• •• 1234"],
                ["Sözleşme no", "SZL-2026-0042"],
                ["Ağ öneki", "203.0.113.0/24"],
              ].map(([ad, deger]) => (
                <tr key={ad} className="border-b border-line-200 last:border-0">
                  <td className="px-4 py-2.5 text-ink-600">{ad}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink-900">
                    {deger}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-400">
          IBAN hiçbir listede açık gösterilmez; tam görünüm step-up ister.
        </p>
      </Bolum>

      <Bolum
        no="12"
        baslik="Odak görünürlüğü"
        aciklama="Odak halkası yalnız klavye gezinmesinde belirir (focus-visible). Fareyle tıklamada halka çıkmaz; erişilebilirlik görsel gürültüye dönüşmesin diye."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-200 bg-surface p-5">
          <Button>Tab ile odaklanın</Button>
          <a href="#bolum-01" className="text-sm text-navy-500 underline">
            Bağlantı
          </a>
          <input
            aria-label="Odak denemesi"
            className="rounded-sm border border-line-300 px-3 py-2 text-sm"
          />
        </div>
      </Bolum>
    </main>
  );
}
