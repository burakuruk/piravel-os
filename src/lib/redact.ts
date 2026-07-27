/**
 * Sır temizleme — PRD §6.3.
 *
 * TOTP secret, QR URI (otpauth://), kurtarma kodları ve parolalar;
 * loglara, Sentry'ye, analytics'e veya audit_logs'a ASLA girmemelidir.
 * Bu modül, dışarı çıkan her yapıyı geçmesi gereken tek kapıdır.
 */

/** Hassas kabul edilen alan adları (küçük harfe indirgenmiş, alt tire/tire yoksayılır). */
const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "newpassword",
  "currentpassword",
  "secret",
  "totpsecret",
  "twofactorsecret",
  "backupcodes",
  "recoverycodes",
  "recoverycode",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "apikey",
  "authorization",
  "cookie",
  "otp",
  "otpauth",
  "qr",
  "qrcode",
  "iban",
  // Davet token'ı bir kimlik bilgisidir: onu gören hesabı ele geçirir
  "invite",
  "invitetoken",
  "invitelink",
  "inviteurl",
  "davet",
  "davettoken",
];

export const REDACTED = "[REDACTED]";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

export function isSensitiveKey(key: string): boolean {
  const k = normalizeKey(key);
  return SENSITIVE_KEYS.some((s) => k === s || k.endsWith(s) || k.startsWith(s));
}

/** otpauth:// URI'leri metin içinde geçse bile temizlenir. */
const OTPAUTH_PATTERN = /otpauth:\/\/[^\s"'<>]+/gi;

/**
 * Davet kabul bağlantısı — `/davet/<token>`.
 *
 * Bu yol erişim log'unda, Referer başlığında, Sentry'nin `request.url`
 * alanında ve hata yığınlarında metin olarak geçebilir. Token'ın kendisi bir
 * kimlik bilgisi olduğu için yalnız yol kısmı bırakılır. Tam URL de (şema +
 * host) eşleşir; yalnız token parçası maskelenir ki hangi ucun çağrıldığı
 * hata ayıklamada görülebilsin.
 */
const DAVET_URL_PATTERN = /(\/davet\/)[A-Za-z0-9_-]+/g;

/** Metin içinde geçen sırları maskeler (log satırları için). */
export function redactString(input: string): string {
  return input
    .replace(OTPAUTH_PATTERN, REDACTED)
    .replace(DAVET_URL_PATTERN, `$1${REDACTED}`);
}

/**
 * Nesneyi derinlemesine temizler. Hassas anahtarların DEĞERİ atılır;
 * anahtarın kendisi kalır ki hata ayıklarken alanın varlığı görülebilsin.
 */
export function redact<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value === "string") return redactString(value) as T;
  if (value === null || typeof value !== "object") return value;

  // Döngüsel referans koruması
  if (seen.has(value as object)) return REDACTED as T;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, seen)) as T;
  }

  if (value instanceof Error) {
    const err = new Error(redactString(value.message));
    err.name = value.name;
    err.stack = value.stack ? redactString(value.stack) : undefined;
    return err as T;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redact(v, seen);
  }
  return out as T;
}

/**
 * Sentry beforeSend kancası.
 * Kurulum: Sentry.init({ beforeSend: sentryBeforeSend })
 */
export function sentryBeforeSend<T extends Record<string, unknown>>(event: T): T {
  return redact(event);
}
