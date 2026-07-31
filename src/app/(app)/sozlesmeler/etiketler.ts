/**
 * Sözleşme modülünün kullanıcıya görünen metinleri — TEK YER.
 *
 * ⚠ API hata KODLARI kullanıcıya ham gösterilmez. `CONTRACT_LOCKED` bir
 * geliştirici işaretidir; ekranda karşılığı "Yürürlükteki sözleşmede bu alan
 * değiştirilemez" olmalıdır. Eşleme burada durur ki her ekran kendi
 * çevirisini uydurmasın.
 */

export const DURUM_ETIKET = {
  draft: "Taslak",
  active: "Aktif",
  ended: "Sonlandı",
  cancelled: "İptal",
} as const;

export type SozlesmeDurumu = keyof typeof DURUM_ETIKET;

export const DURUM_TON: Record<SozlesmeDurumu, "success" | "info" | "warning" | "muted"> = {
  draft: "muted",
  active: "success",
  ended: "info",
  cancelled: "warning",
};

export const DURUMLAR = Object.keys(DURUM_ETIKET) as SozlesmeDurumu[];

/** Faturalama sıklığı. */
export const SIKLIK_ETIKET = {
  one_time: "Tek seferlik",
  monthly: "Aylık",
  quarterly: "Üç aylık",
  yearly: "Yıllık",
} as const;

export type FaturalamaSikligi = keyof typeof SIKLIK_ETIKET;
export const SIKLIKLAR = Object.keys(SIKLIK_ETIKET) as FaturalamaSikligi[];

/**
 * Tutar temeli — rakamın YANINDA daima gösterilir.
 *
 * Tek başına bir tutar "45.000 ₺" ekranda da CSV'de de belirsizdir: dönemlik
 * mi, sözleşme toplamı mı? Etiket bu yüzden rakamdan ayrılmaz.
 */
export const TEMEL_ETIKET = {
  per_period: "dönemlik",
  contract_total: "sözleşme toplamı",
} as const;

export type TutarTemeli = keyof typeof TEMEL_ETIKET;

/** Form içinde seçenek olarak gösterilen uzun hâli. */
export const TEMEL_SECENEK = {
  per_period: {
    baslik: "Dönemlik net tutar",
    aciklama: "Yazdığınız tutar her faturalama döneminde tekrar eder.",
  },
  contract_total: {
    baslik: "Sözleşme toplam net tutarı",
    aciklama: "Yazdığınız tutar taksitlere/dönemlere bölünür.",
  },
} as const;

/** Sunucu hata kodu → kullanıcı dili. Bilinmeyen kod genel mesaja düşer. */
const HATA_METNI: Record<string, string> = {
  VALIDATION: "Girilen bilgilerde eksik veya hatalı alan var.",
  CONTRACT_NOT_FOUND: "Sözleşme bulunamadı. Silinmiş veya erişiminiz kaldırılmış olabilir.",
  CONTRACT_NO_TAKEN: "Bu sözleşme numarası zaten kullanılıyor.",
  CONTRACT_LOCKED: "Yürürlükteki sözleşmede bu alan değiştirilemez.",
  INVALID_TRANSITION: "Sözleşme bu durumdayken bu işlem yapılamaz.",
  BRAND_NOT_ACTIVATABLE:
    "Markanın durumu bu sözleşmenin yürürlüğe alınmasına uygun değil. Önce markayı aktifleştirin.",
  SERVICE_INACTIVE: "Pasif hizmet yeni kaleme eklenemez.",
  /**
   * ⚠ 120 sınırı kullanıcıya AÇIK bir hata olarak gösterilir; liste sessizce
   * kısaltılmaz. Kısaltılmış bir plan toplamı sözleşme tutarından küçük
   * gösterir ve yanlış bir rakam konuşulur.
   */
  PREVIEW_TOO_LONG:
    "Bu yapılandırma 120'den fazla vade üretiyor. Taksit sayısını düşürün ya da bitiş tarihini öne çekin.",
  SESSION_STALE: "Bu işlem için kimliğinizi yeniden doğrulamanız gerekiyor.",
  FORBIDDEN: "Bu işlem için yetkiniz yok.",
  NOT_FOUND: "Kayıt bulunamadı.",
  UNAUTHENTICATED: "Oturumunuz sona ermiş. Yeniden giriş yapın.",
  FORBIDDEN_ORIGIN: "İstek doğrulanamadı. Sayfayı yenileyip tekrar deneyin.",
};

export function hataMetni(json: unknown, varsayilan = "İşlem tamamlanamadı."): string {
  const kod = (json as { error?: { code?: string } })?.error?.code;
  if (kod && HATA_METNI[kod]) return HATA_METNI[kod];
  const mesaj = (json as { error?: { message?: string } })?.error?.message;
  return mesaj ?? varsayilan;
}

export const AG_HATASI =
  "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";

/** Kuruş → "45.000,00 ₺". Görüntü biçimi 06 §10.1. */
const SEMBOL: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };

export function tutarYaz(minor: unknown, currency: unknown): string {
  const n = Number(minor);
  if (!Number.isFinite(n)) return "—";
  const eksi = n < 0;
  const abs = Math.abs(n);
  const tam = Math.floor(abs / 100).toLocaleString("tr-TR");
  const kurus = String(abs % 100).padStart(2, "0");
  const s = SEMBOL[String(currency)] ?? String(currency ?? "");
  return `${eksi ? "−" : ""}${tam},${kurus} ${s}`.trim();
}

/**
 * "2026-04-30" → "30.04.2026". Tarih yoksa em dash.
 *
 * ⚠ `Date` NESNESİ DE KABUL EDİLİR. `timestamptz` kolonları sürücüden `Date`
 * olarak gelir; yalnız string beklenirse `String(date)` "Mon Apr 01 2026…"
 * üretir, desen tutmaz ve ekranda sessizce "—" görünür. Hata gözle
 * yakalanana kadar veri kaybolmuş gibi durur.
 */
export function tarihYaz(deger: unknown): string {
  if (deger instanceof Date) {
    const g = String(deger.getDate()).padStart(2, "0");
    const a = String(deger.getMonth() + 1).padStart(2, "0");
    return `${g}.${a}.${deger.getFullYear()}`;
  }
  const s = typeof deger === "string" ? deger.slice(0, 10) : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}

/**
 * Kalem dönemi — DB'de kod, ekranda Türkçe.
 *
 * Ham `monthly` kullanıcı ekranına çıkmamalı: kod bir geliştirici işaretidir.
 */
const DONEM_ETIKET: Record<string, string> = {
  monthly: "Aylık",
  quarterly: "Üç aylık",
  yearly: "Yıllık",
  one_time: "Tek seferlik",
  hourly: "Saatlik",
  daily: "Günlük",
};

export function donemYaz(deger: unknown): string {
  const k = String(deger ?? "");
  return DONEM_ETIKET[k] ?? k;
}

/**
 * Yenileme rozeti — DAYANDIĞI ALANI SÖYLER.
 *
 * Görüşme tarihi varsa ona, yoksa gerçek yenileme tarihine sayar. Aynı metnin
 * iki farklı tarihi göstermesi kullanıcının takvimini yanlış kurmasına yol
 * açardı.
 */
export function yenilemeRozeti(
  renewalReviewDate: unknown,
  renewalDate: unknown,
  bugun = new Date(),
): { metin: string; gun: number } | null {
  const hedef = (typeof renewalReviewDate === "string" && renewalReviewDate) || null;
  const yedek = (typeof renewalDate === "string" && renewalDate) || null;
  const tarih = hedef ?? yedek;
  if (!tarih) return null;

  const t = new Date(`${tarih.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return null;
  const b = Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate());
  const gun = Math.round((t.getTime() - b) / 86_400_000);
  if (gun < 0 || gun > 60) return null;

  return {
    gun,
    metin: hedef ? `Yenileme görüşmesine ${gun} gün` : `Yenilemeye ${gun} gün`,
  };
}
