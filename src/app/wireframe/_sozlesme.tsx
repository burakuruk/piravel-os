/**
 * SÖZLEŞME MODÜLÜ wireframe'leri — ortak parçalar (Sprint 3)
 *
 * Bu dosyadaki her şey GÖRSEL ONAY İÇİN statik taslaktır. İş mantığı, form
 * gönderimi, API çağrısı veya durum yönetimi YOKTUR.
 *
 * ⚠ PRD §6.3: Tüm veriler açıkça sahtedir — marka adları "Sahte…", "Test…",
 * "Örnek…" ön ekli, adresler `example.com`. Gerçek müşteri, tutar veya
 * sözleşme verisi repoya girmez.
 *
 * ⚠ Teknik karar notları (kilitleme, projection, CHECK kısıtları…) EKRANA
 * TAŞINMAZ; yalnız bu yorum bloklarında yaşar. Kullanıcı ekranında yalnız
 * kullanıcının işine yarayan açıklama bulunur.
 */

/**
 * Liste ve detay ekranlarının sahte sözleşme kadrosu.
 *
 * `temel` = tutarın neyi ifade ettiği (REVİZE 3):
 *   "donemlik" → `tutar` HER faturalama döneminin neti
 *   "toplam"   → `tutar` sözleşmenin TOPLAM neti, dönemlere bölünür
 * Ekranlarda rakam bu etiket olmadan hiç gösterilmez.
 */
export const SAHTE_SOZLESMELER = [
  {
    no: "PRV-2026-0001",
    marka: "Sahte Vize A.Ş.",
    markaKod: "SVZ",
    baslik: "Sosyal medya yönetimi 2026",
    durum: "Aktif",
    ton: "success",
    baslangic: "01.04.2026",
    bitis: "31.03.2027",
    siklik: "Aylık",
    tutar: "45.000,00 ₺",
    temel: "donemlik",
    /** Gerçek yenileme: yeni dönemin başladığı gün. */
    yenileme: "01.04.2027",
    /** Görüşme / hatırlatma günü — yenilemeden önce. */
    gorusme: "15.09.2026",
    kalanGun: 47,
    /** Rozet hangi tarihe dayanıyorsa metin de ona göre yazılır. */
    kalanTur: "gorusme",
  },
  {
    no: "PRV-2026-0002",
    marka: "Test Klinik",
    markaKod: "TKL",
    baslik: "SEO ve içerik üretimi",
    durum: "Taslak",
    ton: "muted",
    baslangic: "01.08.2026",
    bitis: "31.07.2027",
    siklik: "Aylık",
    tutar: "18.500,00 ₺",
    temel: "donemlik",
    yenileme: "—",
    gorusme: "—",
    kalanGun: null,
    kalanTur: null,
  },
  {
    no: "PRV-2026-0003",
    marka: "Sahte Ajans",
    markaKod: "SAJ",
    baslik: "Lansman kampanyası",
    durum: "Taslak",
    ton: "muted",
    baslangic: "01.09.2026",
    bitis: "30.11.2026",
    siklik: "Tek seferlik",
    tutar: "3.500,00 $",
    temel: "toplam",
    yenileme: "—",
    gorusme: "—",
    kalanGun: null,
    kalanTur: null,
  },
  {
    no: "PRV-2026-0004",
    marka: "Örnek Mimarlık",
    markaKod: "ORN",
    baslik: "Basın ilişkileri",
    durum: "Sonlandı",
    ton: "info",
    baslangic: "01.01.2026",
    bitis: "30.06.2026",
    siklik: "Aylık",
    tutar: "12.000,00 ₺",
    temel: "donemlik",
    yenileme: "—",
    gorusme: "—",
    kalanGun: null,
    kalanTur: null,
  },
  {
    no: "PRV-2026-0005",
    marka: "Sahte Vize A.Ş.",
    markaKod: "SVZ",
    baslik: "Web sitesi yenileme",
    durum: "İptal",
    ton: "warning",
    baslangic: "01.05.2026",
    bitis: "—",
    siklik: "3 taksit",
    tutar: "60.000,00 ₺",
    temel: "toplam",
    yenileme: "—",
    gorusme: "—",
    kalanGun: null,
    kalanTur: null,
  },
] as const;

/** Tutar temelinin ekrandaki karşılığı — tek kaynak. */
export const TEMEL_ETIKET = {
  donemlik: "dönemlik",
  toplam: "sözleşme toplamı",
} as const;

/** Tutar altına düşen küçük temel etiketi. */
export function TemelEtiketi({ temel }: { temel: string }) {
  return (
    <span className="text-xs text-ink-400">
      {TEMEL_ETIKET[temel as keyof typeof TEMEL_ETIKET]}
    </span>
  );
}

/**
 * PRV-2026-0001'in kapsam kalemleri.
 *
 * Kalem toplamı 46.000,00 ₺ · indirim 1.000,00 ₺ · beklenen net 45.000,00 ₺
 * → sözleşme net tutarıyla birebir uyuşur, uyarı çıkmaz.
 */
export const SAHTE_KALEMLER = [
  { kod: "SM", ad: "Sosyal medya yönetimi", miktar: "1", birim: "Aylık", donem: "Aylık", fiyat: "30.000,00 ₺", toplam: "30.000,00 ₺", markada: true },
  { kod: "SEO", ad: "Arama motoru optimizasyonu", miktar: "1", birim: "Aylık", donem: "Aylık", fiyat: "10.000,00 ₺", toplam: "10.000,00 ₺", markada: true },
  { kod: "PR", ad: "Basın ilişkileri", miktar: "1", birim: "Aylık", donem: "Aylık", fiyat: "6.000,00 ₺", toplam: "6.000,00 ₺", markada: true },
] as const;

/**
 * Ödeme planı önizlemesinin sahte satırları.
 *
 * Vade günü ayın 31'i seçilmiştir: 31'i olmayan aylarda ayın SON günü
 * kullanılır (30.04, 30.06, 30.09, 30.11, 28.02). Kural görselden okunabilsin
 * diye bilerek böyle kurgulandı.
 */
export const SAHTE_PLAN = [
  ["1", "30.04.2026"], ["2", "31.05.2026"], ["3", "30.06.2026"],
  ["4", "31.07.2026"], ["5", "31.08.2026"], ["6", "30.09.2026"],
  ["7", "31.10.2026"], ["8", "30.11.2026"], ["9", "31.12.2026"],
  ["10", "31.01.2027"], ["11", "28.02.2027"], ["12", "31.03.2027"],
] as const;

export const PLAN_TUTAR = { net: "45.000,00 ₺", kdv: "9.000,00 ₺", brut: "54.000,00 ₺" } as const;

/**
 * TOPLAM temelli planlar (REVİZE 4) — [sıra, vade, net, KDV, brüt].
 *
 * Sıra: önce SÖZLEŞME seviyesinde toplam net / toplam KDV / toplam brüt
 * hesaplanır; sonra net ve KDV **ayrı ayrı** taksitlere bölünür. Brüt
 * bölünmez, satırda net + KDV olarak türetilir.
 *
 * `bolunen`: 60.000,00 ₺ net · KDV %20 → hepsi tam bölünür.
 * `kalanli`: 100.000,00 ₺ net · KDV %20 → net'te 0,01 ₺, KDV'de 0,02 ₺ artar;
 * ikisi de SON taksite yüklenir ve üç toplam da birebir tutar.
 */
export const PLAN_TOPLAM_BOLUNEN = [
  ["1", "30.06.2026", "20.000,00 ₺", "4.000,00 ₺", "24.000,00 ₺"],
  ["2", "31.07.2026", "20.000,00 ₺", "4.000,00 ₺", "24.000,00 ₺"],
  ["3", "31.08.2026", "20.000,00 ₺", "4.000,00 ₺", "24.000,00 ₺"],
] as const;

export const TOPLAM_BOLUNEN = {
  net: "60.000,00 ₺",
  kdv: "12.000,00 ₺",
  brut: "72.000,00 ₺",
} as const;

export const PLAN_TOPLAM_KALANLI = [
  ["1", "30.06.2026", "33.333,33 ₺", "6.666,66 ₺", "39.999,99 ₺"],
  ["2", "31.07.2026", "33.333,33 ₺", "6.666,66 ₺", "39.999,99 ₺"],
  ["3", "31.08.2026", "33.333,34 ₺", "6.666,68 ₺", "40.000,02 ₺"],
] as const;

export const TOPLAM_KALANLI = {
  net: "100.000,00 ₺",
  kdv: "20.000,00 ₺",
  brut: "120.000,00 ₺",
} as const;

/**
 * SÖZLEŞME NUMARASI — salt okunur gösterim.
 *
 * Kutulu bir alan kullanıcıya "buraya yazabilirim" der; numara ise sunucuda
 * üretilir ve hiçbir zaman değiştirilemez. Bu yüzden input değil, etiketli bir
 * künye olarak çizilir.
 */
export function SozlesmeNo({ no, olusacak }: { no?: string; olusacak?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-400">Sözleşme numarası</div>
      {olusacak ? (
        <div className="mt-0.5 text-sm text-ink-400">
          Kaydedildiğinde otomatik verilir
        </div>
      ) : (
        <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-sm bg-fill-100 px-2 py-1 font-mono text-sm text-ink-900">
          {no}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-400"
            aria-hidden="true"
          >
            <rect x="4" y="11" width="16" height="9" rx="1.5" />
            <path d="M8 11V7.5a4 4 0 018 0V11" />
          </svg>
          <span className="sr-only">değiştirilemez</span>
        </div>
      )}
    </div>
  );
}

/**
 * Onay / step-up penceresi — statik taslak.
 *
 * Sayfanın üstüne koyu bir katman serer. Gerçek bileşende odak tuzağı, Escape
 * ile kapanma ve `aria-modal` zaten var (`step-up-dialog.tsx`); buradaki
 * işaretleme onunla aynı iskelete oturur.
 */
export function Pencere({
  baslik,
  aciklama,
  children,
  eylem,
  genis,
}: {
  baslik: string;
  aciklama?: string;
  children?: React.ReactNode;
  eylem: React.ReactNode;
  genis?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-900/60 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        className={`w-full rounded-md border border-line-200 bg-surface p-5 shadow-lg ${
          genis ? "max-w-[560px]" : "max-w-[420px]"
        }`}
      >
        <h2 className="mb-1 text-base font-semibold text-ink-900">{baslik}</h2>
        {aciklama && <p className="mb-4 text-sm text-ink-600">{aciklama}</p>}
        {children}
        <div className="mt-5 flex flex-wrap justify-end gap-2">{eylem}</div>
      </div>
    </div>
  );
}

/** Gerekçe alanı — 3–500 karakter, sayaçlı. */
export function GerekceAlani({
  etiket,
  deger,
  sayac,
  hata,
}: {
  etiket: string;
  deger?: string;
  sayac: string;
  hata?: string;
}) {
  return (
    <div className="mb-1">
      <label className="mb-1 block text-sm text-ink-600">{etiket}</label>
      <div
        className={`min-h-[76px] rounded-sm border bg-surface px-3 py-2 text-sm ${
          hata ? "border-danger" : "border-line-300"
        } ${deger ? "text-ink-900" : "text-ink-400"}`}
      >
        {deger ?? "Bu işlemin nedenini yazın…"}
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className={hata ? "text-danger" : "text-ink-400"}>
          {hata ?? "En az 3, en çok 500 karakter."}
        </span>
        <span className="tabular-nums text-ink-400">{sayac}</span>
      </div>
    </div>
  );
}

/** Step-up penceresinin parola + kod bölümü (statik). */
export function StepUpAlani() {
  return (
    <>
      <label className="mb-1 block text-sm text-ink-600">Parola</label>
      <div className="mb-3 flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm tracking-widest text-ink-400">
        ••••••••••••
      </div>
      <label className="mb-1 block text-sm text-ink-600">Doğrulama kodu</label>
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-11 flex-1 items-center justify-center rounded-sm border border-line-300 bg-surface text-lg text-ink-400"
          >
            •
          </div>
        ))}
      </div>
    </>
  );
}

/** Tutar satırı — sağa yaslı, tabular rakamlarla. */
export function TutarSatiri({
  etiket,
  deger,
  vurgu,
  ikincil,
}: {
  etiket: string;
  deger: string;
  vurgu?: boolean;
  ikincil?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        vurgu ? "border-t border-line-200 pt-2.5" : ""
      }`}
    >
      <span className={`text-sm ${ikincil ? "text-ink-400" : "text-ink-600"}`}>{etiket}</span>
      <span
        className={`tabular-nums ${
          vurgu ? "text-base font-semibold text-ink-900" : "text-sm text-ink-900"
        }`}
      >
        {deger}
      </span>
    </div>
  );
}
