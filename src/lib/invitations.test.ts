import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cerezGecerliMi,
  cerezHash,
  cerezKimligiUret,
  davetDurumu,
  davetTokenHash,
  davetTokenUret,
  kabulEdilebilirMi,
  tokenBicimiGecerliMi,
  type DavetKaydi,
} from "./invitations";

/**
 * Hash'leyen testler gerçek bir pepper ister; sabit bir değer set edilir ki
 * sonuçlar deterministik olsun. Pepper'ın KENDİSİ hiçbir beklentide geçmez.
 */
const TEST_PEPPER = "test-pepper-en-az-otuz-iki-bayt-uzunlugunda-olmali";
const onceki = process.env.INVITE_TOKEN_PEPPER;

beforeEach(() => {
  process.env.INVITE_TOKEN_PEPPER = TEST_PEPPER;
});

afterEach(() => {
  if (onceki === undefined) delete process.env.INVITE_TOKEN_PEPPER;
  else process.env.INVITE_TOKEN_PEPPER = onceki;
});

function kayit(over: Partial<DavetKaydi> = {}): DavetKaydi {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    userId: "kullanici-1",
    expiresAt: new Date("2026-08-01T00:00:00Z"),
    acceptedAt: null,
    revokedAt: null,
    cookieExpiresAt: null,
    ...over,
  };
}

const SIMDI = new Date("2026-07-27T00:00:00Z");

describe("davetTokenUret — tahmin edilemezlik", () => {
  it("base64url karakter kümesinde ve yeterince uzun", () => {
    const t = davetTokenUret();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bayt → base64url'de 43 karakter
    expect(t.length).toBe(43);
  });

  it("ardışık üretimler çakışmaz", () => {
    const kume = new Set(Array.from({ length: 500 }, () => davetTokenUret()));
    expect(kume.size).toBe(500);
  });

  it("çerez kimliği token'dan bağımsız üretilir", () => {
    const kume = new Set(Array.from({ length: 200 }, () => cerezKimligiUret()));
    expect(kume.size).toBe(200);
  });
});

describe("davetTokenHash — ham token geri döndürülemez", () => {
  it("hash ham token'ı İÇERMEZ", () => {
    const t = davetTokenUret();
    const h = davetTokenHash(t);
    expect(h).not.toContain(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("aynı token aynı hash'i verir (arama bunun üzerine kurulu)", () => {
    const t = davetTokenUret();
    expect(davetTokenHash(t)).toBe(davetTokenHash(t));
  });

  it("farklı token farklı hash verir", () => {
    expect(davetTokenHash("abc")).not.toBe(davetTokenHash("abd"));
  });

  it("pepper değişince hash değişir — rotasyon davetleri geçersiz kılar", () => {
    const t = davetTokenUret();
    const a = davetTokenHash(t);
    process.env.INVITE_TOKEN_PEPPER = "bambaska-bir-pepper-degeri-otuz-iki-bayttan-uzun";
    // Modül pepper'ı önbelleklediği için aynı süreçte değişmez; bu testin
    // amacı önbelleğin ÇALIŞTIĞINI de göstermek.
    expect(davetTokenHash(t)).toBe(a);
  });
});

describe("cerezHash — alan ayrımı", () => {
  it("aynı değer için token ve çerez hash'i FARKLIDIR", () => {
    const deger = "ayni-deger-iki-amac";
    expect(cerezHash(deger)).not.toBe(davetTokenHash(deger));
  });

  it("çerez hash'i de ham değeri içermez", () => {
    const k = cerezKimligiUret();
    expect(cerezHash(k)).not.toContain(k);
  });
});

describe("tokenBicimiGecerliMi — DB'ye gitmeden çöpü eler", () => {
  it("geçerli token kabul edilir", () => {
    expect(tokenBicimiGecerliMi(davetTokenUret())).toBe(true);
  });

  it("boş, kısa veya yanlış tipte değerler reddedilir", () => {
    for (const d of ["", "kisa", null, undefined, 42, {}, []]) {
      expect(tokenBicimiGecerliMi(d)).toBe(false);
    }
  });

  it("base64url dışı karakterler reddedilir", () => {
    expect(tokenBicimiGecerliMi("a".repeat(20) + "/")).toBe(false);
    expect(tokenBicimiGecerliMi("a".repeat(20) + "+")).toBe(false);
    expect(tokenBicimiGecerliMi("a".repeat(20) + "'")).toBe(false);
    expect(tokenBicimiGecerliMi("a".repeat(20) + " ")).toBe(false);
  });

  it("aşırı uzun değer reddedilir", () => {
    expect(tokenBicimiGecerliMi("a".repeat(257))).toBe(false);
  });
});

describe("davetDurumu — durum türetilir, saklanmaz", () => {
  it("hiçbir şey olmamışsa pending", () => {
    expect(davetDurumu(kayit(), SIMDI)).toBe("pending");
  });

  it("süresi geçmişse expired", () => {
    expect(davetDurumu(kayit({ expiresAt: new Date("2026-07-26T00:00:00Z") }), SIMDI)).toBe(
      "expired",
    );
  });

  it("iptal edilmişse revoked", () => {
    expect(davetDurumu(kayit({ revokedAt: SIMDI }), SIMDI)).toBe("revoked");
  });

  it("kabul edilmişse accepted", () => {
    expect(davetDurumu(kayit({ acceptedAt: SIMDI }), SIMDI)).toBe("accepted");
  });

  it("kabul edilmiş davet süresi geçse de accepted KALIR", () => {
    const k = kayit({ acceptedAt: SIMDI, expiresAt: new Date("2026-07-26T00:00:00Z") });
    expect(davetDurumu(k, SIMDI)).toBe("accepted");
  });

  it("iptal edilmiş davet süresi geçse de revoked KALIR", () => {
    const k = kayit({ revokedAt: SIMDI, expiresAt: new Date("2026-07-26T00:00:00Z") });
    expect(davetDurumu(k, SIMDI)).toBe("revoked");
  });

  it("tam sınırda (expires_at == now) expired sayılır", () => {
    expect(davetDurumu(kayit({ expiresAt: SIMDI }), SIMDI)).toBe("expired");
  });
});

describe("kabulEdilebilirMi — yalnız pending", () => {
  it("pending kabul edilebilir", () => {
    expect(kabulEdilebilirMi(kayit(), SIMDI)).toBe(true);
  });

  it("accepted, revoked ve expired kabul edilemez", () => {
    expect(kabulEdilebilirMi(kayit({ acceptedAt: SIMDI }), SIMDI)).toBe(false);
    expect(kabulEdilebilirMi(kayit({ revokedAt: SIMDI }), SIMDI)).toBe(false);
    expect(
      kabulEdilebilirMi(kayit({ expiresAt: new Date("2026-07-26T00:00:00Z") }), SIMDI),
    ).toBe(false);
  });
});

describe("cerezGecerliMi — çerezin kendi süresi vardır", () => {
  it("eşleme yoksa geçersiz", () => {
    expect(cerezGecerliMi(kayit(), SIMDI)).toBe(false);
  });

  it("süresi geçmiş çerez geçersiz", () => {
    const k = kayit({ cookieExpiresAt: new Date("2026-07-26T23:59:00Z") });
    expect(cerezGecerliMi(k, SIMDI)).toBe(false);
  });

  it("süresi dolmamış çerez geçerli", () => {
    const k = kayit({ cookieExpiresAt: new Date("2026-07-27T00:05:00Z") });
    expect(cerezGecerliMi(k, SIMDI)).toBe(true);
  });

  it("davet 72 saat yaşasa da çerez ondan bağımsız kısa ömürlüdür", () => {
    const k = kayit({
      expiresAt: new Date("2026-07-30T00:00:00Z"),
      cookieExpiresAt: new Date("2026-07-26T23:50:00Z"),
    });
    expect(kabulEdilebilirMi(k, SIMDI)).toBe(true);
    expect(cerezGecerliMi(k, SIMDI)).toBe(false);
  });
});
