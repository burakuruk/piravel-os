#!/usr/bin/env node
/**
 * Yedek şifreleme aracı — AES-256-GCM, sürümlü `.pvbk` biçimi.
 *
 * Yedek dosyaları kullanıcı kimlik malzemesi taşır (parola hash'leri, davet
 * token HMAC'leri). Şifreleme geçici bir script'te bırakılmaz: yedeği ÇÖZECEK
 * kişinin aynı kodu bulması gerekir, üstelik aylar sonra.
 *
 * ⚠ NEDEN GCM, CBC DEĞİL: AES-CBC bütünlük doğrulamaz. Değiştirilmiş bir
 * arşiv sessizce çözülür ve bozuk veri "geri yüklendi" sanılır. GCM'in
 * authentication tag'i bunu yakalar.
 *
 * ⚠ BAŞLIK AAD OLARAK DOĞRULANIR: sürüm ve KDF parametreleri şifrelenmez ama
 * imzalanır. Saldırgan `logN`'i 15'ten 1'e indirip anahtar türetmeyi
 * ucuzlatmaya kalkarsa çözme tag hatasıyla düşer.
 *
 * ⚠ PAROLA YALNIZ DOSYADAN OKUNUR (`--pass-file`). Argüman, ortam değişkeni
 * veya stdin kabul edilmez; parola komut geçmişine ve süreç listesine düşmez.
 * Bu dosyada ve testlerinde HİÇBİR parola gömülü değildir.
 *
 * Kullanım:
 *   node scripts/backup-crypto.mjs encrypt --in <dosya> --out <dosya.pvbk> --pass-file <yol>
 *   node scripts/backup-crypto.mjs decrypt --in <dosya.pvbk> --out <dosya>  --pass-file <yol>
 *   node scripts/backup-crypto.mjs verify  --in <dosya.pvbk> --pass-file <yol>
 *   node scripts/backup-crypto.mjs info    --in <dosya.pvbk>
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// ── Biçim ────────────────────────────────────────────────────────────────
export const MAGIC = Buffer.from("PVBK", "ascii");
export const SURUM = 1;
const KDF_SCRYPT = 1;

/** Başlık: magic(4) + sürüm(1) + kdf(1) + logN(1) + r(1) + p(1) + keyLen(1) + saltLen(1) */
const BASLIK_UZUNLUK = 11;
const IV_UZUNLUK = 16 - 4; // 12 bayt — GCM için önerilen
const TAG_UZUNLUK = 16;

/**
 * scrypt varsayılanları.
 *
 * `maxmem` AÇIKÇA verilir: N=2^15, r=8 için gereken bellek ≈ 128·N·r = 32 MiB
 * ve Node'un varsayılan sınırı da 32 MiB — yani tam sınırda. Sınırı aşan
 * çağrı ortama göre `memory limit exceeded` ile düşer; 96 MiB bunu keser.
 */
export const KDF_VARSAYILAN = { logN: 15, r: 8, p: 1, keyLen: 32, saltLen: 16 };
const MAXMEM = 96 * 1024 * 1024;

export class YedekSifreHatasi extends Error {
  constructor(mesaj) {
    super(mesaj);
    this.name = "YedekSifreHatasi";
  }
}

function baslikYaz({ logN, r, p, keyLen, saltLen }) {
  const b = Buffer.alloc(BASLIK_UZUNLUK);
  MAGIC.copy(b, 0);
  b.writeUInt8(SURUM, 4);
  b.writeUInt8(KDF_SCRYPT, 5);
  b.writeUInt8(logN, 6);
  b.writeUInt8(r, 7);
  b.writeUInt8(p, 8);
  b.writeUInt8(keyLen, 9);
  b.writeUInt8(saltLen, 10);
  return b;
}

/** Başlığı ayrıştırır. Bozuk/desteklenmeyen biçimde AÇIK hata atar. */
export function baslikOku(buf) {
  if (buf.length < BASLIK_UZUNLUK) {
    throw new YedekSifreHatasi("Dosya çok kısa — geçerli bir .pvbk değil");
  }
  if (!buf.subarray(0, 4).equals(MAGIC)) {
    throw new YedekSifreHatasi("Dosya imzası PVBK değil — bu bir yedek arşivi değil");
  }
  const surum = buf.readUInt8(4);
  if (surum !== SURUM) {
    throw new YedekSifreHatasi(
      `Desteklenmeyen biçim sürümü: ${surum} (bu araç ${SURUM} okur). ` +
        "Daha yeni bir sürümle şifrelenmiş olabilir; çözmeye kalkışılmadı.",
    );
  }
  const kdf = buf.readUInt8(5);
  if (kdf !== KDF_SCRYPT) {
    throw new YedekSifreHatasi(`Desteklenmeyen KDF: ${kdf}`);
  }
  const logN = buf.readUInt8(6);
  const r = buf.readUInt8(7);
  const p = buf.readUInt8(8);
  const keyLen = buf.readUInt8(9);
  const saltLen = buf.readUInt8(10);

  // Aklı başında sınırlar: bozuk bir başlık gigabaytlarca bellek istemesin
  if (logN < 10 || logN > 20) throw new YedekSifreHatasi(`Geçersiz logN: ${logN}`);
  if (r < 1 || r > 32) throw new YedekSifreHatasi(`Geçersiz r: ${r}`);
  if (p < 1 || p > 16) throw new YedekSifreHatasi(`Geçersiz p: ${p}`);
  if (keyLen !== 32) throw new YedekSifreHatasi(`Geçersiz anahtar uzunluğu: ${keyLen}`);
  if (saltLen < 8 || saltLen > 64) throw new YedekSifreHatasi(`Geçersiz salt uzunluğu: ${saltLen}`);

  const beklenen = BASLIK_UZUNLUK + saltLen + IV_UZUNLUK + TAG_UZUNLUK;
  if (buf.length < beklenen) {
    throw new YedekSifreHatasi("Dosya eksik — salt/IV/tag alanları sığmıyor");
  }

  return {
    surum, kdf, logN, r, p, keyLen, saltLen,
    baslik: buf.subarray(0, BASLIK_UZUNLUK),
    salt: buf.subarray(BASLIK_UZUNLUK, BASLIK_UZUNLUK + saltLen),
    iv: buf.subarray(BASLIK_UZUNLUK + saltLen, BASLIK_UZUNLUK + saltLen + IV_UZUNLUK),
    tag: buf.subarray(
      BASLIK_UZUNLUK + saltLen + IV_UZUNLUK,
      BASLIK_UZUNLUK + saltLen + IV_UZUNLUK + TAG_UZUNLUK,
    ),
    ciphertext: buf.subarray(BASLIK_UZUNLUK + saltLen + IV_UZUNLUK + TAG_UZUNLUK),
  };
}

function anahtarTuret(parola, salt, { logN, r, p, keyLen }) {
  return scryptSync(parola, salt, keyLen, { N: 2 ** logN, r, p, maxmem: MAXMEM });
}

/** Düz veriyi `.pvbk` biçiminde şifreler. */
export function sifrele(duzVeri, parola, kdf = KDF_VARSAYILAN) {
  const salt = randomBytes(kdf.saltLen);
  const iv = randomBytes(IV_UZUNLUK);
  const baslik = baslikYaz(kdf);
  const anahtar = anahtarTuret(parola, salt, kdf);

  const cipher = createCipheriv("aes-256-gcm", anahtar, iv);
  // Başlık ŞİFRELENMEZ ama İMZALANIR: sürüm/KDF oynanırsa çözme düşer
  cipher.setAAD(baslik);
  const ciphertext = Buffer.concat([cipher.update(duzVeri), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([baslik, salt, iv, tag, ciphertext]);
}

/** `.pvbk` çözer. Tag doğrulanamazsa (kurcalama/yanlış parola) hata atar. */
export function coz(arsiv, parola) {
  const h = baslikOku(arsiv);
  const anahtar = anahtarTuret(parola, h.salt, h);
  const decipher = createDecipheriv("aes-256-gcm", anahtar, h.iv);
  decipher.setAAD(h.baslik);
  decipher.setAuthTag(h.tag);
  try {
    return Buffer.concat([decipher.update(h.ciphertext), decipher.final()]);
  } catch {
    throw new YedekSifreHatasi(
      "Çözme başarısız: parola yanlış ya da dosya değiştirilmiş " +
        "(GCM doğrulama etiketi tutmadı).",
    );
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────
function arg(ad) {
  const i = process.argv.indexOf(`--${ad}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** Parola YALNIZ dosyadan; argüman/ortam değişkeni bilerek desteklenmez. */
function parolaOku() {
  const yol = arg("pass-file");
  if (!yol) {
    throw new YedekSifreHatasi(
      "--pass-file zorunlu. Parola argüman veya ortam değişkeni olarak kabul " +
        "edilmez: ikisi de süreç listesine ve komut geçmişine düşer.",
    );
  }
  const parola = readFileSync(yol, "utf8").trim();
  if (parola.length < 12) {
    throw new YedekSifreHatasi("Parola dosyası boş veya 12 karakterden kısa");
  }
  return parola;
}

const komut = process.argv[2];
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  try {
    if (komut === "encrypt") {
      const veri = readFileSync(arg("in"));
      writeFileSync(arg("out"), sifrele(veri, parolaOku()));
      console.log(`✓ şifrelendi → ${arg("out")}`);
    } else if (komut === "decrypt") {
      const arsiv = readFileSync(arg("in"));
      writeFileSync(arg("out"), coz(arsiv, parolaOku()));
      console.log(`✓ çözüldü → ${arg("out")}`);
    } else if (komut === "verify") {
      coz(readFileSync(arg("in")), parolaOku());
      console.log("✓ doğrulama etiketi geçerli — arşiv bozulmamış");
    } else if (komut === "info") {
      const h = baslikOku(readFileSync(arg("in")));
      console.log(
        JSON.stringify(
          { surum: h.surum, kdf: "scrypt", logN: h.logN, r: h.r, p: h.p,
            keyLen: h.keyLen, saltLen: h.saltLen, ciphertextBayt: h.ciphertext.length },
          null, 2,
        ),
      );
    } else {
      console.error("Komutlar: encrypt | decrypt | verify | info");
      process.exit(2);
    }
  } catch (e) {
    console.error(`HATA: ${e.message}`);
    process.exit(1);
  }
}
