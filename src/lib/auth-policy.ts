/**
 * 2FA ve rol politikası — PRD §3, §6.3.
 *
 * Rol yalnızca 2FA'nın ZORUNLU olup olmadığını belirler.
 * Kuruluma başlayan HER kullanıcı aynı güvenli akışı tamamlar:
 *   kopyala/indir → onay → rastgele kurtarma kodu doğrulaması
 * Rol bazında daha zayıf bir kurulum yolu YOKTUR.
 */

export const USER_ROLES = ["super_admin", "finance", "operations", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** 2FA'sı zorunlu roller — finansal veriye tam erişimi olanlar. */
const TWO_FACTOR_REQUIRED: readonly UserRole[] = ["super_admin", "finance"];

export function isTwoFactorRequired(role: UserRole): boolean {
  return TWO_FACTOR_REQUIRED.includes(role);
}

/** Rolün finansal tutarları görüp göremeyeceği (yetki matrisi §5). */
export function canSeeAmounts(role: UserRole): boolean {
  return role === "super_admin" || role === "finance";
}

/** Rolün yalnız atandığı markalarla sınırlı olup olmadığı (yetki matrisi §4). */
export function isBrandScoped(role: UserRole): boolean {
  return role === "operations";
}

/** Rolün yalnız kendi görevlerini görüp göremeyeceği. */
export function isSelfScoped(role: UserRole): boolean {
  return role === "member";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Süper Yönetici",
  finance: "Finans",
  operations: "Operasyon",
  member: "Ekip Üyesi",
};

/**
 * Kurtarma kodu kurulum kapısı — TÜM roller için aynı.
 * Üç koşul da sağlanmadan 2FA kurulumu tamamlanamaz.
 */
export interface RecoverySetupState {
  /** Kodlar kopyalandı VEYA indirildi (en az biri) */
  copiedOrDownloaded: boolean;
  /** "Güvenli bir yere kaydettim" onayı */
  acknowledged: boolean;
  /** Rastgele sorulan kurtarma kodu doğru girildi */
  challengePassed: boolean;
}

export function canCompleteTwoFactorSetup(state: RecoverySetupState): boolean {
  return state.copiedOrDownloaded && state.acknowledged && state.challengePassed;
}

/**
 * Doğrulama için rastgele bir kurtarma kodu indeksi seçer.
 * Kriptografik rastgelelik kullanılır; tahmin edilebilir sıra kapıyı zayıflatır.
 */
export function pickChallengeIndex(codeCount: number, rng?: () => number): number {
  if (codeCount < 1) throw new RangeError("Kurtarma kodu listesi boş olamaz");
  if (rng) return Math.floor(rng() * codeCount) % codeCount;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % codeCount;
}

/** Kurtarma kodu karşılaştırması: boşluk/büyük-küçük harf toleranslı, sabit sonuç. */
export function normalizeRecoveryCode(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}
