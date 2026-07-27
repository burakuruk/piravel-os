import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_SIR_BAYT, OrtamSirriHatasi, sirDogrula } from "./env";

/**
 * Bu testler `sirDogrula`'yı doğrudan çağırır — modül seviyesindeki
 * `BETTER_AUTH_SECRET` sabitini değil. Aksi hâlde test dosyasının kendisi
 * ortam değişkenine bağımlı hâle gelir ve doğrulamanın MANTIĞI değil,
 * çalıştıran makinenin `.env`'i test edilmiş olurdu.
 */

const GECERLI = "1sYkAmT8vQ3pZr0LxNfBwHdJgEuCiOaKtMnPqRsUvXy"; // 42 bayt, placeholder değil

describe("sirDogrula — eksik veya boş değer", () => {
  it("tanımsız değeri reddeder", () => {
    expect(() => sirDogrula("TEST_SIR", undefined)).toThrow(OrtamSirriHatasi);
  });

  it("null değeri reddeder", () => {
    expect(() => sirDogrula("TEST_SIR", null)).toThrow(OrtamSirriHatasi);
  });

  it("boş dizeyi reddeder", () => {
    expect(() => sirDogrula("TEST_SIR", "")).toThrow(OrtamSirriHatasi);
  });

  it("yalnız boşluktan oluşan değeri reddeder", () => {
    expect(() => sirDogrula("TEST_SIR", "   \t \n ")).toThrow(OrtamSirriHatasi);
  });
});

describe("sirDogrula — uzunluk kuralı", () => {
  it(`${MIN_SIR_BAYT} bayttan kısa değeri reddeder`, () => {
    expect(() => sirDogrula("TEST_SIR", "a".repeat(MIN_SIR_BAYT - 1))).toThrow(
      OrtamSirriHatasi,
    );
  });

  it(`tam ${MIN_SIR_BAYT} bayt kabul edilir (sınır dahil)`, () => {
    const sinir = "a".repeat(MIN_SIR_BAYT);
    expect(sirDogrula("TEST_SIR", sinir)).toBe(sinir);
  });

  it("uzunluk KARAKTER değil BAYT üzerinden ölçülür", () => {
    // 20 karakter ama çok baytlı: 20 × 3 = 60 bayt → geçer.
    expect(() => sirDogrula("TEST_SIR", "ğ".repeat(20))).not.toThrow();
    // 16 karakter × 2 bayt = 32 bayt → tam sınır, geçer.
    expect(() => sirDogrula("TEST_SIR", "ö".repeat(16))).not.toThrow();
    // 15 karakter × 2 bayt = 30 bayt → sınırın altında, düşer.
    expect(() => sirDogrula("TEST_SIR", "ö".repeat(15))).toThrow(OrtamSirriHatasi);
  });

  it("baştaki/sondaki boşluk kırpılır ve uzunluğa sayılmaz", () => {
    const kisa = " ".repeat(40) + "a".repeat(MIN_SIR_BAYT - 1) + " ".repeat(40);
    expect(() => sirDogrula("TEST_SIR", kisa)).toThrow(OrtamSirriHatasi);
    expect(sirDogrula("TEST_SIR", `  ${GECERLI}  `)).toBe(GECERLI);
  });
});

describe("sirDogrula — repoda yazan placeholder'lar", () => {
  /** Uzunluk kuralını GEÇEN ama sır olmayan, geçmişe commit'lenmiş değerler. */
  const yasakli = [
    "gelistirme-ortami-icin-gecici-anahtar",
    "gelistirme-ortami-icin-32-karakterlik-gecici-anahtar",
  ];

  for (const deger of yasakli) {
    it(`"${deger.slice(0, 24)}…" uzunluğu yetse bile reddedilir`, () => {
      expect(Buffer.byteLength(deger, "utf8")).toBeGreaterThanOrEqual(MIN_SIR_BAYT);
      expect(() => sirDogrula("BETTER_AUTH_SECRET", deger)).toThrow(OrtamSirriHatasi);
    });
  }

  it("kaldırılan kilit pepper fallback'i de reddedilir", () => {
    expect(() => sirDogrula("BETTER_AUTH_SECRET", "gelistirme-pepper")).toThrow(
      OrtamSirriHatasi,
    );
  });
});

describe("sirDogrula — hata mesajı sırrı sızdırmaz", () => {
  it("çok kısa değerin kendisi mesajda geçmez", () => {
    const sir = "kisa-ama-gizli-deger";
    try {
      sirDogrula("TEST_SIR", sir);
      expect.unreachable("doğrulama geçmemeliydi");
    } catch (e) {
      const mesaj = (e as Error).message;
      expect(mesaj).toContain("TEST_SIR");
      expect(mesaj).not.toContain(sir);
    }
  });

  it("placeholder değerin kendisi mesajda geçmez", () => {
    try {
      sirDogrula("TEST_SIR", "gelistirme-ortami-icin-gecici-anahtar");
      expect.unreachable("doğrulama geçmemeliydi");
    } catch (e) {
      expect((e as Error).message).not.toContain("gelistirme-ortami-icin");
    }
  });
});

describe("sirDogrula — geçerli değer", () => {
  it("kırpılmış değeri aynen döner", () => {
    expect(sirDogrula("BETTER_AUTH_SECRET", GECERLI)).toBe(GECERLI);
  });

  it("randomBytes(32) tabanlı base64url değeri kabul eder", () => {
    const uretilmis = Buffer.from(
      Array.from({ length: 32 }, (_, i) => (i * 7 + 13) % 256),
    ).toString("base64url");
    expect(sirDogrula("BETTER_AUTH_SECRET", uretilmis)).toBe(uretilmis);
  });
});

/**
 * Erişimcinin kendisi: her senaryo `resetModules` ile taze bir modül örneği
 * alır — aksi hâlde önbellek testler arasında sızar.
 */
describe("betterAuthSecret() — fail-fast erişimci", () => {
  const oncekiDeger = process.env.BETTER_AUTH_SECRET;

  afterEach(() => {
    if (oncekiDeger === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = oncekiDeger;
    vi.resetModules();
  });

  // Sınıf de taze modülden alınır: `resetModules` sonrası dinamik import ayrı bir
  // modül örneği döner ve oradaki OrtamSirriHatasi, statik import'takiyle aynı
  // kimlik değildir — `toThrow(SinifStatik)` yanlışlıkla düşerdi.
  it("BETTER_AUTH_SECRET tanımsızsa atar — sessiz varsayılana DÜŞMEZ", async () => {
    vi.resetModules();
    delete process.env.BETTER_AUTH_SECRET;
    const taze = await import("./env");
    expect(() => taze.betterAuthSecret()).toThrow(taze.OrtamSirriHatasi);
  });

  it("placeholder değer ayarlıysa atar", async () => {
    vi.resetModules();
    process.env.BETTER_AUTH_SECRET = "gelistirme-ortami-icin-32-karakterlik-gecici-anahtar";
    const taze = await import("./env");
    expect(() => taze.betterAuthSecret()).toThrow(taze.OrtamSirriHatasi);
  });

  it("geçerli değeri döner ve sonraki çağrılarda aynısını verir", async () => {
    vi.resetModules();
    process.env.BETTER_AUTH_SECRET = GECERLI;
    const taze = await import("./env");
    expect(taze.betterAuthSecret()).toBe(GECERLI);
    expect(taze.betterAuthSecret()).toBe(GECERLI);
  });
});
