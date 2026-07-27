import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ipHash } from "@/lib/auth-lockout";

/**
 * Kendi uçlarımız için IP bazlı hız sınırı.
 *
 * Better Auth'un `rateLimit.customRules` yapılandırması yalnız `/api/auth/*`
 * uçlarına uygulanır; `/api/v1/*` altındaki uçlarımız onun kapsamı dışındadır.
 * Bu modül aynı DEPOYU (`auth_rate_limit`) kullanır — bellek deposu çok
 * instance'lı üretimde her instance'ta ayrı sayar ve limiti fiilen instance
 * sayısı kadar çarpardı.
 *
 * ⚠ Anahtar ham IP DEĞİL, hash'idir (PRD §6.3): sayaç tablosu da kişiyi
 * işaret eden bir veri deposu hâline gelmemelidir.
 */

export interface HizSonucu {
  izinli: boolean;
  /** Sınıra takıldıysa saniye cinsinden bekleme süresi. */
  yenidenDeneSn: number;
}

/**
 * Sayacı ATOMİK olarak artırır ve kararı döner.
 *
 * Tek bir INSERT … ON CONFLICT ifadesi kullanılır. "Oku → hesapla → yaz"
 * yapılsaydı iki paralel istek arasında bir artış kaybolur ve limit delinirdi.
 *
 * Pencere SABİTTİR (sliding değil): ilk istek pencereyi açar, `pencereSn`
 * sonra sıfırlanır. `last_request` bu yüzden "son istek" değil "pencere
 * başlangıcı" olarak kullanılır.
 */
export async function hizSiniri(input: {
  kapsam: string;
  ip: string | null | undefined;
  limit: number;
  pencereSn: number;
}): Promise<HizSonucu> {
  const anahtar = `${input.kapsam}:${ipHash(input.ip) ?? "bilinmeyen"}`;
  const simdi = Date.now();
  const pencereMs = input.pencereSn * 1000;
  const pencereBasi = simdi - pencereMs;

  const { rows } = (await db.execute(sql`
    INSERT INTO auth_rate_limit (id, key, count, last_request)
    VALUES (${anahtar}, ${input.kapsam}, 1, ${simdi})
    ON CONFLICT (id) DO UPDATE SET
      count = CASE
        WHEN auth_rate_limit.last_request < ${pencereBasi} THEN 1
        ELSE auth_rate_limit.count + 1
      END,
      last_request = CASE
        WHEN auth_rate_limit.last_request < ${pencereBasi} THEN ${simdi}
        ELSE auth_rate_limit.last_request
      END
    RETURNING count, last_request
  `)) as { rows: Array<{ count: number; last_request: string | number }> };

  const satir = rows[0];
  if (!satir) return { izinli: true, yenidenDeneSn: 0 };

  const sayac = Number(satir.count);
  const baslangic = Number(satir.last_request);
  if (sayac <= input.limit) return { izinli: true, yenidenDeneSn: 0 };

  const kalanMs = baslangic + pencereMs - simdi;
  return { izinli: false, yenidenDeneSn: Math.max(1, Math.ceil(kalanMs / 1000)) };
}
