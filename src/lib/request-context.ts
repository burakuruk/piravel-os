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
 * `x-test-run-id` YALNIZCA `AUDIT_TEST_RUN_ID_ENABLED=1` iken okunur. Bayrak
 * kapalıyken (varsayılan) alan daima NULL kalır ve hiçbir istemci başlığı
 * audit satırlarını etiketleyemez.
 *
 * Kapı neden NODE_ENV değil de ayrı bir bayrak: CI, uçtan uca kontrolleri
 * GERÇEK bir production sunucusuna karşı koşturur (secure çerez, kapalı
 * /styleguide, üretim derlemesi). NODE_ENV'e bağlı bir kapı bu testleri
 * imkânsız kılıyordu — koşu-kapsamlı audit sorguları daima 0 satır dönüyordu.
 * Bayrak açıkça set edilmeyi gerektirir; üretim ortamında ASLA set edilmez.
 */
export interface RequestContext {
  /** Sunucu üretimi, güvenilir */
  requestId: string;
  /** İstemci beyanı, güvenilmez, yalnız korelasyon */
  upstreamRequestId: string | null;
  /** Yalnız AUDIT_TEST_RUN_ID_ENABLED=1 iken dolu; aksi hâlde daima null */
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

/**
 * Test etiketi kapısı. Yalnız tam olarak "1" değeri açar — "true", "yes" veya
 * boş dize gibi kazara set edilmiş değerler kapıyı AÇMAZ.
 */
export function testRunIdAcikMi(deger: string | undefined | null): boolean {
  return deger === "1";
}

/** Kapı kapalıyken istemci başlığı hiç okunmaz. */
export function testRunIdCoz(
  headers: Headers | undefined,
  acik: boolean,
): string | null {
  return acik ? temizle(headers?.get("x-test-run-id")) : null;
}

const TEST_RUN_ID_ACIK = testRunIdAcikMi(process.env.AUDIT_TEST_RUN_ID_ENABLED);

export function buildRequestContext(headers: Headers | undefined): RequestContext {
  return {
    requestId: newId(),
    upstreamRequestId: temizle(headers?.get("x-request-id")),
    testRunId: testRunIdCoz(headers, TEST_RUN_ID_ACIK),
    ipAddress: headers?.get("x-forwarded-for") ?? headers?.get("x-real-ip") ?? null,
    userAgent: headers?.get("user-agent") ?? null,
  };
}
