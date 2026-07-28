import { describe, expect, it } from "vitest";
import { BILINMEYEN_CIHAZ, cihazOzeti } from "./cihaz-ozeti";

/**
 * Cihaz özeti bir KİMLİK DEĞİLDİR; yanlış bir tahmin kullanıcının yabancı bir
 * oturumu kendisininki sanmasına yol açabilir. Bu yüzden çözümlenemeyen her
 * değer açıkça "Bilinmeyen cihaz" olmalı — uydurulmamalı.
 */

describe("cihazOzeti — tarayıcı ve işletim sistemi", () => {
  const ornekler: Array<[string, string]> = [
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Chrome · Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Safari · macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Safari · iPhone",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Firefox · Linux",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      "Chrome · Android",
    ],
  ];

  for (const [ua, beklenen] of ornekler) {
    it(`"${beklenen}" olarak özetlenir`, () => {
      expect(cihazOzeti(ua)).toBe(beklenen);
    });
  }
});

describe("cihazOzeti — kendini başkası gibi tanıtan tarayıcılar", () => {
  it("Edge, Chrome olarak raporlanmaz", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0";
    expect(cihazOzeti(ua)).toBe("Edge · Windows");
  });

  it("Opera, Chrome olarak raporlanmaz", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 OPR/106.0";
    expect(cihazOzeti(ua)).toBe("Opera · Windows");
  });

  it("Chrome, Safari olarak raporlanmaz", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    expect(cihazOzeti(ua)).toBe("Chrome · macOS");
  });
});

describe("cihazOzeti — çözümlenemeyen değerler UYDURULMAZ", () => {
  it("boş ve geçersiz girdiler bilinmeyen döner", () => {
    for (const d of [null, undefined, "", "   ", "curl/8.4.0", "PostmanRuntime/7.36"]) {
      expect(cihazOzeti(d as string)).toBe(BILINMEYEN_CIHAZ);
    }
  });

  it("yalnız işletim sistemi tanınıyorsa onu döner", () => {
    expect(cihazOzeti("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
  });

  it("aşırı uzun User-Agent güvenle kırpılır", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) " + "x".repeat(5000) + " Chrome/120.0";
    // 512 karakterden sonrası okunmaz: Chrome eki kırpılır, OS kalır
    expect(cihazOzeti(ua)).toBe("Windows");
  });

  it("kullanıcı adı gibi görünen serbest metin kimlik olarak yorumlanmaz", () => {
    expect(cihazOzeti("admin@example.com cihazı")).toBe(BILINMEYEN_CIHAZ);
  });
});
