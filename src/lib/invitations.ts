import { createHmac, randomBytes } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { authAccounts, userInvitations, users } from "@/db/schema";
import { inviteTokenPepper } from "@/lib/env";
import {
  DAVET_CEREZ_SURESI_SN,
  DAVET_GECERLILIK_SAAT,
  DAVET_HATA_KODU,
  DAVET_HATA_MESAJI,
  MIN_PAROLA_UZUNLUGU,
} from "@/lib/invitation-sabitler";
import { newId } from "@/lib/ids";

/**
 * Davet yaşam döngüsü — token üretimi, doğrulama ve durum yönetimi.
 *
 * ⚠ PRD §6.3: Ham davet token'ı yalnız iki yerde bulunur — oluşturma
 * yanıtında (bir kez) ve kullanıcının e-postasındaki bağlantıda. Veritabanına,
 * log'a, audit'e, Sentry'ye veya ekran görüntüsüne ASLA yazılmaz. Saklanan
 * değer HMAC-SHA256(token, INVITE_TOKEN_PEPPER)'dir.
 *
 * Neden düz `sha256(pepper + token)` değil de HMAC: birleştirme, temeldeki
 * Merkle–Damgård yapısı yüzünden uzunluk uzatma saldırısına açıktır ve
 * pepper/token sınırı belirsizdir. HMAC bu sınırı tanımlar.
 */

/**
 * Sabitler `invitation-sabitler.ts`'te tutulur ve buradan yeniden dışa verilir.
 * Sebep: istemci bileşenleri bu dosyadan import ederse `pg` tarayıcı paketine
 * girer ve derleme düşer (bkz. o dosyanın başlığı).
 */
export {
  DAVET_CEREZ_ADI,
  DAVET_CEREZ_SURESI_SN,
  DAVET_GECERLILIK_SAAT,
  DAVET_HATA_KODU,
  DAVET_HATA_MESAJI,
  MIN_PAROLA_UZUNLUGU,
} from "@/lib/invitation-sabitler";

export type DavetDurumu = "pending" | "accepted" | "revoked" | "expired";

export interface DavetKaydi {
  id: string;
  userId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  cookieExpiresAt: Date | null;
}

/**
 * Durum kolonda tutulmaz, türetilir — tek bir "status" kolonu, zaman geçtikçe
 * gerçekle uyumsuz kalırdı (expired olması için kimsenin yazması gerekmez).
 *
 * Sıra önemlidir: kabul edilmiş bir davet süresi geçse de "accepted" kalır,
 * iptal edilmiş bir davet süresi geçse de "revoked" kalır. Aksi hâlde aynı
 * kayıt zamanla durum değiştirmiş gibi görünürdü.
 */
export function davetDurumu(kayit: DavetKaydi, simdi: Date = new Date()): DavetDurumu {
  if (kayit.acceptedAt) return "accepted";
  if (kayit.revokedAt) return "revoked";
  if (kayit.expiresAt.getTime() <= simdi.getTime()) return "expired";
  return "pending";
}

/** Davet yalnız `pending` iken kabul edilebilir. */
export function kabulEdilebilirMi(kayit: DavetKaydi, simdi: Date = new Date()): boolean {
  return davetDurumu(kayit, simdi) === "pending";
}

/** Çerez eşlemesi ayrıca kendi (çok daha kısa) süresine tabidir. */
export function cerezGecerliMi(kayit: DavetKaydi, simdi: Date = new Date()): boolean {
  if (!kayit.cookieExpiresAt) return false;
  return kayit.cookieExpiresAt.getTime() > simdi.getTime();
}

/** 32 bayt rastgele → base64url. Tahmin edilemez ve URL'de güvenlidir. */
export function davetTokenUret(): string {
  return randomBytes(32).toString("base64url");
}

/** Çerezde taşınan rastgele davet oturum kimliği — token'dan BAĞIMSIZDIR. */
export function cerezKimligiUret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Token ve çerez kimliği aynı pepper'ı kullanır ama farklı alan adlarıyla
 * (domain separation): birinin hash'i diğerinin yerine geçemez.
 */
function hmac(alan: string, deger: string): string {
  return createHmac("sha256", inviteTokenPepper()).update(`${alan}:${deger}`).digest("hex");
}

export function davetTokenHash(token: string): string {
  return hmac("invite_token", token);
}

export function cerezHash(kimlik: string): string {
  return hmac("invite_cookie", kimlik);
}

/** Token biçimi kabaca doğru mu — DB'ye gitmeden bariz çöpü eler. */
export function tokenBicimiGecerliMi(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(token);
}

const SECILEN_ALANLAR = {
  id: userInvitations.id,
  userId: userInvitations.userId,
  expiresAt: userInvitations.expiresAt,
  acceptedAt: userInvitations.acceptedAt,
  revokedAt: userInvitations.revokedAt,
  cookieExpiresAt: userInvitations.cookieExpiresAt,
};

type Islem = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Kullanıcının AÇIK (kabul/iptal edilmemiş) tüm davetlerini iptal eder —
 * süresi dolmuş olanlar dahil.
 *
 * ⚠ "Süresi dolmuş olanlar dahil" kısmı kritiktir: `uq_invitation_one_open_per_user`
 * index'i now() kullanamadığı için süresi dolmuş bir daveti hâlâ "açık" sayar.
 * Yalnız index'e güvenilseydi, süresi dolmuş tek bir davet o kullanıcı için
 * yeni davet üretimini KALICI olarak kilitlerdi.
 */
export async function acikDavetleriIptalEt(
  islem: Islem,
  userId: string,
  revokedById: string | null,
): Promise<number> {
  const silinen = await islem
    .update(userInvitations)
    .set({
      revokedAt: sql`now()`,
      revokedById,
      updatedAt: sql`now()`,
      // Eşleme düşer: iptal edilen davetin çerezi de anında geçersizdir
      cookieHash: null,
      cookieExpiresAt: null,
    })
    .where(
      and(
        eq(userInvitations.userId, userId),
        isNull(userInvitations.acceptedAt),
        isNull(userInvitations.revokedAt),
      ),
    )
    .returning({ id: userInvitations.id });
  return silinen.length;
}

/**
 * Yeni davet üretir. Varsa önceki açık davetler AYNI transaction içinde
 * iptal edilir — böylece eski bağlantı anında geçersizleşir ve iki aktif
 * davet oluşamaz.
 *
 * Ham token yalnız DÖNÜŞ DEĞERİNDE bulunur; çağıran onu bir kez gösterip
 * bırakmalıdır.
 */
export async function davetOlustur(input: {
  userId: string;
  createdById: string | null;
  requestId?: string | null;
}): Promise<{ invitationId: string; token: string; expiresAt: Date }> {
  const token = davetTokenUret();
  const tokenHash = davetTokenHash(token);
  const expiresAt = new Date(Date.now() + DAVET_GECERLILIK_SAAT * 3600 * 1000);

  const invitationId = await db.transaction(async (tx) => {
    await acikDavetleriIptalEt(tx, input.userId, input.createdById);
    const eklenen = await tx
      .insert(userInvitations)
      .values({
        userId: input.userId,
        tokenHash,
        expiresAt,
        createdById: input.createdById,
        createdRequestId: input.requestId ?? null,
      })
      .returning({ id: userInvitations.id });
    return eklenen[0].id;
  });

  return { invitationId, token, expiresAt };
}

/** Ham token ile davet kaydını bulur. Bulunamazsa null — sebep açıklanmaz. */
export async function davetiTokenIleBul(token: string): Promise<DavetKaydi | null> {
  if (!tokenBicimiGecerliMi(token)) return null;
  const rows = await db
    .select(SECILEN_ALANLAR)
    .from(userInvitations)
    .where(eq(userInvitations.tokenHash, davetTokenHash(token)))
    .limit(1);
  return rows[0] ?? null;
}

/** Çerezdeki kimlik ile davet kaydını bulur. */
export async function davetiCerezIleBul(cerezKimligi: string): Promise<DavetKaydi | null> {
  if (!tokenBicimiGecerliMi(cerezKimligi)) return null;
  const rows = await db
    .select(SECILEN_ALANLAR)
    .from(userInvitations)
    .where(eq(userInvitations.cookieHash, cerezHash(cerezKimligi)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Daveti bir çereze bağlar ve çerezde taşınacak ham kimliği döner.
 *
 * GET /davet/[token] bunu çağırır, sonra temiz URL'e yönlendirir; böylece ham
 * token tarayıcı geçmişinde, Referer'da ve sunucu erişim log'unda kalmaz.
 * Bu adım daveti DEĞİŞTİRMEZ — kabul yalnız POST ile olur.
 */
export class DavetKullanilamaz extends Error {
  readonly code = DAVET_HATA_KODU;
  /** Gerçek sebep YALNIZ audit'e yazılır; dışarıya tek tip mesaj döner. */
  constructor(readonly sebep: string) {
    super(DAVET_HATA_MESAJI);
    this.name = "DavetKullanilamaz";
  }
}

/**
 * Daveti kabul eder — parola belirleme, aktivasyon ve kabul TEK transaction.
 *
 * ⚠ Parola hash'i Better Auth'un KENDİ mekanizmasıyla üretilir
 * (`auth.$context.password.hash`); burada elle hash yazılmaz. Better Auth'un
 * yalnız hash'leyicisi kullanıldığı için satırı BİZ yazarız — böylece
 * credential, aktivasyon ve kabul aynı transaction'a girer ve yarı aktif
 * kullanıcı hiç oluşamaz. (Better Auth'un kendi sign-up ucu çağrılsaydı kendi
 * bağlantısını kullanır ve transaction'ımızın dışında kalırdı.)
 *
 * Hash'leme transaction'dan ÖNCE yapılır: argon2 yüzlerce milisaniye sürer ve
 * bu süre boyunca satır kilidi tutmak eşzamanlı istekleri gereksiz bekletirdi.
 */
export async function davetiKabulEt(input: {
  cerezKimligi: string;
  parola: string;
  parolaHashle: (parola: string) => Promise<string>;
  requestId?: string | null;
}): Promise<{ userId: string; email: string; role: string }> {
  if (typeof input.parola !== "string" || input.parola.length < MIN_PAROLA_UZUNLUGU) {
    throw new DavetKullanilamaz("parola_kisa");
  }

  const aday = await davetiCerezIleBul(input.cerezKimligi);
  if (!aday) throw new DavetKullanilamaz("cerez_eslesmedi");
  if (!cerezGecerliMi(aday)) throw new DavetKullanilamaz("cerez_suresi_doldu");
  if (!kabulEdilebilirMi(aday)) throw new DavetKullanilamaz(davetDurumu(aday));

  const hash = await input.parolaHashle(input.parola);

  return db.transaction(async (tx) => {
    /**
     * Satır kilidi: iki eşzamanlı kabul isteğinden yalnız biri geçmeli.
     * Kilit alındıktan SONRA durum yeniden okunur — ilk istek accepted_at'i
     * yazmışsa ikincisi burada elenir ve hiçbir yeni etki üretmez.
     */
    const kilitli = await tx
      .select({
        id: userInvitations.id,
        userId: userInvitations.userId,
        expiresAt: userInvitations.expiresAt,
        acceptedAt: userInvitations.acceptedAt,
        revokedAt: userInvitations.revokedAt,
        cookieExpiresAt: userInvitations.cookieExpiresAt,
      })
      .from(userInvitations)
      .where(eq(userInvitations.id, aday.id))
      .for("update")
      .limit(1);

    const kayit = kilitli[0];
    if (!kayit) throw new DavetKullanilamaz("kayit_yok");
    if (!cerezGecerliMi(kayit)) throw new DavetKullanilamaz("cerez_suresi_doldu");
    if (!kabulEdilebilirMi(kayit)) throw new DavetKullanilamaz(davetDurumu(kayit));

    const kullanici = await tx
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, kayit.userId))
      .limit(1);
    if (!kullanici[0]) throw new DavetKullanilamaz("kullanici_yok");

    /**
     * Credential satırı: normalde hiç yoktur (davet edilen kullanıcıya parola
     * yazılmaz). Yine de UPSERT kullanılır — veri elle bozulmuş ya da önceki
     * bir deneme yarıda kalmışsa kabul yine tamamlanabilsin diye.
     */
    const mevcut = await tx
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.userId, kayit.userId),
          eq(authAccounts.providerId, "credential"),
        ),
      )
      .limit(1);

    if (mevcut[0]) {
      await tx
        .update(authAccounts)
        .set({ password: hash, updatedAt: sql`now()` })
        .where(eq(authAccounts.id, mevcut[0].id));
    } else {
      await tx.insert(authAccounts).values({
        id: newId(),
        userId: kayit.userId,
        accountId: kayit.userId,
        providerId: "credential",
        password: hash,
      });
    }

    await tx
      .update(users)
      .set({
        isActive: true,
        activatedAt: sql`now()`,
        passwordChangedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, kayit.userId));

    await tx
      .update(userInvitations)
      .set({
        acceptedAt: sql`now()`,
        updatedAt: sql`now()`,
        // Çerez eşlemesi kabul anında DÜŞER — bağlantı ikinci kez işlemez
        cookieHash: null,
        cookieExpiresAt: null,
      })
      .where(eq(userInvitations.id, kayit.id));

    // Aynı kullanıcının başka açık daveti varsa o da kapanır
    await tx
      .update(userInvitations)
      .set({ revokedAt: sql`now()`, updatedAt: sql`now()`, cookieHash: null, cookieExpiresAt: null })
      .where(
        and(
          eq(userInvitations.userId, kayit.userId),
          ne(userInvitations.id, kayit.id),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt),
        ),
      );

    return {
      userId: kullanici[0].id,
      email: kullanici[0].email,
      role: kullanici[0].role,
    };
  });
}

export async function cerezeBagla(invitationId: string): Promise<string> {
  const cerezKimligi = cerezKimligiUret();
  await db
    .update(userInvitations)
    .set({
      cookieHash: cerezHash(cerezKimligi),
      cookieExpiresAt: new Date(Date.now() + DAVET_CEREZ_SURESI_SN * 1000),
      updatedAt: sql`now()`,
    })
    .where(eq(userInvitations.id, invitationId));
  return cerezKimligi;
}
