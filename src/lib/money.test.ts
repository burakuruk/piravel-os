import { describe, expect, it } from "vitest";
import {
  add,
  compare,
  CurrencyMismatchError,
  extractNetFromGross,
  formatMoney,
  InvalidAmountError,
  money,
  parseMoneyInput,
  subtract,
  taxMinor,
  toBaseMinor,
  txToObligationMinor,
} from "./money";

describe("money — temel aritmetik", () => {
  it("aynı para biriminde toplar ve çıkarır", () => {
    expect(add(money(1000, "TRY"), money(250, "TRY")).amountMinor).toBe(1250);
    expect(subtract(money(1000, "TRY"), money(250, "TRY")).amountMinor).toBe(750);
  });

  it("farklı para birimlerini doğrudan işleme sokmayı REDDEDER", () => {
    expect(() => add(money(1000, "TRY"), money(1000, "USD"))).toThrow(CurrencyMismatchError);
    expect(() => compare(money(1, "EUR"), money(1, "USD"))).toThrow(CurrencyMismatchError);
  });

  it("float tutarı reddeder (kuruş integer kuralı)", () => {
    expect(() => money(10.5, "TRY")).toThrow(InvalidAmountError);
    expect(() => money(NaN, "TRY")).toThrow(InvalidAmountError);
  });
});

describe("money — kur çevrimi (şema Karar 1)", () => {
  it("baz tutarı doğru yuvarlar: 1.000,00 USD × 34,20 = 34.200,00 TL", () => {
    expect(toBaseMinor(100_000, 34.2)).toBe(3_420_000);
  });

  it("küsuratlı kuru yarım kuruşta doğru yuvarlar", () => {
    // 1,00 USD × 35,4167 = 35,4167 TL → 3542 kuruş (35,42 TL)
    expect(toBaseMinor(100, 35.4167)).toBe(3542);
  });

  it("çapraz eşleştirme: 42.500 TL ÷ 35,42 ≈ 1.199,89 USD (şema §18.1 mantığı)", () => {
    expect(txToObligationMinor(4_250_000, 35.4167)).toBe(120_000); // tam 1.200,00 USD
  });

  it("pozitif olmayan kuru reddeder", () => {
    expect(() => toBaseMinor(100, 0)).toThrow(RangeError);
    expect(() => toBaseMinor(100, -1)).toThrow(RangeError);
  });
});

describe("money — vergi hesabı (şema §9.4)", () => {
  it("KDV %20: 30.000,00 TL net → 6.000,00 TL KDV", () => {
    expect(taxMinor(3_000_000, 20)).toBe(600_000);
  });

  it("tevkifat matematiği: KDV'nin 9/10'u (işaret çağıranda)", () => {
    const kdv = taxMinor(1_000_000, 20); // 200.000
    expect(Math.round((kdv * 9) / 10)).toBe(180_000); // şema §9.4 örneğiyle birebir
  });

  it("KDV dahil girişten net ayrıştırır: 36.000 TL dahil → 30.000 TL net", () => {
    expect(extractNetFromGross(3_600_000, 20)).toBe(3_000_000);
  });

  it("küsuratta simetri: net→brüt→net kaybı en fazla 1 kuruş", () => {
    const net = 999_999; // 9.999,99 TL
    const gross = net + taxMinor(net, 20);
    expect(Math.abs(extractNetFromGross(gross, 20) - net)).toBeLessThanOrEqual(1);
  });
});

describe("money — format (06 §10.1)", () => {
  it("TR biçimi, sembol sonda, kuruş daima: 3.650.000 → '36.500,00 ₺'", () => {
    expect(formatMoney(3_650_000, "TRY")).toBe("36.500,00 ₺");
  });

  it("USD: 120.000 → '1.200,00 $'", () => {
    expect(formatMoney(120_000, "USD")).toBe("1.200,00 $");
  });

  it("negatif: − işareti, parantez değil", () => {
    expect(formatMoney(-123_456, "TRY")).toBe("−1.234,56 ₺");
  });

  it("sıfır: '0,00 ₺' (— değil; sıfır/boş ayrımı UI'da)", () => {
    expect(formatMoney(0, "TRY")).toBe("0,00 ₺");
  });
});

describe("money — kullanıcı girişi", () => {
  it("'1.234,56' → 123456", () => {
    expect(parseMoneyInput("1.234,56")).toBe(123_456);
  });

  it("'30000' → 3000000 (kuruşsuz giriş tam lira)", () => {
    expect(parseMoneyInput("30000")).toBe(3_000_000);
  });

  it("geçersiz girişi reddeder", () => {
    expect(() => parseMoneyInput("abc")).toThrow(InvalidAmountError);
    expect(() => parseMoneyInput("1,2,3")).toThrow(InvalidAmountError);
  });
});
