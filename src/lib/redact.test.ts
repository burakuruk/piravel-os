import { describe, expect, it } from "vitest";
import { isSensitiveKey, redact, REDACTED, redactString, sentryBeforeSend } from "./redact";

describe("redact — hassas alan tespiti (PRD §6.3)", () => {
  it("2FA sırlarını hassas sayar", () => {
    for (const k of [
      "secret",
      "totpSecret",
      "totp_secret",
      "twoFactorSecret",
      "backupCodes",
      "backup_codes",
      "recoveryCodes",
      "recoveryCode",
    ]) {
      expect(isSensitiveKey(k), k).toBe(true);
    }
  });

  it("parola ve token alanlarını hassas sayar", () => {
    for (const k of ["password", "passwordHash", "newPassword", "accessToken", "sessionToken", "apiKey"]) {
      expect(isSensitiveKey(k), k).toBe(true);
    }
  });

  it("IBAN'ı hassas sayar (maskesiz gösterim ayrı yetki ister)", () => {
    expect(isSensitiveKey("iban")).toBe(true);
    expect(isSensitiveKey("ibanEncrypted")).toBe(true);
  });

  it("zararsız alanları hassas SAYMAZ", () => {
    for (const k of ["email", "fullName", "role", "amountMinor", "brandId", "dueDate"]) {
      expect(isSensitiveKey(k), k).toBe(false);
    }
  });
});

describe("redact — nesne temizleme", () => {
  it("TOTP secret ve kurtarma kodlarını atar, diğer alanları korur", () => {
    const out = redact({
      email: "ornek@example.com",
      role: "super_admin",
      totpSecret: "AAAABBBBCCCCDDDD",
      backupCodes: ["test-0001", "test-0002"],
    });
    expect(out.email).toBe("ornek@example.com");
    expect(out.role).toBe("super_admin");
    expect(out.totpSecret).toBe(REDACTED);
    expect(out.backupCodes).toBe(REDACTED);
  });

  it("iç içe nesnelerde de temizler", () => {
    const out = redact({
      user: { name: "Örnek", account: { password: "sahte", provider: "credential" } },
    });
    expect(out.user.account.password).toBe(REDACTED);
    expect(out.user.account.provider).toBe("credential");
  });

  it("dizi içindeki nesneleri temizler", () => {
    const out = redact([{ secret: "x" }, { secret: "y", id: 3 }]);
    expect(out[0].secret).toBe(REDACTED);
    expect(out[1].id).toBe(3);
  });

  it("otpauth:// URI'sini metin içinde bile maskeler", () => {
    const uri = "otpauth://totp/Piravel:test?secret=AAAABBBB&issuer=Piravel";
    expect(redactString(`QR: ${uri} sonu`)).toBe(`QR: ${REDACTED} sonu`);
    expect(redact({ note: `bak ${uri}` }).note).toContain(REDACTED);
    expect(redact({ note: `bak ${uri}` }).note).not.toContain("AAAABBBB");
  });

  it("hata nesnesinin mesaj ve stack'ini temizler", () => {
    const err = new Error("başarısız: otpauth://totp/x?secret=SIR123");
    const out = redact(err);
    expect(out.message).not.toContain("SIR123");
    expect(out.message).toContain(REDACTED);
  });

  it("döngüsel referansta sonsuz döngüye girmez", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
  });
});

describe("redact — Sentry kancası", () => {
  it("olay gövdesindeki sırları temizler", () => {
    const event = {
      message: "2FA kurulumu başarısız",
      request: { data: { password: "sahte", email: "ornek@example.com" } },
      extra: { totpSecret: "AAAABBBB", userId: "u1" },
    };
    const out = sentryBeforeSend(event);
    expect(out.request.data.password).toBe(REDACTED);
    expect(out.request.data.email).toBe("ornek@example.com");
    expect(out.extra.totpSecret).toBe(REDACTED);
    expect(out.extra.userId).toBe("u1");
  });

  it("temizlenen olayda hiçbir yerde ham sır kalmaz", () => {
    const out = sentryBeforeSend({
      breadcrumbs: [{ data: { backupCodes: ["gizli-1"], recoveryCode: "gizli-2" } }],
      contexts: { auth: { secret: "gizli-3" } },
    });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("gizli-1");
    expect(serialized).not.toContain("gizli-2");
    expect(serialized).not.toContain("gizli-3");
  });
});

describe("redact — davet token'ı (Sprint 1 §1)", () => {
  it("davet anahtarlarını hassas sayar", () => {
    for (const k of ["invite", "inviteToken", "invite_token", "inviteUrl", "davetToken"]) {
      expect(isSensitiveKey(k)).toBe(true);
    }
  });

  it("/davet/<token> yolundaki token maskelenir, yol görünür kalır", () => {
    const out = redactString("GET /davet/AbC-123_xyz 200");
    expect(out).toBe(`GET /davet/${REDACTED} 200`);
  });

  it("tam URL içinde de maskelenir", () => {
    const t = "kSm3xQ9-abcDEF_0123456789";
    const out = redactString(`https://piravel.example/davet/${t}?x=1`);
    expect(out).not.toContain(t);
    expect(out).toContain("/davet/");
  });

  it("metinde birden çok davet bağlantısı geçerse hepsi maskelenir", () => {
    const out = redactString("/davet/aaaAAA111 ve /davet/bbbBBB222");
    expect(out).not.toContain("aaaAAA111");
    expect(out).not.toContain("bbbBBB222");
  });

  it("davet gövdesi redact()'ten geçince ham token kalmaz", () => {
    const t = "cokGizliDavetTokeni-123456";
    const out = redact({
      url: `/davet/${t}`,
      inviteToken: t,
      context: { davetToken: t },
    });
    expect(JSON.stringify(out)).not.toContain(t);
  });

  it("benzeyen ama farklı yollar bozulmaz", () => {
    expect(redactString("/davetler")).toBe("/davetler");
    expect(redactString("/api/v1/davet")).toBe("/api/v1/davet");
  });
});
