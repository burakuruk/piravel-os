/**
 * Money modülü — şema v1.2, Karar 1 + uygulama kuralı §20.1:
 * TUTAR ARİTMETİĞİ YALNIZCA BU MODÜLDE YAPILIR.
 *
 * - Tüm tutarlar minor unit (kuruş) cinsinden integer'dır. Float tutar YASAKTIR.
 * - Farklı para birimleri doğrudan toplanamaz; önce baz tutara çevrilir.
 * - Kur, kayıt anında çağıran tarafından verilir (exchange_rates'ten okunmuş);
 *   bu modül kur tablosunu bilmez.
 */

export type CurrencyCode = string; // ISO 4217: 'TRY' | 'USD' | 'EUR' ...

export interface Money {
  /** Kuruş cinsinden tam sayı tutar */
  amountMinor: number;
  currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Para birimi uyuşmazlığı: ${a} ile ${b} doğrudan işleme sokulamaz`);
    this.name = "CurrencyMismatchError";
  }
}

export class InvalidAmountError extends Error {
  constructor(value: number) {
    super(`Geçersiz tutar: ${value} — tutarlar tam sayı kuruş olmalıdır`);
    this.name = "InvalidAmountError";
  }
}

/** Tam sayı ve güvenli aralık kontrolü — her genel fonksiyonun girişinde. */
function assertMinor(value: number): void {
  if (!Number.isSafeInteger(value)) throw new InvalidAmountError(value);
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  assertMinor(amountMinor);
  return { amountMinor, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const sum = a.amountMinor + b.amountMinor;
  assertMinor(sum);
  return { amountMinor: sum, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0;
}

export function isZero(a: Money): boolean {
  return a.amountMinor === 0;
}

/**
 * Baz para birimine çevirme (Karar 1: amount_base_minor = round(amount * fx_rate)).
 * Yarım kuruş yukarı yuvarlanır (Math.round — banker's rounding değil; şema kararı).
 */
export function toBaseMinor(amountMinor: number, fxRate: number): number {
  assertMinor(amountMinor);
  if (!(fxRate > 0)) throw new RangeError(`Kur pozitif olmalıdır: ${fxRate}`);
  const result = Math.round(amountMinor * fxRate);
  assertMinor(result);
  return result;
}

/**
 * Çapraz kur eşleştirmesi: hareket tutarından yükümlülük tutarını türetir.
 * ob_amount = tx_amount / fx_rate  (şema §10.3 kural 2)
 */
export function txToObligationMinor(txAmountMinor: number, fxRate: number): number {
  assertMinor(txAmountMinor);
  if (!(fxRate > 0)) throw new RangeError(`Kur pozitif olmalıdır: ${fxRate}`);
  const result = Math.round(txAmountMinor / fxRate);
  assertMinor(result);
  return result;
}

/**
 * KDV / vergi satırı tutarı (şema §9.4): round(matrah * oran / 100).
 * Negatif oran verilmez; tevkifat/stopaj işareti çağıran tarafta uygulanır.
 */
export function taxMinor(baseMinor: number, ratePercent: number): number {
  assertMinor(baseMinor);
  if (ratePercent < 0) throw new RangeError(`Vergi oranı negatif olamaz: ${ratePercent}`);
  return Math.round((baseMinor * ratePercent) / 100);
}

/** KDV dahil tutardan net'i ayrıştırma (contracts.vat_included=true girişi, şema §7.1). */
export function extractNetFromGross(grossMinor: number, vatRatePercent: number): number {
  assertMinor(grossMinor);
  if (vatRatePercent < 0) throw new RangeError(`Vergi oranı negatif olamaz: ${vatRatePercent}`);
  return Math.round(grossMinor / (1 + vatRatePercent / 100));
}

/**
 * Bir tutarı n parçaya böler — KURUŞ KAYBI OLMADAN (Sprint 3, plan §3e-1).
 *
 * `taban = T / n` (tam bölme), kalan **SON parçaya** yüklenir. Böylece
 * `Σ parça === T` her zaman doğrudur.
 *
 * Neden son parça: ilk taksit çoğu zaman müşteriyle konuşulan/teklifte yazan
 * rakamdır; kuruş farkını oraya koymak ilk faturada açıklama gerektirir. Son
 * taksit kapanış kalemidir, fark orada doğaldır.
 *
 * ⚠ Bölme burada yapılır, çağıranda değil: `Math.floor(T/n)` çağıranlara
 * dağılırsa biri `Math.round` yazar ve toplam sessizce kayar.
 */
export function allocateMinor(totalMinor: number, parts: number): number[] {
  assertMinor(totalMinor);
  if (!Number.isSafeInteger(parts) || parts < 1) {
    throw new RangeError(`Parça sayısı en az 1 tam sayı olmalıdır: ${parts}`);
  }
  if (totalMinor < 0) {
    throw new RangeError(`Dağıtılacak tutar negatif olamaz: ${totalMinor}`);
  }
  const taban = Math.floor(totalMinor / parts);
  const kalan = totalMinor - taban * parts;
  const out = new Array<number>(parts).fill(taban);
  out[parts - 1] = taban + kalan;
  return out;
}

const SYMBOLS: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };

/**
 * Görüntü formatı (06 §10.1): `36.500,00 ₺` — TR yerel ayarı, sembol sonda,
 * kuruş daima gösterilir. Negatif: `−1.234,56 ₺` (U+2212, parantez değil).
 */
export function formatMoney(amountMinor: number, currency: CurrencyCode): string {
  assertMinor(amountMinor);
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const major = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  const grouped = major.toLocaleString("tr-TR");
  const symbol = SYMBOLS[currency] ?? currency;
  return `${negative ? "−" : ""}${grouped},${cents} ${symbol}`;
}

/** Kullanıcı girişini kuruşa çevirir: "1.234,56" → 123456. */
export function parseMoneyInput(input: string): number {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  if (normalized === "" || !/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new InvalidAmountError(NaN);
  }
  const value = Math.round(parseFloat(normalized) * 100);
  assertMinor(value);
  return value;
}
