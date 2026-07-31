import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authReauthentication } from "@/db/schema";
import { newId } from "@/lib/ids";

/**
 * Step-up (adım yükseltme) kimlik doğrulaması — kritik işlemler için.
 *
 * ⚠ NEDEN freshAge TEK BAŞINA YETMEZ:
 * Better Auth'un `freshAge`'i "oturum ne zaman kuruldu/yenilendi" sorusuna
 * bakar. 4 dakika önce giriş yapmış bir kullanıcının oturumu "taze" sayılır
 * ve kritik işlem AÇIK BİR DOĞRULAMA OLMADAN geçer. Bilgisayarını açık
 * bırakmış kullanıcının başında duran biri de bu tazelikten yararlanır.
 *
 * Bu modül, kullanıcının O AN parolasını (2FA açıksa TOTP'sini de) yeniden
 * girdiğini kanıtlayan bir kayıt tutar. freshAge temel koruma olarak kalır;
 * step-up onun YERİNE değil ÜSTÜNE biner.
 *
 * Kayıt oturuma bağlıdır (session_id): başka bir oturuma taşınamaz ve oturum
 * silindiğinde FK CASCADE ile birlikte silinir. Hiçbir şey localStorage'da
 * tutulmaz — durumun tek kaynağı veritabanıdır.
 */

/** Yükseltmenin geçerlilik süresi. */
export const STEP_UP_SURESI_SN = 5 * 60;

/** Step-up isteyen kritik işlemler (docs/02 §7 ile eşleşir). */
export const KRITIK_ISLEMLER = [
  "user.role_change",
  "user.deactivate",
  "user.create_privileged",
  "user.revoke_all_sessions",
  "user.reset_two_factor",
  /**
   * Marka modülünün kritik işlemleri (Sprint 2).
   *
   * Dördü de ya bir YETKİ SINIRINI ya da FİNANSAL/HUKUKİ bir alanı değiştirir:
   * atama OPS'a bir markanın kapısını açar/kapatır; vergi bilgisi faturaya
   * gider; marka ve hizmet pasifleştirme sözleşme ve faturalama tarafını
   * etkiler. Açık bırakılmış bir ekranın başındaki biri bunları
   * yapamamalıdır — oturumun "taze" olması yetmez.
   */
  "brand.status_change",
  "brand.update_tax",
  "brand.assignment_change",
  "service.deactivate",
  /**
   * Sözleşme yaşam döngüsü (Sprint 3).
   *
   * Üçü de geri alınamaz ve hukuki sonuç doğurur: aktivasyon belgeyi
   * yürürlüğe sokar ve alanları kilitler; sonlandırma ve iptal geri
   * alınamaz. **Taslak iptali de buraya dâhildir** — numara verilmiş bir
   * belge iz bırakmadan yok edilmemeli.
   */
  "contract.activate",
  "contract.end",
  "contract.cancel",
  "bank_account.view_unmasked_iban",
  "allocation.reverse",
  "receivable.refund",
  "settings.update",
] as const;

export type KritikIslem = (typeof KRITIK_ISLEMLER)[number];

export type StepUpYontemi = "password" | "password_totp";

export class StepUpGerekli extends Error {
  readonly code = "SESSION_STALE";
  constructor(public readonly islem: KritikIslem) {
    super("Bu işlem için kimliğinizi yeniden doğrulamanız gerekiyor");
    this.name = "StepUpGerekli";
  }
}

/**
 * Yükseltme kaydı oluşturur. Çağıran, parolayı (ve gerekiyorsa TOTP'yi)
 * ZATEN doğrulamış olmalıdır — bu fonksiyon doğrulama yapmaz, kanıtı yazar.
 */
export async function stepUpKaydet(input: {
  sessionId: string;
  userId: string;
  method: StepUpYontemi;
  requestId?: string | null;
}): Promise<{ expiresAt: Date }> {
  // Aynı oturumun eski kayıtları temizlenir: tek geçerli yükseltme olsun
  await db
    .delete(authReauthentication)
    .where(eq(authReauthentication.sessionId, input.sessionId));

  const expiresAt = new Date(Date.now() + STEP_UP_SURESI_SN * 1000);
  await db.insert(authReauthentication).values({
    id: newId(),
    sessionId: input.sessionId,
    userId: input.userId,
    method: input.method,
    expiresAt,
    createdRequestId: input.requestId ?? null,
  });
  return { expiresAt };
}

/** Oturumun geçerli (süresi dolmamış) bir yükseltmesi var mı? */
export async function stepUpGecerliMi(sessionId: string): Promise<{
  gecerli: boolean;
  kalanSaniye: number;
  method?: StepUpYontemi;
}> {
  const rows = await db
    .select({
      expiresAt: authReauthentication.expiresAt,
      method: authReauthentication.method,
    })
    .from(authReauthentication)
    .where(
      and(
        eq(authReauthentication.sessionId, sessionId),
        gt(authReauthentication.expiresAt, sql`now()`),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return { gecerli: false, kalanSaniye: 0 };

  const kalan = Math.max(0, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000));
  return { gecerli: kalan > 0, kalanSaniye: kalan, method: row.method as StepUpYontemi };
}

/**
 * Kritik işlem kapısı. Geçerli yükseltme yoksa SESSION_STALE fırlatır;
 * istemci kullanıcıdan parola (ve TOTP) ister, /api/v1/reauth'a gönderir,
 * sonra işlemi tekrar dener.
 */
export async function requireStepUp(sessionId: string, islem: KritikIslem): Promise<void> {
  const durum = await stepUpGecerliMi(sessionId);
  if (!durum.gecerli) throw new StepUpGerekli(islem);
}

/**
 * Kullanıcının TÜM yükseltmelerini geçersiz kılar.
 *
 * Çağrılması gereken yerler: kullanıcı devre dışı bırakıldığında, parola
 * değiştiğinde/sıfırlandığında, 2FA sıfırlandığında, tüm oturumlar iptal
 * edildiğinde. (Tek bir oturum silindiğinde FK CASCADE hâlleder.)
 */
export async function stepUpGecersizKil(userId: string): Promise<number> {
  const silinen = await db
    .delete(authReauthentication)
    .where(eq(authReauthentication.userId, userId))
    .returning({ id: authReauthentication.id });
  return silinen.length;
}
