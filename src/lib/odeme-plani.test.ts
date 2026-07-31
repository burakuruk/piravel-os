import { describe, expect, it } from "vitest";
import { allocateMinor } from "@/lib/money";
import {
  odemePlaniOnizle,
  OdemePlaniHatasi,
  PLAN_UST_SINIR,
  type OdemePlaniGirdisi,
} from "@/lib/odeme-plani";

/**
 * Ödeme planı motoru — plan §8 ve §3e-1'in kalıcı testleri.
 *
 * En kritik değişmez: `Σ satır` saklanan sözleşme anlamıyla BİREBİR eşittir.
 * Net, KDV ve brüt için ayrı ayrı sınanır; brütün bağımsız yuvarlanmadığı da
 * buradan anlaşılır.
 */

const TEMEL: OdemePlaniGirdisi = {
  amountMinor: 4_500_000, // 45.000,00 ₺
  amountBasis: "per_period",
  vatRatePercent: 20,
  billingFrequency: "monthly",
  billingInterval: 1,
  startDate: "2026-04-01",
  endDate: "2027-03-31",
  firstDueDate: "2026-04-30",
  paymentDay: 31,
  installmentCount: null,
};

function plan(uzer: Partial<OdemePlaniGirdisi> = {}) {
  return odemePlaniOnizle({ ...TEMEL, ...uzer });
}

describe("allocateMinor — kuruş dağıtımı", () => {
  it("tam bölünen tutarı eşit paylaştırır", () => {
    expect(allocateMinor(6_000_000, 3)).toEqual([2_000_000, 2_000_000, 2_000_000]);
  });

  it("kalanı SON parçaya yükler", () => {
    expect(allocateMinor(10_000_000, 3)).toEqual([3_333_333, 3_333_333, 3_333_334]);
  });

  it("her durumda toplamı korur", () => {
    for (const toplam of [1, 7, 99, 100_000_001, 123_456_789]) {
      for (const n of [1, 2, 3, 7, 12, 120]) {
        const parcalar = allocateMinor(toplam, n);
        expect(parcalar).toHaveLength(n);
        expect(parcalar.reduce((a, b) => a + b, 0)).toBe(toplam);
      }
    }
  });

  it("negatif tutarı ve geçersiz parça sayısını reddeder", () => {
    expect(() => allocateMinor(-1, 3)).toThrow(RangeError);
    expect(() => allocateMinor(100, 0)).toThrow(RangeError);
  });
});

describe("per_period — dönemlik tutar tekrar eder", () => {
  it("12 dönem üretir ve toplam = tutar × dönem", () => {
    const p = plan();
    expect(p.satirlar).toHaveLength(12);
    expect(p.satirlar.every((s) => s.netMinor === 4_500_000)).toBe(true);
    expect(p.toplam.netMinor).toBe(4_500_000 * 12);
    expect(p.toplam.kdvMinor).toBe(900_000 * 12);
    expect(p.toplam.brutMinor).toBe(5_400_000 * 12);
    expect(p.sinirliOnizleme).toBe(false);
  });

  it("ay sonu kuralı: hedef gün kırpılır ama TAŞINMAZ", () => {
    // Vade günü 31; 31'i olmayan aylarda ayın son günü kullanılır ve bir
    // sonraki ay yine 31'e döner.
    const p = plan();
    expect(p.satirlar.map((s) => s.vadeTarihi)).toEqual([
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("süresiz sözleşmede ilk 12 dönemi ÖRNEK olarak verir", () => {
    const p = plan({ endDate: null, installmentCount: null });
    expect(p.satirlar).toHaveLength(12);
    expect(p.sinirliOnizleme).toBe(true);
  });
});

describe("contract_total — toplam taksitlere bölünür", () => {
  const toplamTemel: Partial<OdemePlaniGirdisi> = {
    amountBasis: "contract_total",
    installmentCount: 3,
    endDate: null,
    firstDueDate: "2026-06-30",
    paymentDay: 31,
  };

  it("tam bölünen tutarda eşit taksit üretir", () => {
    const p = plan({ ...toplamTemel, amountMinor: 6_000_000 });
    expect(p.satirlar.map((s) => s.netMinor)).toEqual([2_000_000, 2_000_000, 2_000_000]);
    expect(p.satirlar.map((s) => s.kdvMinor)).toEqual([400_000, 400_000, 400_000]);
    expect(p.toplam.netMinor).toBe(6_000_000);
    expect(p.toplam.kdvMinor).toBe(1_200_000);
    expect(p.toplam.brutMinor).toBe(7_200_000);
  });

  it("bölünmeyen tutarda kalan kuruş SON taksite gider — üç toplam da birebir", () => {
    // 100.000,00 ₺ / 3 → 33.333,33 + 33.333,33 + 33.333,34
    // KDV 20.000,00 / 3 →  6.666,66 +  6.666,66 +  6.666,68
    const p = plan({ ...toplamTemel, amountMinor: 10_000_000 });

    expect(p.satirlar.map((s) => s.netMinor)).toEqual([3_333_333, 3_333_333, 3_333_334]);
    expect(p.satirlar.map((s) => s.kdvMinor)).toEqual([666_666, 666_666, 666_668]);
    expect(p.satirlar.map((s) => s.brutMinor)).toEqual([3_999_999, 3_999_999, 4_000_002]);

    // Üç eşitlik birden (plan §3e-1)
    expect(p.toplam.netMinor).toBe(10_000_000);
    expect(p.toplam.kdvMinor).toBe(2_000_000);
    expect(p.toplam.brutMinor).toBe(12_000_000);
  });

  it("KDV taksit başına ayrı yuvarlanmaz", () => {
    // Satır başına hesaplansaydı: round(3.333.333 × 0,20) = 666.667 ×3
    // = 2.000.001 ≠ 2.000.000. Sözleşme seviyesinden bölündüğü için tutuyor.
    const p = plan({ ...toplamTemel, amountMinor: 10_000_000 });
    expect(p.toplam.kdvMinor).not.toBe(666_667 * 3);
    expect(p.toplam.kdvMinor).toBe(2_000_000);
  });

  it("sınırsız (taksit yok, bitiş yok) reddedilir", () => {
    expect(() =>
      plan({ amountBasis: "contract_total", installmentCount: null, endDate: null }),
    ).toThrow(OdemePlaniHatasi);
  });
});

describe("one_time — tam 1 satır", () => {
  it("taksit ve bitiş aranmadan tek satır üretir", () => {
    const p = plan({
      billingFrequency: "one_time",
      amountBasis: "contract_total",
      installmentCount: null,
      endDate: null,
      amountMinor: 350_000,
    });
    expect(p.satirlar).toHaveLength(1);
    expect(p.satirlar[0]!.netMinor).toBe(350_000);
    expect(p.toplam.netMinor).toBe(350_000);
    expect(p.sinirliOnizleme).toBe(false);
  });
});

describe("bitiş kuralları", () => {
  it("taksit sayısı belirtilen kadar satır üretir", () => {
    expect(plan({ installmentCount: 5 }).satirlar).toHaveLength(5);
  });

  it("ikisi de doluysa ÖNCE ULAŞILAN sınırda durur", () => {
    // 12 dönem sığıyor ama taksit sayısı 4
    expect(plan({ installmentCount: 4 }).satirlar).toHaveLength(4);
    // Taksit sayısı 24 ama bitiş 12 döneme izin veriyor
    expect(plan({ installmentCount: 24 }).satirlar).toHaveLength(12);
  });

  it("üç aylık ve yıllık adımlar", () => {
    const ucAylik = plan({ billingFrequency: "quarterly", installmentCount: 4, endDate: null });
    expect(ucAylik.satirlar.map((s) => s.vadeTarihi)).toEqual([
      "2026-04-30",
      "2026-07-31",
      "2026-10-31",
      "2027-01-31",
    ]);

    const yillik = plan({ billingFrequency: "yearly", installmentCount: 2, endDate: null });
    expect(yillik.satirlar.map((s) => s.vadeTarihi)).toEqual(["2026-04-30", "2027-04-30"]);
  });

  it("billingInterval dönem atlar", () => {
    const p = plan({ billingInterval: 2, installmentCount: 3, endDate: null });
    expect(p.satirlar.map((s) => s.vadeTarihi)).toEqual([
      "2026-04-30",
      "2026-06-30",
      "2026-08-31",
    ]);
  });
});

describe("120 satır üst sınırı", () => {
  it("tam sınırda geçer", () => {
    const p = plan({ installmentCount: PLAN_UST_SINIR, endDate: null });
    expect(p.satirlar).toHaveLength(PLAN_UST_SINIR);
  });

  it("sınırın üstünde PREVIEW_TOO_LONG ile reddeder — liste KESİLMEZ", () => {
    try {
      plan({ installmentCount: PLAN_UST_SINIR + 1, endDate: null });
      throw new Error("hata bekleniyordu");
    } catch (e) {
      expect(e).toBeInstanceOf(OdemePlaniHatasi);
      expect((e as OdemePlaniHatasi).code).toBe("PREVIEW_TOO_LONG");
    }
  });

  it("uzak bitiş tarihinde de reddeder (her iki temelde)", () => {
    const uzak = { endDate: "2050-12-31", installmentCount: null };
    expect(() => plan(uzak)).toThrow(OdemePlaniHatasi);
    expect(() =>
      plan({ ...uzak, amountBasis: "contract_total", amountMinor: 10_000_000 }),
    ).toThrow(OdemePlaniHatasi);
  });
});

describe("ilk vade türetimi", () => {
  it("firstDueDate paymentDay'den önceliklidir", () => {
    const p = plan({ firstDueDate: "2026-04-15", paymentDay: 5, installmentCount: 2, endDate: null });
    // İlk satır firstDueDate; sonraki satırlar paymentDay çapasına döner
    expect(p.satirlar[0]!.vadeTarihi).toBe("2026-04-15");
    expect(p.satirlar[1]!.vadeTarihi).toBe("2026-05-05");
  });

  it("firstDueDate yoksa paymentDay başlangıç ayına uygulanır", () => {
    const p = plan({
      firstDueDate: null,
      paymentDay: 15,
      startDate: "2026-04-01",
      installmentCount: 2,
      endDate: null,
    });
    expect(p.satirlar.map((s) => s.vadeTarihi)).toEqual(["2026-04-15", "2026-05-15"]);
  });

  it("paymentDay başlangıçtan önceye düşerse sonraki döneme kayar", () => {
    const p = plan({
      firstDueDate: null,
      paymentDay: 5,
      startDate: "2026-04-20",
      installmentCount: 2,
      endDate: null,
    });
    expect(p.satirlar.map((s) => s.vadeTarihi)).toEqual(["2026-05-05", "2026-06-05"]);
  });

  it("firstDueDate başlangıçtan önce olamaz", () => {
    expect(() => plan({ firstDueDate: "2026-03-01" })).toThrow(OdemePlaniHatasi);
  });
});

describe("girdi doğrulaması", () => {
  it("sıfır ve negatif tutarı reddeder", () => {
    expect(() => plan({ amountMinor: 0 })).toThrow(OdemePlaniHatasi);
    expect(() => plan({ amountMinor: -1 })).toThrow(OdemePlaniHatasi);
  });

  it("aralık dışı billingInterval'i reddeder", () => {
    expect(() => plan({ billingInterval: 0 })).toThrow(OdemePlaniHatasi);
    expect(() => plan({ billingInterval: 13 })).toThrow(OdemePlaniHatasi);
  });

  it("bozuk tarihi reddeder", () => {
    expect(() => plan({ startDate: "2026-13-01" })).toThrow(OdemePlaniHatasi);
    expect(() => plan({ startDate: "2026-02-30" })).toThrow(OdemePlaniHatasi);
  });

  it("KDV 0 olduğunda brüt = net", () => {
    const p = plan({ vatRatePercent: 0, installmentCount: 2, endDate: null });
    expect(p.toplam.kdvMinor).toBe(0);
    expect(p.toplam.brutMinor).toBe(p.toplam.netMinor);
  });
});
