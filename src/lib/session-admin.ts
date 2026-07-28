import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { authReauthentication, authSessions } from "@/db/schema";
import { cihazOzeti } from "@/lib/cihaz-ozeti";
import { maskeliIp } from "@/lib/redact";

/**
 * Oturum listesi ve iptali — kullanıcının KENDİ oturumları.
 *
 * ⚠ Yanıtta ASLA bulunmayanlar: ham `token`, token hash'i, tam IP, çerez
 * içeriği, step-up kimliği, `auth_*` iç alanları. Sunum modeli bilerek
 * dardır; alan eklemek isteyen önce bu listeyi okumalı.
 *
 * Başkasının oturum LİSTESİ hiç sunulmaz — SA bile yalnız toplu iptal
 * yapabilir (docs/02 §5). Bir yöneticinin çalışanın cihaz geçmişini
 * görmesi için meşru bir sebep yok.
 */

export interface OturumOzeti {
  id: string;
  cihaz: string;
  olusturulma: string;
  sonKullanim: string;
  /** Bu isteği yapan oturum mu */
  mevcut: boolean;
  /** Yalnız ağ öneki — tam IP değil */
  ag: string | null;
}

/**
 * Kullanıcının açık oturumları. Süresi dolmuşlar listelenmez: kullanıcıya
 * "kapat" düğmesi sunulan bir satır, gerçekten açık bir erişim olmalıdır.
 */
export async function oturumlariListele(
  userId: string,
  mevcutSessionId: string,
): Promise<OturumOzeti[]> {
  const rows = await db
    .select({
      id: authSessions.id,
      userAgent: authSessions.userAgent,
      ipAddress: authSessions.ipAddress,
      createdAt: authSessions.createdAt,
      updatedAt: authSessions.updatedAt,
    })
    .from(authSessions)
    .where(and(eq(authSessions.userId, userId), gt(authSessions.expiresAt, sql`now()`)))
    .orderBy(desc(authSessions.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    cihaz: cihazOzeti(r.userAgent),
    olusturulma: r.createdAt.toISOString(),
    sonKullanim: r.updatedAt.toISOString(),
    mevcut: r.id === mevcutSessionId,
    ag: maskeliIp(r.ipAddress),
  }));
}

/**
 * Tek bir oturumu kapatır.
 *
 * Sahiplik `user_id` ile birlikte sorgulanır: başka kullanıcının oturum
 * kimliğini tahmin eden biri onu kapatamaz. Kayıt bulunmazsa "yok" döner —
 * "senin değil" demek, o kimliğin var olduğunu doğrulardı.
 */
export async function oturumuKapat(input: {
  userId: string;
  sessionId: string;
}): Promise<{ kapatildi: boolean; mevcutMuydu: boolean }> {
  const silinen = await db
    .delete(authSessions)
    .where(and(eq(authSessions.id, input.sessionId), eq(authSessions.userId, input.userId)))
    .returning({ id: authSessions.id });

  return { kapatildi: silinen.length > 0, mevcutMuydu: false };
}

/**
 * Mevcut oturum HARİÇ diğerlerini kapatır.
 *
 * Step-up kayıtları oturuma FK CASCADE ile bağlıdır; silinen oturumların
 * yükseltmeleri kendiliğinden düşer. Korunan oturumun yükseltmesi meşru
 * olduğu için elle silinmez.
 */
export async function digerOturumlariKapat(input: {
  userId: string;
  korunacakSessionId: string;
}): Promise<{ dusenOturum: number }> {
  const silinen = await db
    .delete(authSessions)
    .where(
      and(
        eq(authSessions.userId, input.userId),
        ne(authSessions.id, input.korunacakSessionId),
      ),
    )
    .returning({ id: authSessions.id });
  return { dusenOturum: silinen.length };
}

/**
 * Kullanıcının kalan step-up kayıtlarını sayar — doğrulama script'i,
 * oturum silinince yükseltmenin de düştüğünü buradan sınar.
 */
export async function stepUpSayisi(userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(authReauthentication)
    .where(eq(authReauthentication.userId, userId));
  return rows[0]?.n ?? 0;
}
