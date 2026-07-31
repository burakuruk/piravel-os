import { describe, expect, it } from "vitest";
import {
  AKTIF_DUZENLENEBILIR,
  brutHesapla,
  duzenlenebilirAlanlar,
  finansGorebilirMi,
  gecisGecerliMi,
  netHesapla,
  sozlesmeCsvSutunlari,
  sozlesmeModulunuGorebilirMi,
  sozlesmeSilebilirMi,
  sozlesmeYonetebilirMi,
  SozlesmeKuralHatasi,
  toplamOzeti,
  TUTAR_TEMELI_ETIKET,
} from "@/lib/contract-admin";

/**
 * Sözleşme iş kurallarının SAF parçaları.
 *
 * Veritabanına dokunan kısımlar `verify:contracts` ile gerçek HTTP üzerinden
 * sınanır; burada yalnız hesap ve matris var.
 */

describe("rol matrisi", () => {
  it("MEM sözleşme modülünü hiç göremez", () => {
    expect(sozlesmeModulunuGorebilirMi("member")).toBe(false);
    for (const r of ["super_admin", "finance", "operations"] as const) {
      expect(sozlesmeModulunuGorebilirMi(r)).toBe(true);
    }
  });

  it("yazma SA ve FIN'de", () => {
    expect(sozlesmeYonetebilirMi("super_admin")).toBe(true);
    expect(sozlesmeYonetebilirMi("finance")).toBe(true);
    expect(sozlesmeYonetebilirMi("operations")).toBe(false);
    expect(sozlesmeYonetebilirMi("member")).toBe(false);
  });

  it("silme yalnız SA'da", () => {
    expect(sozlesmeSilebilirMi("super_admin")).toBe(true);
    expect(sozlesmeSilebilirMi("finance")).toBe(false);
  });

  it("OPS finansal alanları göremez", () => {
    expect(finansGorebilirMi("operations")).toBe(false);
    expect(finansGorebilirMi("super_admin")).toBe(true);
    expect(finansGorebilirMi("finance")).toBe(true);
  });
});

describe("durum geçişleri", () => {
  it("izinli geçişler", () => {
    expect(gecisGecerliMi("draft", "active")).toBe(true);
    expect(gecisGecerliMi("draft", "cancelled")).toBe(true);
    expect(gecisGecerliMi("active", "ended")).toBe(true);
    expect(gecisGecerliMi("active", "cancelled")).toBe(true);
  });

  it("kapalı geçişler — numara verilmiş, belge oluşmuş", () => {
    expect(gecisGecerliMi("active", "draft")).toBe(false);
    expect(gecisGecerliMi("ended", "active")).toBe(false);
    expect(gecisGecerliMi("cancelled", "active")).toBe(false);
    expect(gecisGecerliMi("ended", "cancelled")).toBe(false);
  });
});

describe("alan kilidi", () => {
  it("taslakta tutar ve takvim serbest", () => {
    const alanlar = duzenlenebilirAlanlar("draft");
    for (const a of ["enteredAmountMinor", "amountBasis", "billingFrequency", "startDate"]) {
      expect(alanlar).toContain(a);
    }
  });

  it("aktifte tutar, TEMEL, tarih ve sıklık kilitli", () => {
    const alanlar = duzenlenebilirAlanlar("active");
    for (const a of [
      "enteredAmountMinor",
      "amountBasis",
      "billingFrequency",
      "billingInterval",
      "startDate",
      "endDate",
      "currencyCode",
      "installmentCount",
    ]) {
      expect(alanlar).not.toContain(a);
    }
    // Yürürlükteki sözleşmede yalnız bunlar açık
    expect([...alanlar].sort()).toEqual([...AKTIF_DUZENLENEBILIR].sort());
  });

  it("sonlanmış ve iptal edilmiş salt okunur", () => {
    expect(duzenlenebilirAlanlar("ended")).toHaveLength(0);
    expect(duzenlenebilirAlanlar("cancelled")).toHaveLength(0);
  });
});

describe("KDV giriş sözleşmesi (§7b)", () => {
  it("KDV hariç girişte net = girilen", () => {
    expect(netHesapla(4_500_000, false, 20)).toBe(4_500_000);
  });

  it("KDV dahil girişte net ayrıştırılır", () => {
    expect(netHesapla(5_400_000, true, 20)).toBe(4_500_000);
  });

  it("TEKRARLI DÜZENLEME: net ikinci kez netleştirilmez", () => {
    // Kullanıcı brüt girer → net saklanır
    const net = netHesapla(5_400_000, true, 20);
    expect(net).toBe(4_500_000);

    // Sözleşme yeniden açılır; form brüt'ü gösterir ve kullanıcı DEĞİŞTİRMEDEN
    // kaydeder. Sunucu yine `enteredAmountMinor` (brüt) alır ve aynı net'i
    // üretir — mevcut net'i tekrar bölmez.
    const brut = brutHesapla(net, 20);
    expect(brut).toBe(5_400_000);
    expect(netHesapla(brut, true, 20)).toBe(net);

    // Beş tur sonra da kuruş kayması yok
    let d = net;
    for (let i = 0; i < 5; i += 1) d = netHesapla(brutHesapla(d, 20), true, 20);
    expect(d).toBe(net);
  });

  it("sıfır ve negatif tutarı reddeder", () => {
    expect(() => netHesapla(0, false, 20)).toThrow(SozlesmeKuralHatasi);
    expect(() => netHesapla(-100, false, 20)).toThrow(SozlesmeKuralHatasi);
  });
});

describe("toplam ve indirim (§7a)", () => {
  it("beklenen net = kalem toplamı − indirim", () => {
    const o = toplamOzeti(4_600_000, 100_000, 4_500_000);
    expect(o.beklenenNetMinor).toBe(4_500_000);
    expect(o.uyusmazlik).toBe(false);
    expect(o.farkMinor).toBe(0);
  });

  it("indirim İKİNCİ KEZ düşülmez", () => {
    // amountMinor zaten indirimli nettir; formül onu tekrar azaltmaz
    const o = toplamOzeti(4_600_000, 100_000, 4_500_000);
    expect(o.amountMinor).toBe(4_500_000);
    expect(o.beklenenNetMinor).toBe(o.amountMinor);
  });

  it("uyuşmazlık uyarı üretir ama farkı da söyler", () => {
    const o = toplamOzeti(4_700_000, 100_000, 4_500_000);
    expect(o.uyusmazlik).toBe(true);
    expect(o.farkMinor).toBe(100_000);
  });

  it("kalem yoksa uyuşmazlık aranmaz", () => {
    expect(toplamOzeti(0, 0, 4_500_000).uyusmazlik).toBe(false);
  });
});

describe("CSV sütunları", () => {
  it("OPS'ta tutar ve faturalama sütunları YOK", () => {
    const basliklar = sozlesmeCsvSutunlari("operations").map((s) => s.baslik);
    for (const y of ["NET TUTAR", "TUTAR TEMELI", "KDV ORANI", "INDIRIM", "FATURALAMA", "TAKSIT SAYISI"]) {
      expect(basliklar).not.toContain(y);
    }
    expect(basliklar).toContain("NUMARA");
    expect(basliklar).toContain("DURUM");
  });

  it("SA/FIN'de tutar sütununun YANINDA temel sütunu var", () => {
    for (const rol of ["super_admin", "finance"] as const) {
      const basliklar = sozlesmeCsvSutunlari(rol).map((s) => s.baslik);
      expect(basliklar).toContain("NET TUTAR");
      // Tek başına bir rakam dışa aktarılmaz
      expect(basliklar).toContain("TUTAR TEMELI");
      expect(basliklar.indexOf("TUTAR TEMELI")).toBe(basliklar.indexOf("NET TUTAR") + 1);
    }
  });

  it("temel etiketleri okunur", () => {
    expect(TUTAR_TEMELI_ETIKET.per_period).toBeTruthy();
    expect(TUTAR_TEMELI_ETIKET.contract_total).toBeTruthy();
  });
});
