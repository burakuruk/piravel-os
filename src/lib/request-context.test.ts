import { describe, expect, it } from "vitest";
import { testRunIdAcikMi, testRunIdCoz } from "./request-context";

/**
 * Bu kapı bir güven sınırıdır: kapalıyken hiçbir istemci başlığı audit
 * satırlarını etiketleyemez. Testler bayrağın "kazara açılamaz" olduğunu ve
 * kapalıyken başlığın hiç okunmadığını doğrular.
 */

function basliklar(deger: string | null): Headers {
  const h = new Headers();
  if (deger !== null) h.set("x-test-run-id", deger);
  return h;
}

describe("testRunIdAcikMi — kapı yalnız açık niyetle açılır", () => {
  it('yalnız "1" açar', () => {
    expect(testRunIdAcikMi("1")).toBe(true);
  });

  it("tanımsız/boş kapalıdır", () => {
    expect(testRunIdAcikMi(undefined)).toBe(false);
    expect(testRunIdAcikMi(null)).toBe(false);
    expect(testRunIdAcikMi("")).toBe(false);
  });

  it("doğru gibi görünen değerler kapıyı AÇMAZ", () => {
    for (const d of ["true", "TRUE", "yes", "evet", "on", "0", " 1", "1 ", "01"]) {
      expect(testRunIdAcikMi(d)).toBe(false);
    }
  });
});

describe("testRunIdCoz — kapı kapalıyken başlık okunmaz", () => {
  it("kapalıyken geçerli başlık bile null döner", () => {
    expect(testRunIdCoz(basliklar("kosu-123"), false)).toBeNull();
  });

  it("açıkken geçerli başlığı döner", () => {
    expect(testRunIdCoz(basliklar("kosu-123"), true)).toBe("kosu-123");
  });

  it("açık ama başlık yoksa null döner", () => {
    expect(testRunIdCoz(basliklar(null), true)).toBeNull();
  });

  it("başlıksız istek (headers undefined) null döner", () => {
    expect(testRunIdCoz(undefined, true)).toBeNull();
  });
});

describe("testRunIdCoz — açıkken bile başlık temizlenir", () => {
  it("güvenli küme dışındaki karakterler reddedilir", () => {
    // Satır sonu zaten Headers katmanında engellenir (geçersiz başlık değeri),
    // bu yüzden `temizle`'ye hiç ulaşamaz. Buradaki değerler Headers'ın KABUL
    // ettiği ama bizim reddettiklerimiz.
    expect(testRunIdCoz(basliklar("kosu 123"), true)).toBeNull();
    expect(testRunIdCoz(basliklar("kosu;drop"), true)).toBeNull();
    expect(testRunIdCoz(basliklar("kosu/../yonetici"), true)).toBeNull();
    expect(testRunIdCoz(basliklar("<script>"), true)).toBeNull();
  });

  it("satır sonu Headers katmanında engellenir — koda hiç ulaşmaz", () => {
    expect(() => basliklar("kosu\n[ADMIN] sahte kayit")).toThrow();
  });

  it("güvenli karakter kümesi kabul edilir", () => {
    expect(testRunIdCoz(basliklar("kosu_a.b:c-1"), true)).toBe("kosu_a.b:c-1");
  });

  it("aşırı uzun değer 128 karaktere kırpılır", () => {
    const uzun = "a".repeat(300);
    expect(testRunIdCoz(basliklar(uzun), true)).toHaveLength(128);
  });
});
