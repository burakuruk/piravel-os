/**
 * Ortam sırlarının başlangıç doğrulaması — PRD §7, docs/03 §2.
 *
 * ⚠ Sır değişkenlerinin kodda VARSAYILAN DEĞERİ OLMAZ. Bir `?? "gelistirme-..."`
 * fallback'i, değişken tanımsız kaldığında uygulamayı çökertmek yerine repoda
 * açıkça yazan bir değerle imzalamaya devam ettirir: repoyu okuyabilen herkes
 * oturum üretebilir. Bu yüzden eksik/zayıf sır bir hata değil, **başlatma
 * engeli**dir — uygulama hiç ayağa kalkmaz.
 *
 * Doğrulama modül yüklenirken çalışır; ilk isteği beklemez.
 */

/** Sırların kabul edilen en küçük uzunluğu (bayt). */
export const MIN_SIR_BAYT = 32;

/**
 * Repoda açıkça yazılı oldukları için sır sayılmayan değerler.
 *
 * İlk üçü kaldırılan kod içi fallback'ler ve eski `.env.example` placeholder'ı:
 * bir kez commit'lendikleri için geçmişi okuyan herkes bilir. Uzunluk kuralını
 * geçmelerine rağmen reddedilirler — aksi hâlde `.env.example`'ı olduğu gibi
 * kopyalayan bir kurulum "çalışır" görünür ve sırrı repodan okunabilir kalır.
 */
const YASAKLI_DEGERLER: readonly string[] = [
  "gelistirme-ortami-icin-gecici-anahtar",
  "gelistirme-pepper",
  "gelistirme-ortami-icin-32-karakterlik-gecici-anahtar",
  "degistirin",
  "changeme",
];

/** Doğrulama başarısızlığı — mesaj sırrın KENDİSİNİ asla içermez. */
export class OrtamSirriHatasi extends Error {
  constructor(ad: string, sebep: string) {
    super(
      `Ortam değişkeni ${ad} geçersiz: ${sebep}. ` +
        `Uygulama başlatılmadı. Güçlü bir değer üretin: ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`,
    );
    this.name = "OrtamSirriHatasi";
  }
}

/**
 * Bir sır değişkenini doğrular ve döner. Geçersizse `OrtamSirriHatasi` atar.
 *
 * Kurallar: tanımlı · yalnız boşluk değil · ≥ 32 bayt · bilinen placeholder değil.
 * Uzunluk **bayt** üzerinden ölçülür; çok baytlı karakterler karakter sayısını
 * şişirip entropiyi şişirmez, ölçüm gerçek anahtar malzemesine yakın kalır.
 */
export function sirDogrula(ad: string, ham: string | undefined | null): string {
  if (ham === undefined || ham === null || ham.trim() === "") {
    throw new OrtamSirriHatasi(ad, "tanımlı değil veya boş");
  }
  const deger = ham.trim();
  if (YASAKLI_DEGERLER.includes(deger)) {
    throw new OrtamSirriHatasi(
      ad,
      "repoda açıkça yazan bir örnek/placeholder değeri — sır sayılmaz",
    );
  }
  const bayt = Buffer.byteLength(deger, "utf8");
  if (bayt < MIN_SIR_BAYT) {
    throw new OrtamSirriHatasi(ad, `en az ${MIN_SIR_BAYT} bayt olmalı (şu an ${bayt})`);
  }
  return deger;
}

let betterAuthSecretOnbellek: string | null = null;

/**
 * Better Auth oturum imzalama sırrı.
 *
 * Aynı değer `auth-lockout.ts` içinde kimlik/IP hash'lerinin pepper'ı olarak da
 * kullanılır. Değeri döndürmek kilit kayıtlarını (kimlikHash/ipHash) eşleşmez
 * hâle getirir ve açık oturumları düşürür — bu beklenen davranıştır.
 *
 * Doğrulama neden modül seviyesinde bir `const` değil: o hâlde bu dosyayı —
 * ya da onu import eden `auth-lockout.ts`'i — import eden HER birim testi
 * gerçek bir `BETTER_AUTH_SECRET` istemeye başlardı ve testler doğrulamanın
 * mantığını değil, çalıştıran makinenin `.env`'ini ölçerdi. Fail-fast özelliği
 * kaybolmaz: `auth.ts` bu işlevi modül gövdesinde çağırır, yani sunucu ilk
 * isteği almadan önce düşer.
 */
export function betterAuthSecret(): string {
  betterAuthSecretOnbellek ??= sirDogrula(
    "BETTER_AUTH_SECRET",
    process.env.BETTER_AUTH_SECRET,
  );
  return betterAuthSecretOnbellek;
}

/**
 * `TRUSTED_PROXY_HOPS` doğrulaması.
 *
 * ⚠ ÜRETİMDE DEĞER ZORUNLUDUR. IP tabanlı hız sınırı aktifken yanlış
 * yapılandırma iki yönde de zarar verir:
 *   · fazla güven  → saldırgan sahte `x-forwarded-for` ile sınırı atlar
 *   · hiç güvenme  → istemci IP'si çözülemez ve TÜM kullanıcılar tek bir
 *                    kovaya düşer; bir kişinin denemeleri herkesi kilitler
 *
 * Bu yüzden üretimde eksik, sıfır, negatif veya sayı olmayan değer bir
 * başlatma hatasıdır — sessiz bir varsayılana düşmek iki riskten birini
 * kesinleştirirdi. Geliştirmede 0 serbesttir (proxy yoktur).
 *
 * Değer hosting ortamına göre belirlenir: uygulamanın ÖNÜNDEKİ gerçek ters
 * proxy sayısı (tek nginx/ALB → 1, CDN + ALB → 2). Tahmin edilmez.
 */
export function proxyHopsDogrula(
  ham: string | undefined | null,
  uretim: boolean,
): number {
  const tanimli = ham !== undefined && ham !== null && String(ham).trim() !== "";

  if (!uretim) {
    if (!tanimli) return 0;
    const n = Number(String(ham).trim());
    if (!Number.isInteger(n) || n < 0) {
      throw new OrtamSirriHatasi("TRUSTED_PROXY_HOPS", "negatif olmayan bir tam sayı olmalı");
    }
    return Math.min(n, 8);
  }

  if (!tanimli) {
    throw new OrtamSirriHatasi(
      "TRUSTED_PROXY_HOPS",
      "üretimde açıkça tanımlanmalı (uygulamanın önündeki ters proxy sayısı)",
    );
  }
  const n = Number(String(ham).trim());
  if (!Number.isInteger(n)) {
    throw new OrtamSirriHatasi("TRUSTED_PROXY_HOPS", "tam sayı olmalı");
  }
  if (n < 1) {
    throw new OrtamSirriHatasi(
      "TRUSTED_PROXY_HOPS",
      "üretimde en az 1 olmalı — 0 tüm kullanıcıları tek hız sınırı kovasına düşürür",
    );
  }
  if (n > 8) {
    throw new OrtamSirriHatasi("TRUSTED_PROXY_HOPS", "8'den büyük olamaz");
  }
  return n;
}

let proxyHopsOnbellek: number | null = null;

export function guvenilenProxyHops(): number {
  proxyHopsOnbellek ??= proxyHopsDogrula(
    process.env.TRUSTED_PROXY_HOPS,
    process.env.NODE_ENV === "production",
  );
  return proxyHopsOnbellek;
}

let invitePepperOnbellek: string | null = null;

/**
 * Davet token'larının HMAC pepper'ı.
 *
 * ⚠ BETTER_AUTH_SECRET'e fallback YOKTUR ve olmamalıdır: davet sırrı ile
 * oturum sırrı ayrı tutulur, biri sızarsa diğeri düşmez. Ortak bir sır
 * kullanılsaydı oturum sırrının rotasyonu tüm bekleyen davetleri sessizce
 * doğrulanamaz hâle getirirdi (ve tersi).
 *
 * Rotasyon: pepper değişince mevcut bekleyen davetler doğrulanamaz olur.
 * Prosedür — önce tüm `pending` davetler revoke edilir, pepper değiştirilir,
 * kullanıcılara yeni davet üretilir.
 */
export function inviteTokenPepper(): string {
  invitePepperOnbellek ??= sirDogrula(
    "INVITE_TOKEN_PEPPER",
    process.env.INVITE_TOKEN_PEPPER,
  );
  return invitePepperOnbellek;
}
