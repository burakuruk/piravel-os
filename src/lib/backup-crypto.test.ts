import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
// Araç bir .mjs dosyası (CLI olarak da çalışır); burada davranışı sınanıyor
import {
  baslikOku,
  coz,
  KDF_VARSAYILAN,
  sifrele,
  SURUM,
  YedekSifreHatasi,
} from "../../scripts/backup-crypto.mjs";

/**
 * Yedek şifrelemesinin davranış testleri.
 *
 * ⚠ Bu dosyada GÖMÜLÜ PAROLA YOKTUR. Her test kendi parolasını `randomBytes`
 * ile üretir; sabit bir test parolası bir gün kopyalanıp gerçek bir yedekte
 * kullanılabilirdi.
 *
 * Testler hızlı kalsın diye KDF parametresi düşürülür (`logN: 10`): sınanan
 * şey scrypt'in maliyeti değil, biçim ve bütünlük davranışı.
 */
const HIZLI_KDF = { ...KDF_VARSAYILAN, logN: 10 };
const parolaUret = () => randomBytes(24).toString("base64url");

describe("backup-crypto — round-trip", () => {
  it("doğru parolayla çözülen içerik baytı baytına aynı", () => {
    const parola = parolaUret();
    const veri = randomBytes(4096);
    const arsiv = sifrele(veri, parola, HIZLI_KDF);
    expect(coz(arsiv, parola).equals(veri)).toBe(true);
  });

  it("boş dosya da şifrelenip çözülebiliyor", () => {
    const parola = parolaUret();
    const bos = Buffer.alloc(0);
    expect(coz(sifrele(bos, parola, HIZLI_KDF), parola).length).toBe(0);
  });

  it("aynı içerik iki kez şifrelenince FARKLI çıktı verir (rastgele salt/IV)", () => {
    const parola = parolaUret();
    const veri = Buffer.from("aynı içerik");
    const a = sifrele(veri, parola, HIZLI_KDF);
    const b = sifrele(veri, parola, HIZLI_KDF);
    expect(a.equals(b)).toBe(false);
    // ama ikisi de aynı düz veriye çözülür
    expect(coz(a, parola).equals(coz(b, parola))).toBe(true);
  });
});

describe("backup-crypto — bütünlük", () => {
  it("YANLIŞ PAROLA ile çözme başarısız", () => {
    const arsiv = sifrele(randomBytes(256), parolaUret(), HIZLI_KDF);
    expect(() => coz(arsiv, parolaUret())).toThrow(YedekSifreHatasi);
  });

  it("CIPHERTEXT kurcalanırsa çözme başarısız (tek bayt)", () => {
    const parola = parolaUret();
    const arsiv = sifrele(randomBytes(256), parola, HIZLI_KDF);
    const bozuk = Buffer.from(arsiv);
    bozuk[bozuk.length - 1] ^= 0x01;
    expect(() => coz(bozuk, parola)).toThrow(YedekSifreHatasi);
  });

  it("TAG kurcalanırsa çözme başarısız", () => {
    const parola = parolaUret();
    const arsiv = sifrele(randomBytes(256), parola, HIZLI_KDF);
    const h = baslikOku(arsiv);
    const tagOfset = arsiv.length - h.ciphertext.length - 16;
    const bozuk = Buffer.from(arsiv);
    bozuk[tagOfset] ^= 0xff;
    expect(() => coz(bozuk, parola)).toThrow(YedekSifreHatasi);
  });

  /**
   * Başlık şifrelenmez ama AAD olarak imzalanır. Bu test onun ölçüsü:
   * saldırgan `logN`'i düşürüp anahtar türetmeyi ucuzlatmaya kalkarsa
   * çözme tag hatasıyla düşmeli — sessizce zayıf anahtarla çalışmamalı.
   */
  it("BAŞLIK/AAD kurcalanırsa (logN düşürülürse) çözme başarısız", () => {
    const parola = parolaUret();
    const arsiv = sifrele(randomBytes(256), parola, HIZLI_KDF);
    const bozuk = Buffer.from(arsiv);
    bozuk.writeUInt8(11, 6); // logN alanı: 10 → 11
    expect(() => coz(bozuk, parola)).toThrow(YedekSifreHatasi);
  });

  it("SALT kurcalanırsa çözme başarısız", () => {
    const parola = parolaUret();
    const arsiv = sifrele(randomBytes(256), parola, HIZLI_KDF);
    const bozuk = Buffer.from(arsiv);
    bozuk[11] ^= 0x01; // salt'ın ilk baytı
    expect(() => coz(bozuk, parola)).toThrow(YedekSifreHatasi);
  });
});

describe("backup-crypto — biçim ve sürüm", () => {
  it("DESTEKLENMEYEN SÜRÜM açık hatayla reddedilir, çözmeye kalkışılmaz", () => {
    const parola = parolaUret();
    const arsiv = sifrele(randomBytes(64), parola, HIZLI_KDF);
    const ileri = Buffer.from(arsiv);
    ileri.writeUInt8(SURUM + 1, 4);
    expect(() => baslikOku(ileri)).toThrow(/Desteklenmeyen biçim sürümü/);
    expect(() => coz(ileri, parola)).toThrow(/Desteklenmeyen biçim sürümü/);
  });

  it("PVBK imzası olmayan dosya reddedilir", () => {
    expect(() => baslikOku(Buffer.alloc(64))).toThrow(/imzası PVBK değil/);
  });

  it("çok kısa dosya reddedilir", () => {
    expect(() => baslikOku(Buffer.from("PVBK"))).toThrow(/çok kısa/);
  });

  it("saçma KDF parametresi reddedilir (bellek tüketimi koruması)", () => {
    const parola = parolaUret();
    const arsiv = sifrele(randomBytes(64), parola, HIZLI_KDF);
    const bozuk = Buffer.from(arsiv);
    bozuk.writeUInt8(30, 6); // logN = 30 → gigabaytlarca bellek isterdi
    expect(() => baslikOku(bozuk)).toThrow(/Geçersiz logN/);
  });

  it("başlık beklenen alanları taşıyor", () => {
    const h = baslikOku(sifrele(Buffer.from("x"), parolaUret(), HIZLI_KDF));
    expect(h.surum).toBe(SURUM);
    expect(h.logN).toBe(HIZLI_KDF.logN);
    expect(h.keyLen).toBe(32);
    expect(h.iv.length).toBe(12);
    expect(h.tag.length).toBe(16);
  });
});
