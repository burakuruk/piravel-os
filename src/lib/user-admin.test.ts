import { describe, expect, it } from "vitest";
import {
  alanlariSuz,
  gecerliRolMu,
  GORUNUR_ALANLAR,
  kullaniciDurumu,
  kullaniciListesiniGorebilirMi,
  kullaniciYonetebilirMi,
} from "./user-admin";
import { USER_ROLES } from "./auth-policy";

const TARIH = new Date("2026-07-01T00:00:00Z");

describe("kullaniciDurumu — is_active tek başına yetmez", () => {
  it("hiç aktifleşmemiş kullanıcı pending", () => {
    expect(kullaniciDurumu({ isActive: false, activatedAt: null })).toBe("pending");
  });

  it("aktifleşmiş ve açık kullanıcı active", () => {
    expect(kullaniciDurumu({ isActive: true, activatedAt: TARIH })).toBe("active");
  });

  it("aktifleşmiş ama pasifleştirilmiş kullanıcı inactive", () => {
    expect(kullaniciDurumu({ isActive: false, activatedAt: TARIH })).toBe("inactive");
  });

  it("pending ile inactive AYIRT EDİLİR — ikisi de is_active=false", () => {
    const bekleyen = kullaniciDurumu({ isActive: false, activatedAt: null });
    const pasif = kullaniciDurumu({ isActive: false, activatedAt: TARIH });
    expect(bekleyen).not.toBe(pasif);
  });

  it("tutarsız veri (activatedAt null + isActive true) pending sayılır", () => {
    // Savunmacı: parolası olmayan biri aktif işaretlenmişse yine de
    // aktifleşmemiş kabul edilir.
    expect(kullaniciDurumu({ isActive: true, activatedAt: null })).toBe("pending");
  });
});

describe("gecerliRolMu", () => {
  it("tanımlı dört rolü kabul eder", () => {
    for (const r of USER_ROLES) expect(gecerliRolMu(r)).toBe(true);
  });

  it("uydurma veya yanlış tipteki değerleri reddeder", () => {
    for (const d of ["admin", "SUPER_ADMIN", "", null, undefined, 1, {}]) {
      expect(gecerliRolMu(d)).toBe(false);
    }
  });
});

describe("Yetki kapıları", () => {
  it("kullanıcı yönetimi yalnız SA'da", () => {
    expect(kullaniciYonetebilirMi("super_admin")).toBe(true);
    for (const r of ["finance", "operations", "member"] as const) {
      expect(kullaniciYonetebilirMi(r)).toBe(false);
    }
  });

  it("MEM listeyi hiç göremez", () => {
    expect(kullaniciListesiniGorebilirMi("member")).toBe(false);
    for (const r of ["super_admin", "finance", "operations"] as const) {
      expect(kullaniciListesiniGorebilirMi(r)).toBe(true);
    }
  });
});

describe("alanlariSuz — alan görünürlüğü (docs/02 §5)", () => {
  const tamKayit = {
    id: "u1",
    email: "a@example.com",
    fullName: "Ad Soyad",
    phone: "+90...",
    role: "finance" as const,
    isActive: true,
    status: "active",
    activatedAt: TARIH,
    lastLoginAt: TARIH,
    twoFactorEnabled: true,
    createdAt: TARIH,
    invitation: { durum: "accepted" },
  };

  it("SA her alanı görür", () => {
    const c = alanlariSuz(tamKayit, "super_admin");
    for (const alan of GORUNUR_ALANLAR.super_admin) {
      expect(c).toHaveProperty(alan);
    }
  });

  it("FIN yalnız ad, e-posta, rol ve aktifliği görür", () => {
    const c = alanlariSuz(tamKayit, "finance");
    expect(Object.keys(c).sort()).toEqual(
      ["email", "fullName", "id", "isActive", "role", "status"].sort(),
    );
  });

  it("OPS telefon ve adı görür, aktiflik/durum göremez", () => {
    const c = alanlariSuz(tamKayit, "operations");
    expect(c).toHaveProperty("fullName");
    expect(c).toHaveProperty("phone");
    expect(c).not.toHaveProperty("isActive");
    expect(c).not.toHaveProperty("status");
  });

  it("MEM hiçbir alan görmez", () => {
    expect(alanlariSuz(tamKayit, "member")).toEqual({});
  });

  it("hiçbir rol 2FA/aktivasyon ayrıntısını yanlışlıkla almaz", () => {
    for (const r of ["finance", "operations"] as const) {
      const c = alanlariSuz(tamKayit, r);
      expect(c).not.toHaveProperty("twoFactorEnabled");
      expect(c).not.toHaveProperty("activatedAt");
      expect(c).not.toHaveProperty("lastLoginAt");
      expect(c).not.toHaveProperty("invitation");
    }
  });

  it("kayıtta olmayan izinli alan uydurulmaz", () => {
    const eksik = { id: "u1", role: "finance" as const };
    const c = alanlariSuz(eksik, "finance");
    expect(Object.keys(c).sort()).toEqual(["id", "role"]);
  });

  it("izin listesinde olmayan bir alan sızmaz", () => {
    const sizinti = { ...tamKayit, passwordHash: "gizli", totpSecret: "gizli" };
    for (const r of ["super_admin", "finance", "operations"] as const) {
      const c = alanlariSuz(sizinti, r);
      expect(c).not.toHaveProperty("passwordHash");
      expect(c).not.toHaveProperty("totpSecret");
    }
  });
});
