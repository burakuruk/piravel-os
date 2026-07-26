import { describe, expect, it } from "vitest";
import {
  canCompleteTwoFactorSetup,
  canSeeAmounts,
  isBrandScoped,
  isSelfScoped,
  isTwoFactorRequired,
  normalizeRecoveryCode,
  pickChallengeIndex,
  USER_ROLES,
  type RecoverySetupState,
} from "./auth-policy";

describe("2FA zorunluluğu — rol politikası", () => {
  it("super_admin ve finance için ZORUNLU", () => {
    expect(isTwoFactorRequired("super_admin")).toBe(true);
    expect(isTwoFactorRequired("finance")).toBe(true);
  });

  it("operations ve member için isteğe bağlı", () => {
    expect(isTwoFactorRequired("operations")).toBe(false);
    expect(isTwoFactorRequired("member")).toBe(false);
  });
});

describe("Kurtarma kodu kurulum kapısı — TÜM roller için aynı", () => {
  const full: RecoverySetupState = {
    copiedOrDownloaded: true,
    acknowledged: true,
    challengePassed: true,
  };

  it("üç koşul sağlanınca tamamlanabilir", () => {
    expect(canCompleteTwoFactorSetup(full)).toBe(true);
  });

  it("kopyalama/indirme yapılmadan tamamlanamaz", () => {
    expect(canCompleteTwoFactorSetup({ ...full, copiedOrDownloaded: false })).toBe(false);
  });

  it("onay verilmeden tamamlanamaz", () => {
    expect(canCompleteTwoFactorSetup({ ...full, acknowledged: false })).toBe(false);
  });

  it("rastgele kod doğrulanmadan tamamlanamaz", () => {
    expect(canCompleteTwoFactorSetup({ ...full, challengePassed: false })).toBe(false);
  });

  it("KAPI HER ROL İÇİN AYNIDIR — zayıf yol yoktur", () => {
    // Politika role bakmaz: hiçbir rol eksik durumla tamamlayamaz
    for (const role of USER_ROLES) {
      expect(canCompleteTwoFactorSetup({ ...full, challengePassed: false }), role).toBe(false);
      expect(canCompleteTwoFactorSetup(full), role).toBe(true);
    }
  });
});

describe("Rastgele kurtarma kodu seçimi", () => {
  it("seçilen indeks daima aralık içindedir", () => {
    for (let i = 0; i < 200; i++) {
      const idx = pickChallengeIndex(6);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(6);
    }
  });

  it("boş listede hata verir", () => {
    expect(() => pickChallengeIndex(0)).toThrow(RangeError);
  });

  it("zaman içinde farklı indeksler üretir (sabit değil)", () => {
    const seen = new Set(Array.from({ length: 100 }, () => pickChallengeIndex(6)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("Kurtarma kodu normalizasyonu", () => {
  it("boşluk ve büyük harf toleranslıdır", () => {
    expect(normalizeRecoveryCode("  TEST-0003 ")).toBe("test-0003");
    expect(normalizeRecoveryCode("test 0003")).toBe("test0003");
  });
});

describe("Rol kapsam yardımcıları (yetki matrisi §4, §5)", () => {
  it("tutarları yalnız SA ve FIN görür", () => {
    expect(canSeeAmounts("super_admin")).toBe(true);
    expect(canSeeAmounts("finance")).toBe(true);
    expect(canSeeAmounts("operations")).toBe(false);
    expect(canSeeAmounts("member")).toBe(false);
  });

  it("operations marka kapsamlıdır, member kendi kayıtlarıyla sınırlıdır", () => {
    expect(isBrandScoped("operations")).toBe(true);
    expect(isBrandScoped("super_admin")).toBe(false);
    expect(isSelfScoped("member")).toBe(true);
    expect(isSelfScoped("operations")).toBe(false);
  });
});
