import { newId } from "@/lib/ids";

/**
 * İstek bağlamı — kimlik ve izleme alanlarının TEK kaynağı.
 *
 * ⚠ GÜVEN SINIRI:
 * `requestId` SUNUCU tarafından üretilir. İstemci bunu seçemez; seçebilseydi
 * saldırgan kendi izini başka bir isteğin kimliğiyle karıştırabilir, denetim
 * sorgularını yanıltabilir veya bir başkasının kaydını taklit edebilirdi.
 *
 * İstemcinin gönderdiği `x-request-id` yalnız `upstreamRequestId` olarak,
 * bilgi amaçlı saklanır (dağıtık izleme korelasyonu).
 *
 * `x-test-run-id` YALNIZCA üretim dışı ortamlarda okunur; üretimde alan
 * daima NULL kalır ve testler üretim verisini kirletemez.
 */
export interface RequestContext {
  /** Sunucu üretimi, güvenilir */
  requestId: string;
  /** İstemci beyanı, güvenilmez, yalnız korelasyon */
  upstreamRequestId: string | null;
  /** Yalnız üretim dışı; üretimde daima null */
  testRunId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Başlık değerlerini güvenli uzunluk ve karakter kümesine indirger. */
function temizle(deger: string | null | undefined, maxUzunluk = 128): string | null {
  if (!deger) return null;
  const kirpilmis = deger.trim().slice(0, maxUzunluk);
  // Log enjeksiyonuna karşı: yalnız güvenli karakterler
  return /^[A-Za-z0-9._:-]+$/.test(kirpilmis) ? kirpilmis : null;
}

const URETIM = process.env.NODE_ENV === "production";

export function buildRequestContext(headers: Headers | undefined): RequestContext {
  return {
    requestId: newId(),
    upstreamRequestId: temizle(headers?.get("x-request-id")),
    // Üretimde test başlığı OKUNMAZ
    testRunId: URETIM ? null : temizle(headers?.get("x-test-run-id")),
    ipAddress: headers?.get("x-forwarded-for") ?? headers?.get("x-real-ip") ?? null,
    userAgent: headers?.get("user-agent") ?? null,
  };
}
