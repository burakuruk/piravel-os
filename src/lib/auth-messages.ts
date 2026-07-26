/**
 * Kimlik doğrulama kullanıcı mesajları — TEK KAYNAK.
 *
 * ⚠ Bu mesajlar SABİTTİR ve bilgi sızdırmaz:
 *   · Hangi alanın (e-posta mı parola mı) yanlış olduğu söylenmez
 *   · Hesabın var olup olmadığı açıklanmaz
 *   · Kalan deneme sayısı veya sayaç değeri GÖSTERİLMEZ — saldırgana eşiği
 *     ve ilerlemesini bildirmek, korumayı zayıflatır
 *
 * Bekleme süresi yalnız Retry-After başlığıyla iletilir; metinde sayı yoktur.
 */
export const MESAJ = {
  gecersizKimlik: "E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.",
  cokFazlaDeneme: "Çok sayıda başarısız deneme yapıldı. Bir süre sonra tekrar deneyin.",
  gecersizKod: "Doğrulama kodu geçersiz.",
  gecersizKurtarmaKodu: "Kurtarma kodu geçersiz.",
} as const;
