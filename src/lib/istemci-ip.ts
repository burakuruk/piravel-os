/**
 * İstemci IP'sinin belirlenmesi — GÜVEN SINIRI.
 *
 * ⚠ `x-forwarded-for` İSTEMCİ TARAFINDAN YAZILABİLİR. Körü körüne ilk değeri
 * almak, hız sınırını ve hesap kilidini işe yaramaz hâle getirir: saldırgan her
 * istekte farklı bir sahte adres göndererek her seferinde temiz bir sayaç alır.
 *
 * Çözüm, güvenilen proxy sayısını (`TRUSTED_PROXY_HOPS`) yapılandırmak ve
 * listeyi SAĞDAN okumaktır:
 *
 *   x-forwarded-for: <istemcinin uydurduğu>, …, <proxy'nin eklediği gerçek>
 *                     └─ saldırgan buraya istediğini yazar ─┘  └─ güvenilir ─┘
 *
 * Her ters proxy, gördüğü eşi listenin SONUNA ekler. Bu yüzden sağdan n. eleman
 * (n = güvenilen proxy sayısı) saldırganın dokunamadığı tek değerdir; soldaki
 * her şey uydurma olabilir ve yok sayılır.
 *
 * Varsayılan 0'dır: proxy arkasında olmadığını varsayar ve başlıkları HİÇ
 * okumaz. Ters proxy arkasına konulurken değer bilinçli olarak ayarlanır.
 */

import { guvenilenProxyHops } from "@/lib/env";

function temiz(deger: string): string | null {
  const t = deger.trim();
  if (!t) return null;
  // IPv6 köşeli parantez ve port ekini at: "[::1]:1234" → "::1"
  const koseli = t.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (koseli) return koseli[1];
  // IPv4:port → IPv4 (IPv6'da iki nokta çok olduğu için ayrım gerekir)
  if ((t.match(/:/g) ?? []).length === 1 && t.includes(".")) return t.split(":")[0];
  return t;
}

/**
 * Başlıklardan istemci IP'sini çözer.
 *
 * @param xff       `x-forwarded-for` ham değeri
 * @param xRealIp   `x-real-ip` ham değeri (tek adres; yalnız proxy'ye güvenilirken)
 * @param hops      güvenilen proxy sayısı
 */
export function ipCoz(
  xff: string | null | undefined,
  xRealIp: string | null | undefined,
  hops: number,
): string | null {
  if (hops <= 0) {
    // Proxy'ye güvenilmiyor: istemcinin yazabildiği hiçbir başlık okunmaz.
    return null;
  }

  const zincir = (xff ?? "")
    .split(",")
    .map(temiz)
    .filter((x): x is string => x !== null);

  if (zincir.length > 0) {
    /**
     * Sağdan `hops`. Zincir beklenenden kısaysa (ör. proxy başlığı hiç
     * eklememiş) en soldakine DÜŞÜLMEZ — o değer saldırgan kontrolünde
     * olabilir. Bunun yerine elde kalan en sağdaki alınır.
     */
    const indeks = Math.max(0, zincir.length - hops);
    return zincir[indeks] ?? null;
  }

  return temiz(xRealIp ?? "") ?? null;
}

/**
 * Uygulamanın yapılandırmasıyla çözer.
 *
 * Değer `env.ts` üzerinden gelir: üretimde eksik/geçersiz yapılandırma
 * uygulamayı hiç başlatmaz (bkz. `proxyHopsDogrula`).
 */
export function istemciIp(headers: Headers | undefined): string | null {
  return ipCoz(headers?.get("x-forwarded-for"), headers?.get("x-real-ip"), guvenilenProxyHops());
}
