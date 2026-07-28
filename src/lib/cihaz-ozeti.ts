/**
 * User-Agent'tan okunabilir cihaz özeti.
 *
 * ⚠ BU BİR KİMLİK DEĞİLDİR. User-Agent istemci tarafından serbestçe yazılır;
 * hiçbir yetki kararı buna dayanmaz. Tek amacı kullanıcının kendi oturum
 * listesinde "hangisi benim telefonum" sorusuna cevap vermesidir.
 *
 * Çözümlenemeyen değerler uydurulmaz — "Bilinmeyen cihaz" döner. Yanlış bir
 * tahmin, kullanıcının yabancı bir oturumu kendisininki sanmasına yol açabilir.
 */

const TARAYICILAR: ReadonlyArray<[RegExp, string]> = [
  // Sıra önemli: Edge ve Opera kendilerini Chrome olarak da tanıtır,
  // Chrome ise Safari olarak. Daha spesifik olan önce denenir.
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\//, "Chrome"],
  [/\bChrome\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

const ISLETIM_SISTEMLERI: ReadonlyArray<[RegExp, string]> = [
  [/\bWindows NT\b/, "Windows"],
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
];

export const BILINMEYEN_CIHAZ = "Bilinmeyen cihaz";

export function cihazOzeti(userAgent: string | null | undefined): string {
  if (!userAgent || typeof userAgent !== "string") return BILINMEYEN_CIHAZ;
  const ua = userAgent.slice(0, 512);

  const tarayici = TARAYICILAR.find(([desen]) => desen.test(ua))?.[1] ?? null;
  const isletim = ISLETIM_SISTEMLERI.find(([desen]) => desen.test(ua))?.[1] ?? null;

  if (tarayici && isletim) return `${tarayici} · ${isletim}`;
  if (tarayici) return tarayici;
  if (isletim) return isletim;
  return BILINMEYEN_CIHAZ;
}
