import { describe, expect, it } from "vitest";
import { guvenilenProxySayisi, ipCoz } from "./istemci-ip";

/**
 * Bu testler bir GÜVEN SINIRINI korur: `x-forwarded-for` istemci tarafından
 * yazılabilir. Sahte değerlerin hız sınırını ve hesap kilidini atlatamaması
 * buradaki davranışa bağlıdır.
 */

describe("guvenilenProxySayisi", () => {
  it("tanımsız veya geçersiz değer 0 (güvenme) demektir", () => {
    for (const d of [undefined, null, "", "abc", "-1", "-5"]) {
      expect(guvenilenProxySayisi(d)).toBe(0);
    }
  });

  it("geçerli sayıyı okur", () => {
    expect(guvenilenProxySayisi("1")).toBe(1);
    expect(guvenilenProxySayisi("2")).toBe(2);
  });

  it("aşırı büyük değer sınırlanır", () => {
    // Aksi hâlde zincirin en solundaki (tamamen istemci kontrolündeki)
    // eleman "güvenilir" sayılırdı.
    expect(guvenilenProxySayisi("999")).toBe(8);
  });
});

describe("ipCoz — proxy'ye güvenilmiyorken (varsayılan)", () => {
  it("x-forwarded-for HİÇ okunmaz", () => {
    expect(ipCoz("1.2.3.4", null, 0)).toBeNull();
    expect(ipCoz("1.2.3.4, 5.6.7.8", null, 0)).toBeNull();
  });

  it("x-real-ip de okunmaz", () => {
    expect(ipCoz(null, "1.2.3.4", 0)).toBeNull();
  });
});

describe("ipCoz — tek güvenilen proxy arkasında", () => {
  it("proxy'nin eklediği tek adresi alır", () => {
    expect(ipCoz("203.0.113.9", null, 1)).toBe("203.0.113.9");
  });

  it("SAHTE ÖNEK EKLEMEK sonucu DEĞİŞTİRMEZ", () => {
    // Saldırgan sola istediğini yazar; proxy gerçek adresi sağa ekler.
    const gercek = ipCoz("203.0.113.9", null, 1);
    expect(ipCoz("9.9.9.9, 203.0.113.9", null, 1)).toBe(gercek);
    expect(ipCoz("1.1.1.1, 2.2.2.2, 203.0.113.9", null, 1)).toBe(gercek);
  });

  it("saldırgan her istekte farklı sahte önek göndererek yeni kova alamaz", () => {
    const kovalar = new Set(
      ["a", "b", "c", "d"].map((_, i) => ipCoz(`10.0.0.${i}, 203.0.113.9`, null, 1)),
    );
    expect(kovalar.size).toBe(1);
    expect([...kovalar][0]).toBe("203.0.113.9");
  });

  it("boşluklar temizlenir", () => {
    expect(ipCoz("  9.9.9.9 ,  203.0.113.9  ", null, 1)).toBe("203.0.113.9");
  });

  it("x-forwarded-for yoksa x-real-ip'e düşer", () => {
    expect(ipCoz(null, "203.0.113.9", 1)).toBe("203.0.113.9");
    expect(ipCoz("", "203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("hiçbir başlık yoksa null", () => {
    expect(ipCoz(null, null, 1)).toBeNull();
    expect(ipCoz("", "", 1)).toBeNull();
  });
});

describe("ipCoz — iki güvenilen proxy arkasında", () => {
  it("sağdan ikinciyi alır", () => {
    expect(ipCoz("203.0.113.9, 10.0.0.1", null, 2)).toBe("203.0.113.9");
  });

  it("sahte önek yine sonucu değiştirmez", () => {
    expect(ipCoz("9.9.9.9, 203.0.113.9, 10.0.0.1", null, 2)).toBe("203.0.113.9");
  });

  it("zincir beklenenden kısaysa EN SOLA düşülmez", () => {
    /**
     * Tek elemanlı zincirde sağdan 2. yok. En sola düşmek, o değerin
     * saldırgan kontrolünde olduğu durumda güveni yanlış yere verirdi;
     * bunun yerine elde kalan en sağdaki alınır.
     */
    expect(ipCoz("203.0.113.9", null, 2)).toBe("203.0.113.9");
  });
});

describe("ipCoz — biçim temizliği", () => {
  it("IPv4:port ekinden arındırır", () => {
    expect(ipCoz("203.0.113.9:51234", null, 1)).toBe("203.0.113.9");
  });

  it("köşeli parantezli IPv6 ve portu ayıklar", () => {
    expect(ipCoz("[2001:db8::1]:443", null, 1)).toBe("2001:db8::1");
  });

  it("düz IPv6 bozulmadan kalır", () => {
    expect(ipCoz("2001:db8::1", null, 1)).toBe("2001:db8::1");
  });

  it("boş elemanlar zinciri kaydırmaz", () => {
    expect(ipCoz("9.9.9.9, , 203.0.113.9", null, 1)).toBe("203.0.113.9");
  });
});
