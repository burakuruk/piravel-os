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

/** Better Auth'un kendi kayıtlarından ayıran önek. */
export const ANAHTAR_ONEKI = "piravel:";

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
  /**
   * ⚠ İSİM ALANI ZORUNLU. `auth_rate_limit` tablosunu Better Auth ile
   * PAYLAŞIYORUZ; o kendi anahtarlarını (genellikle "<ip>" veya "<ip>/<yol>")
   * aynı `id` sütununa yazar. Önek olmadan iki sayaç aynı satıra düşebilir ve
   * biri diğerinin penceresini sıfırlayabilirdi.
   *
   * Anahtarda ham IP BULUNMAZ — yalnız hash'i (PRD §6.3). Böylece sayaç
   * tablosu da kişiyi işaret eden bir veri deposuna dönüşmez.
   */
  const anahtar = `${ANAHTAR_ONEKI}${input.kapsam}:${ipHash(input.ip) ?? "bilinmeyen"}`;
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

/**
 * Süresi geçmiş sayaç satırlarını siler.
 *
 * ⚠ Tablo KENDİLİĞİNDEN KÜÇÜLMEZ: her yeni IP hash'i kalıcı bir satır bırakır
 * ve pencere dolduğunda satır silinmez, yalnız sıfırlanır. Uzun vadede bu
 * tablo sınırsız büyür.
 *
 * Temizlik BURADA otomatik yapılmaz — istek yolunda çalıştırılırsa her istek
 * bir tablo taramasının bedelini öder. Sprint 6'daki günlük job bu fonksiyonu
 * çağıracak; o gelene kadar tablo elle veya `db:cleanup` ile boşaltılabilir.
 * Better Auth'un kendi kayıtları (öneksiz) dokunulmadan bırakılır.
 */
export async function eskiSayaclariTemizle(yasSn = 24 * 3600): Promise<number> {
  const esik = Date.now() - yasSn * 1000;
  const sonuc = (await db.execute(sql`
    DELETE FROM auth_rate_limit
     WHERE id LIKE ${`${ANAHTAR_ONEKI}%`}
       AND last_request < ${esik}
  `)) as { rowCount?: number };
  return sonuc.rowCount ?? 0;
}
