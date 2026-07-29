/**
 * CSV dışa aktarma — tek yer.
 *
 * Bir CSV'yi "değerleri virgülle birleştir" diye yazmak üç ayrı yerden
 * patlar; bu yüzden üretim tek fonksiyondadır:
 *
 *   1. FORMÜL ENJEKSİYONU. Excel/LibreOffice/Sheets, `=`, `+`, `-`, `@` ile
 *      başlayan bir hücreyi FORMÜL sayar. Marka adına `=cmd|'/c calc'!A1`
 *      yazan biri, dosyayı açan muhasebeciye kod çalıştırabilir. Bu bir CSV
 *      ayrıştırma sorunu değildir — dosya kurallara %100 uygun olsa bile
 *      geçerlidir; korumanın yeri üretim tarafıdır.
 *   2. TIRNAK/KAÇIŞ. İçinde virgül, tırnak veya satır sonu olan değer
 *      tırnaklanmalı ve içindeki tırnak ikilenmelidir (RFC 4180).
 *   3. UTF-8 BOM. BOM'suz dosyada Excel (Windows) Türkçe karakterleri
 *      bozar: "Örnek Mimarlık" → "Ã–rnek MimarlÄ±k".
 */

/** Excel'de formül başlatabilen ilk karakterler. */
const TEHLIKELI_BAS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** Excel (Windows) UTF-8'i ancak BOM ile doğru tanır. */
export const UTF8_BOM = "﻿";

/**
 * Tek bir hücreyi güvenli metne çevirir.
 *
 * Zararsızlaştırma tek tırnakla yapılır: Excel `'=A1` gördüğünde onu metin
 * olarak gösterir. Değer silinmez, kırpılmaz — kullanıcı ne yazdıysa okunur
 * kalır, yalnız çalıştırılmaz.
 */
export function csvHucre(deger: unknown): string {
  if (deger === null || deger === undefined) return "";

  let metin: string;
  if (deger instanceof Date) metin = deger.toISOString();
  else if (typeof deger === "boolean") metin = deger ? "evet" : "hayır";
  else metin = String(deger);

  /**
   * Satır sonları hücre içinde korunur ama \r tek başına bırakılmaz:
   * bazı ayrıştırıcılar onu satır sonu sayıp kaydı ikiye böler.
   */
  metin = metin.replace(/\r\n?/g, "\n");

  if (metin.length > 0 && TEHLIKELI_BAS.has(metin[0]!)) {
    metin = `'${metin}`;
  }

  const tirnakGerekli = /[",\n]/.test(metin);
  if (!tirnakGerekli) return metin;
  return `"${metin.replaceAll('"', '""')}"`;
}

export interface CsvSutun<T> {
  baslik: string;
  deger: (satir: T) => unknown;
}

/**
 * Satırları CSV metnine çevirir.
 *
 * Satır sonu CRLF'tir (RFC 4180); Excel'in beklediği budur.
 * BOM en başa bir kez eklenir.
 */
export function csvOlustur<T>(sutunlar: readonly CsvSutun<T>[], satirlar: readonly T[]): string {
  const govde = [
    sutunlar.map((s) => csvHucre(s.baslik)).join(","),
    ...satirlar.map((satir) => sutunlar.map((s) => csvHucre(s.deger(satir))).join(",")),
  ].join("\r\n");
  return `${UTF8_BOM}${govde}\r\n`;
}

/**
 * Dosya adı — `Content-Disposition` başlığına konur.
 *
 * ⚠ Başlığa giden metin ASCII'ye indirgenir ve tırnak/CR/LF taşıyamaz: aksi
 * hâlde başlık enjeksiyonu mümkün olurdu. Türkçe karakterler için ayrıca
 * RFC 5987 (`filename*`) biçimi verilir.
 */
export function csvIndirmeBasligi(dosyaAdi: string): string {
  const guvenli = dosyaAdi.replace(/[^A-Za-z0-9._-]/g, "_");
  const kodlu = encodeURIComponent(dosyaAdi);
  return `attachment; filename="${guvenli}"; filename*=UTF-8''${kodlu}`;
}
