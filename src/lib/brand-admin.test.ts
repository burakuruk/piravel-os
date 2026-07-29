import { describe, expect, it } from "vitest";
import {
  atamaYonetebilirMi,
  atanabilirMi,
  gecerliKodMu,
  hizmetKatalogunuYonetebilirMi,
  kodNormalize,
  MARKA_GORUNUR_ALANLAR,
  markaAlanlariniSuz,
  markaCsvSutunlari,
  markaGuncellemeAlanlariniSuz,
  markaHizmetBagiYonetebilirMi,
  markaModulunuGorebilirMi,
  markaSilebilirMi,
  markaYonetebilirMi,
} from "./brand-admin";
import { USER_ROLES } from "./auth-policy";

describe("kodNormalize", () => {
  it("trim + büyük harf uygular", () => {
    expect(kodNormalize("  svz  ")).toBe("SVZ");
    expect(kodNormalize("Svz")).toBe("SVZ");
  });

  it("aynı kodun farklı yazımları TEK değere iner", () => {
    const hepsi = ["svz", "SVZ", " Svz ", "sVz"].map(kodNormalize);
    expect(new Set(hepsi).size).toBe(1);
  });

  it("yerelden bağımsızdır — 'i' noktalı büyük harfe dönüşmez", () => {
    // toLocaleUpperCase('tr') "İ" verirdi; kod ASCII kalmalı
    expect(kodNormalize("piravel")).toBe("PIRAVEL");
    expect(kodNormalize("piravel")).not.toContain("İ");
  });

  it("metin olmayan girdide boş döner", () => {
    for (const d of [null, undefined, 42, {}, []]) expect(kodNormalize(d)).toBe("");
  });
});

describe("gecerliKodMu", () => {
  it("harf, rakam ve tire kabul eder", () => {
    for (const k of ["SVZ", "TKL2", "A1", "ORN-MIM", "ABCDEFGHIJKLMNOP"]) {
      expect(gecerliKodMu(k)).toBe(true);
    }
  });

  it("çok kısa, çok uzun ve boşluklu kodları reddeder", () => {
    for (const k of ["", "A", "A".repeat(17), "AB CD", "A_B", "ŞVZ"]) {
      expect(gecerliKodMu(k)).toBe(false);
    }
  });

  it("küçük harfli kodu reddeder — normalizasyon ÖNCE çalışmalı", () => {
    expect(gecerliKodMu("svz")).toBe(false);
    expect(gecerliKodMu(kodNormalize("svz"))).toBe(true);
  });

  it("tire başta veya sonda olamaz", () => {
    expect(gecerliKodMu("-SVZ")).toBe(false);
    expect(gecerliKodMu("SVZ-")).toBe(false);
  });
});

describe("Rol kapıları", () => {
  it("MEM marka modülüne hiç erişemez", () => {
    expect(markaModulunuGorebilirMi("member")).toBe(false);
    for (const r of ["super_admin", "finance", "operations"] as const) {
      expect(markaModulunuGorebilirMi(r)).toBe(true);
    }
  });

  it("marka oluşturma/düzenleme SA ve FIN'de", () => {
    expect(markaYonetebilirMi("super_admin")).toBe(true);
    expect(markaYonetebilirMi("finance")).toBe(true);
    expect(markaYonetebilirMi("operations")).toBe(false);
    expect(markaYonetebilirMi("member")).toBe(false);
  });

  it("silme/geri yükleme yalnız SA'da", () => {
    expect(markaSilebilirMi("super_admin")).toBe(true);
    for (const r of ["finance", "operations", "member"] as const) {
      expect(markaSilebilirMi(r)).toBe(false);
    }
  });

  it("ekip ataması YALNIZ SA'da — atama bir yetki devridir", () => {
    expect(atamaYonetebilirMi("super_admin")).toBe(true);
    for (const r of ["finance", "operations", "member"] as const) {
      expect(atamaYonetebilirMi(r)).toBe(false);
    }
  });

  it("hizmet kataloğu yazma YALNIZ SA'da — FIN salt okuma", () => {
    expect(hizmetKatalogunuYonetebilirMi("super_admin")).toBe(true);
    for (const r of ["finance", "operations", "member"] as const) {
      expect(hizmetKatalogunuYonetebilirMi(r)).toBe(false);
    }
  });

  it("markaya hizmet BAĞLAMA katalogdan ayrıdır — OPS de yapabilir", () => {
    for (const r of ["super_admin", "finance", "operations"] as const) {
      expect(markaHizmetBagiYonetebilirMi(r)).toBe(true);
    }
    expect(markaHizmetBagiYonetebilirMi("member")).toBe(false);
  });
});

describe("atanabilirMi — markaya yalnız OPS atanır", () => {
  it("yalnız operations true döner", () => {
    expect(atanabilirMi("operations")).toBe(true);
    for (const r of ["super_admin", "finance", "member"] as const) {
      expect(atanabilirMi(r)).toBe(false);
    }
  });

  it("tanımlı dört rolün tam olarak biri atanabilir", () => {
    expect(USER_ROLES.filter(atanabilirMi)).toEqual(["operations"]);
  });
});

describe("markaAlanlariniSuz — vergi alanları OPS'a gitmez", () => {
  const kayit = {
    id: "1",
    code: "SVZ",
    name: "Sahte Vize",
    legalName: "Sahte Vize Ltd.",
    taxNumber: "1234567890",
    taxOffice: "Örnek VD",
    industry: "Danışmanlık",
    email: "info@example.com",
    phone: "+90",
    address: "adres",
    website: null,
    status: "active",
    onboardedAt: null,
    churnedAt: null,
    notes: null,
    createdAt: new Date(),
    hizmetSayisi: 3,
    ekipSayisi: 2,
    birincilYetkili: "Sahte Yetkili",
  };

  it("OPS yanıtında vergi no ve vergi dairesi YOKTUR", () => {
    const suzulmus = markaAlanlariniSuz(kayit, "operations");
    expect("taxNumber" in suzulmus).toBe(false);
    expect("taxOffice" in suzulmus).toBe(false);
  });

  it("OPS operasyonel alanları görmeye devam eder", () => {
    const suzulmus = markaAlanlariniSuz(kayit, "operations");
    for (const alan of ["code", "name", "industry", "email", "phone", "hizmetSayisi"]) {
      expect(alan in suzulmus).toBe(true);
    }
  });

  it("SA ve FIN vergi alanlarını görür", () => {
    for (const r of ["super_admin", "finance"] as const) {
      const suzulmus = markaAlanlariniSuz(kayit, r);
      expect(suzulmus.taxNumber).toBe("1234567890");
      expect(suzulmus.taxOffice).toBe("Örnek VD");
    }
  });

  it("MEM için gövde tamamen boştur", () => {
    expect(markaAlanlariniSuz(kayit, "member")).toEqual({});
  });

  it("izin listesinde olmayan bir alan sızmaz", () => {
    const kirli = { ...kayit, gizliFinansAlani: 999 };
    for (const r of ["super_admin", "finance", "operations"] as const) {
      expect("gizliFinansAlani" in markaAlanlariniSuz(kirli, r)).toBe(false);
    }
  });

  it("vergi alanları hiçbir OPS izin listesinde tanımlı değil", () => {
    for (const alan of ["taxNumber", "taxOffice"]) {
      expect(MARKA_GORUNUR_ALANLAR.operations).not.toContain(alan);
      expect(MARKA_GORUNUR_ALANLAR.super_admin).toContain(alan);
      expect(MARKA_GORUNUR_ALANLAR.finance).toContain(alan);
    }
  });
});

describe("markaGuncellemeAlanlariniSuz", () => {
  const govde = {
    name: "Yeni ad",
    phone: "+90",
    taxNumber: "9999999999",
    taxOffice: "Başka VD",
    code: "YENI",
    status: "churned",
  };

  it("OPS vergi alanlarını GÜNCELLEYEMEZ — gövdeden düşer", () => {
    const izinli = markaGuncellemeAlanlariniSuz(govde, "operations");
    expect("taxNumber" in izinli).toBe(false);
    expect("taxOffice" in izinli).toBe(false);
    expect(izinli.name).toBe("Yeni ad");
    expect(izinli.phone).toBe("+90");
  });

  it("SA/FIN vergi alanlarını güncelleyebilir", () => {
    for (const r of ["super_admin", "finance"] as const) {
      const izinli = markaGuncellemeAlanlariniSuz(govde, r);
      expect(izinli.taxNumber).toBe("9999999999");
    }
  });

  it("code HİÇBİR rolde güncellenebilir alan değildir", () => {
    for (const r of ["super_admin", "finance", "operations"] as const) {
      expect("code" in markaGuncellemeAlanlariniSuz(govde, r)).toBe(false);
    }
  });

  it("durum bu uçtan değiştirilemez — ayrı ucu var", () => {
    for (const r of ["super_admin", "finance", "operations"] as const) {
      expect("status" in markaGuncellemeAlanlariniSuz(govde, r)).toBe(false);
    }
  });
});

describe("markaCsvSutunlari — dışa aktarma da role göre süzülür", () => {
  it("OPS'un CSV'sinde vergi sütunu yok", () => {
    const basliklar = markaCsvSutunlari("operations").map((s) => s.baslik);
    expect(basliklar).not.toContain("VERGI NO");
    expect(basliklar).not.toContain("VERGI DAIRESI");
  });

  it("SA/FIN'in CSV'sinde vergi sütunları var", () => {
    for (const r of ["super_admin", "finance"] as const) {
      const basliklar = markaCsvSutunlari(r).map((s) => s.baslik);
      expect(basliklar).toContain("VERGI NO");
      expect(basliklar).toContain("VERGI DAIRESI");
    }
  });

  it("CSV sütunları ekranda görünen alanların dışına çıkmaz", () => {
    for (const r of ["super_admin", "finance", "operations"] as const) {
      for (const s of markaCsvSutunlari(r)) {
        expect(MARKA_GORUNUR_ALANLAR[r]).toContain(s.alan);
      }
    }
  });
});
