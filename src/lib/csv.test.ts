import { describe, expect, it } from "vitest";
import { csvHucre, csvIndirmeBasligi, csvOlustur, UTF8_BOM } from "./csv";

describe("csvHucre — formül enjeksiyonu", () => {
  it("= ile başlayan değeri metne çevirir", () => {
    expect(csvHucre("=1+1")).toBe("'=1+1");
  });

  it("Excel'de komut çalıştıran klasik yükü etkisizleştirir", () => {
    const yuk = "=cmd|'/c calc'!A1";
    const cikti = csvHucre(yuk);
    expect(cikti.startsWith("=")).toBe(false);
    // Değer silinmez, yalnız çalıştırılmaz
    expect(cikti).toContain("cmd");
  });

  it("+ - @ tab ve CR ile başlayanları da kapsar", () => {
    for (const bas of ["+", "-", "@", "\t"]) {
      expect(csvHucre(`${bas}zararli`).startsWith("'")).toBe(true);
    }
  });

  it("negatif sayı da kaçırılır — doğruluk değil güvenlik önce gelir", () => {
    // -5 formül değildir ama '-' ile başlayan her şeyi ayırt etmeye çalışmak
    // ayrıştırıcıya güvenmek demektir; ölçüt ilk karakterdir.
    expect(csvHucre("-5")).toBe("'-5");
  });

  it("tehlikesiz değeri değiştirmez", () => {
    expect(csvHucre("Sahte Vize A.Ş.")).toBe("Sahte Vize A.Ş.");
    expect(csvHucre(3)).toBe("3");
  });
});

describe("csvHucre — tırnak ve kaçış (RFC 4180)", () => {
  it("virgül içeren değeri tırnaklar", () => {
    expect(csvHucre("Ankara, Türkiye")).toBe('"Ankara, Türkiye"');
  });

  it("tırnağı ikiler", () => {
    expect(csvHucre('Sahte "Vize"')).toBe('"Sahte ""Vize"""');
  });

  it("satır sonu içeren değeri tırnaklar ve \\r\\n'i tekilleştirir", () => {
    expect(csvHucre("bir\r\niki")).toBe('"bir\niki"');
  });

  it("tırnak + formül birlikte: önce kaçış, sonra tırnak", () => {
    expect(csvHucre('=A1,"x"')).toBe('"\'=A1,""x"""');
  });

  it("null ve undefined boş hücredir", () => {
    expect(csvHucre(null)).toBe("");
    expect(csvHucre(undefined)).toBe("");
  });
});

describe("csvOlustur", () => {
  const sutunlar = [
    { baslik: "KOD", deger: (r: { kod: string; ad: string }) => r.kod },
    { baslik: "MARKA", deger: (r: { kod: string; ad: string }) => r.ad },
  ];

  it("BOM ile başlar — Excel Türkçe karakterleri bozmasın", () => {
    const csv = csvOlustur(sutunlar, [{ kod: "SVZ", ad: "Örnek" }]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });

  it("satırları CRLF ile ayırır", () => {
    const csv = csvOlustur(sutunlar, [{ kod: "SVZ", ad: "Sahte" }]);
    expect(csv).toBe(`${UTF8_BOM}KOD,MARKA\r\nSVZ,Sahte\r\n`);
  });

  it("başlıkları da kaçış kurallarından geçirir", () => {
    const csv = csvOlustur([{ baslik: "A,B", deger: () => "x" }], [1]);
    expect(csv).toContain('"A,B"');
  });

  it("kayıt yoksa yalnız başlık satırı üretir", () => {
    expect(csvOlustur(sutunlar, [])).toBe(`${UTF8_BOM}KOD,MARKA\r\n`);
  });
});

describe("csvIndirmeBasligi", () => {
  it("ASCII dışı karakterleri başlıktan düşürür ama filename* ile korur", () => {
    const baslik = csvIndirmeBasligi("markalar-Ölçüm.csv");
    expect(baslik).toContain('filename="markalar-_l__m.csv"');
    expect(baslik).toContain("filename*=UTF-8''");
  });

  it("tırnak ve satır sonu başlığa giremez (başlık enjeksiyonu)", () => {
    const baslik = csvIndirmeBasligi('a"\r\nX-Injected: 1.csv');
    expect(baslik).not.toContain("\r");
    expect(baslik).not.toContain("\n");
    expect(baslik.match(/"/g)?.length).toBe(2);
  });
});
