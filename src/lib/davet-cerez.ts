import { DAVET_CEREZ_ADI, DAVET_CEREZ_SURESI_SN } from "@/lib/invitation-sabitler";

/**
 * Davet çerezinin Set-Cookie dizesi — nitelikleri tek yerde toplanır.
 *
 * ⚠ İçerik ham token DEĞİLDİR: sunucuda davet kaydına eşlenen rastgele bir
 * oturum kimliğidir. Token'ın kendisi hiçbir zaman çereze yazılmaz.
 *
 * | Nitelik  | Değer     | Neden |
 * |----------|-----------|-------|
 * | HttpOnly | ✓         | Script okuyamaz; XSS ile çalınamaz |
 * | SameSite | Strict    | Başka siteden gelen istekte gönderilmez (CSRF) |
 * | Secure   | üretimde  | Düz HTTP üzerinden sızmaz |
 * | Path     | /davet    | Uygulamanın geri kalanına hiç gönderilmez |
 * | Max-Age  | 10 dk     | Davetin 72 saatinden bağımsız, çok kısa pencere |
 */
function nitelikler(maxAge: number): string {
  const parcalar = [
    `Path=/davet`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (process.env.NODE_ENV === "production") parcalar.push("Secure");
  return parcalar.join("; ");
}

export function davetCereziYaz(cerezKimligi: string): string {
  return `${DAVET_CEREZ_ADI}=${cerezKimligi}; ${nitelikler(DAVET_CEREZ_SURESI_SN)}`;
}

/**
 * Çerezi hemen siler — kabul başarılı olur olmaz çağrılır.
 *
 * Max-Age=0 ile birlikte boş değer yazılır; tarayıcı çerezi anında düşürür.
 * Sunucu tarafındaki eşleme (cookie_hash) zaten aynı transaction'da
 * temizleniyor, bu istemci tarafındaki ikinci katman.
 */
export function davetCereziSil(): string {
  return `${DAVET_CEREZ_ADI}=; ${nitelikler(0)}`;
}
