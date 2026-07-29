/**
 * Marka modülünün kullanıcıya görünen metinleri — TEK YER.
 *
 * ⚠ API hata KODLARI kullanıcıya ham gösterilmez. `BRAND_CODE_TAKEN` bir
 * geliştirici işaretidir; ekranda karşılığı "Bu kod başka bir markada
 * kullanılıyor" olmalıdır. Eşleme burada durur ki her ekran kendi çevirisini
 * uydurmasın.
 */

export const DURUM_ETIKET = {
  lead: "Aday",
  proposal_sent: "Teklif gönderildi",
  active: "Aktif",
  suspended: "Askıda",
  churned: "Ayrıldı",
} as const;

export type MarkaDurumu = keyof typeof DURUM_ETIKET;

export const DURUM_TON: Record<MarkaDurumu, "success" | "info" | "warning" | "muted"> = {
  lead: "info",
  proposal_sent: "info",
  active: "success",
  suspended: "warning",
  churned: "muted",
};

export const DURUMLAR = Object.keys(DURUM_ETIKET) as MarkaDurumu[];

/** Sunucu hata kodu → kullanıcı dili. Bilinmeyen kod genel mesaja düşer. */
const HATA_METNI: Record<string, string> = {
  VALIDATION: "Girilen bilgilerde eksik veya hatalı alan var.",
  BRAND_CODE_TAKEN: "Bu kod başka bir markada kullanılıyor. Farklı bir kod deneyin.",
  BRAND_CODE_IMMUTABLE: "Marka kodu oluşturulduktan sonra değiştirilemez.",
  BRAND_NOT_FOUND: "Marka bulunamadı. Silinmiş veya erişiminiz kaldırılmış olabilir.",
  SERVICE_CODE_TAKEN: "Bu hizmet kodu zaten kullanılıyor.",
  SERVICE_NOT_FOUND: "Hizmet bulunamadı.",
  SERVICE_INACTIVE: "Pasif hizmet markalara eklenemez.",
  CONTACT_NOT_FOUND: "Yetkili bulunamadı.",
  USER_NOT_ASSIGNABLE: "Markaya yalnız aktif operasyon kullanıcıları atanabilir.",
  FORBIDDEN: "Bu işlem için yetkiniz yok.",
  NOT_FOUND: "Kayıt bulunamadı.",
  UNAUTHENTICATED: "Oturumunuz sona ermiş. Yeniden giriş yapın.",
  FORBIDDEN_ORIGIN: "İstek doğrulanamadı. Sayfayı yenileyip tekrar deneyin.",
};

/**
 * Yanıttan kullanıcıya gösterilecek metni üretir.
 *
 * Sunucunun `message` alanı zaten Türkçe ve kullanıcıya uygundur; kod bazlı
 * eşleme onun ÖNÜNE geçer, çünkü ekranda daha yol gösterici olabilir.
 */
export function hataMetni(json: unknown, varsayilan = "İşlem tamamlanamadı."): string {
  const kod = (json as { error?: { code?: string; message?: string } })?.error?.code;
  if (kod && HATA_METNI[kod]) return HATA_METNI[kod];
  const mesaj = (json as { error?: { message?: string } })?.error?.message;
  return mesaj ?? varsayilan;
}

/** Ağ hatası ile sunucu hatası ayrı okunur: kullanıcı ne yapacağını bilmeli. */
export const AG_HATASI =
  "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
