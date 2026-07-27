import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import {
  authAccounts,
  authReauthentication,
  authSessions,
  authTwoFactors,
  authUsers,
  users,
} from "@/db/schema";
import { USER_ROLES, type UserRole } from "@/lib/auth-policy";
import { newId } from "@/lib/ids";

/**
 * Kullanıcı yönetiminin iş kuralları — TEK YER.
 *
 * API uçları, sunucu bileşenleri ve script'ler bu modülü çağırır; kuralı
 * kendileri tekrar etmez. Aynı kural iki yerde yazıldığında biri güncellenip
 * diğeri unutulur ve yetki kontrolü sessizce delinir.
 *
 * ⚠ Bu modül YETKİ KONTROLÜ YAPMAZ — çağıranın SA olduğunu ve gerekli
 * step-up'ı aldığını varsayar. Onlar rota katmanının işidir; buradaki kurallar
 * "kim yapabilir" değil, "ne tutarlıdır" sorusuna cevap verir.
 */

/**
 * `super_admin` kadrosunu değiştiren işlemleri serileştiren advisory lock.
 *
 * ⚠ Salt sayım yetmez: iki paralel istek de "2 aktif SA var, birini düşürmek
 * güvenli" sonucuna varıp FARKLI iki SA'yı aynı anda düşürebilir ve sistem
 * SA'sız kalır. Kilitlenecek tek bir satır yok — kural bir KÜMENİN sayımı
 * üzerine olduğu için `SELECT … FOR UPDATE` bu durumu doğal ifade etmiyor.
 *
 * Sabit anahtar 'sa_roster' için seçilmiş rastgele bir değerdir; başka bir
 * advisory lock ile çakışmaması dışında anlamı yoktur. Postgres bigint bekler;
 * bu değer Number.MAX_SAFE_INTEGER'ın altında olduğu için JS sayısı olarak
 * kayıpsız taşınır.
 */
export const SA_KADRO_KILIT_ANAHTARI = 7_341_002_251_884_310;

export type KullaniciDurumu = "pending" | "active" | "inactive";

export class IsKuraliHatasi extends Error {
  constructor(
    readonly code:
      | "LAST_SUPER_ADMIN"
      | "SELF_DEACTIVATE"
      | "SELF_ROLE_CHANGE"
      | "INVALID_ROLE"
      | "USER_NOT_FOUND"
      | "EMAIL_TAKEN",
    message: string,
  ) {
    super(message);
    this.name = "IsKuraliHatasi";
  }
}

/**
 * Kullanıcının durumu türetilir; ayrı bir kolon tutulmaz.
 *
 * `is_active` tek başına "davet bekliyor" ile "yönetici pasifleştirdi"
 * durumlarını ayırt edemez — ikisi de false'tur. Ayrım `activated_at`'tedir.
 */
export function kullaniciDurumu(kayit: {
  isActive: boolean;
  activatedAt: Date | null;
}): KullaniciDurumu {
  if (!kayit.activatedAt) return "pending";
  return kayit.isActive ? "active" : "inactive";
}

export function gecerliRolMu(deger: unknown): deger is UserRole {
  return typeof deger === "string" && (USER_ROLES as readonly string[]).includes(deger);
}

/**
 * Rolün kullanıcı kayıtlarında görebildiği alanlar (docs/02 §5).
 *
 * MEM listede yoktur: kullanıcı yönetimine hiç erişemez ve 404 alır — 403
 * dönmek "böyle bir uç var ama sana kapalı" bilgisini sızdırırdı.
 */
export const GORUNUR_ALANLAR: Record<
  Exclude<UserRole, "member">,
  readonly string[]
> = {
  super_admin: [
    "id",
    "email",
    "fullName",
    "phone",
    "role",
    "isActive",
    "status",
    "activatedAt",
    "lastLoginAt",
    "twoFactorEnabled",
    "createdAt",
    "invitation",
  ],
  // Salt okuma: ad, e-posta, rol, aktiflik
  finance: ["id", "email", "fullName", "role", "isActive", "status"],
  // Salt okuma: ad, rol, iletişim
  operations: ["id", "fullName", "role", "phone", "email"],
} as const;

export function kullaniciListesiniGorebilirMi(role: UserRole): boolean {
  return role !== "member";
}

export function kullaniciYonetebilirMi(role: UserRole): boolean {
  return role === "super_admin";
}

/** Yanıt gövdesini rolün görebildiği alanlarla sınırlar. */
export function alanlariSuz<T extends Record<string, unknown>>(
  kayit: T,
  role: UserRole,
): Partial<T> {
  if (role === "member") return {};
  const izinli = GORUNUR_ALANLAR[role];
  const out: Record<string, unknown> = {};
  for (const alan of izinli) {
    if (alan in kayit) out[alan] = kayit[alan];
  }
  return out as Partial<T>;
}

type Islem = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** SA kadrosunu değiştiren her transaction'ın İLK adımı. */
async function saKadrosunuKilitle(islem: Islem): Promise<void> {
  await islem.execute(sql`SELECT pg_advisory_xact_lock(${SA_KADRO_KILIT_ANAHTARI})`);
}

/**
 * Kilit alındıktan SONRA, transaction içinde aktif SA sayısını okur.
 *
 * Pasif ve davet bekleyen SA'lar sayılmaz: ikisi de giriş yapamaz, yani
 * sistemi yönetebilecek durumda değildir. Sayıma katılsalardı "en az bir SA
 * kalsın" kuralı, kimsenin giremediği bir sistemde sağlanmış görünürdü.
 */
async function aktifSaSayisi(islem: Islem, haricUserId?: string): Promise<number> {
  const kosullar = [
    eq(users.role, "super_admin"),
    eq(users.isActive, true),
    isNull(users.deletedAt),
  ];
  if (haricUserId) kosullar.push(ne(users.id, haricUserId));

  const rows = await islem
    .select({ adet: sql<number>`count(*)::int` })
    .from(users)
    .where(and(...kosullar));
  return rows[0]?.adet ?? 0;
}

/**
 * Kullanıcının tüm oturumlarını ve step-up kayıtlarını siler.
 *
 * ⚠ İkisi AYNI transaction'da düşer. Oturum silinip yükseltme kalsaydı,
 * kullanıcı yeniden giriş yaptığında eski (belki başka bir rolle alınmış)
 * yükseltmesi hâlâ geçerli olur ve kritik işlem kapısını açardı.
 * (FK CASCADE zaten oturuma bağlı kayıtları düşürür; burada kullanıcının
 * TÜM yükseltmeleri açıkça temizlenir.)
 */
async function oturumlariVeYukseltmeleriSil(
  islem: Islem,
  userId: string,
  korunacakSessionId?: string,
): Promise<number> {
  const kosul = korunacakSessionId
    ? and(eq(authSessions.userId, userId), ne(authSessions.id, korunacakSessionId))
    : eq(authSessions.userId, userId);

  const silinen = await islem
    .delete(authSessions)
    .where(kosul)
    .returning({ id: authSessions.id });

  if (!korunacakSessionId) {
    await islem
      .delete(authReauthentication)
      .where(eq(authReauthentication.userId, userId));
  }
  return silinen.length;
}

export interface KullaniciKaydi {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  activatedAt: Date | null;
}

async function kullaniciyiGetir(islem: Islem, userId: string): Promise<KullaniciKaydi> {
  const rows = await islem
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      activatedAt: users.activatedAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  const kayit = rows[0];
  if (!kayit) throw new IsKuraliHatasi("USER_NOT_FOUND", "Kullanıcı bulunamadı");
  return kayit;
}

/**
 * Rol değiştirir. Başarılıysa kullanıcının TÜM oturumları düşer.
 *
 * Oturumlar neden iptal ediliyor (rol zaten her istekte DB'den okunuyor):
 *   1. 2FA geçişi belirsiz kalır — MEM→FIN yükseltilen, 2FA'sız kullanıcının
 *      açık oturumu yarım yetkili bir ara durumda kalır
 *   2. Step-up kayıtları oturuma bağlıdır; eski rolle alınmış bir yükseltme
 *      yeni rolün kritik işlemine kapı açmamalıdır
 *   3. Yetki değişimi bir güvenlik sınırıdır; iki yakada aynı oturumun
 *      sürmesi denetim izini bulanıklaştırır
 */
export async function rolDegistir(input: {
  hedefUserId: string;
  yeniRol: UserRole;
  aktorId: string;
}): Promise<{ eskiRol: UserRole; yeniRol: UserRole; dusenOturum: number }> {
  if (!gecerliRolMu(input.yeniRol)) {
    throw new IsKuraliHatasi("INVALID_ROLE", "Geçersiz rol");
  }
  if (input.hedefUserId === input.aktorId) {
    throw new IsKuraliHatasi(
      "SELF_ROLE_CHANGE",
      "Kendi rolünüzü değiştiremezsiniz",
    );
  }

  return db.transaction(async (tx) => {
    await saKadrosunuKilitle(tx);
    const hedef = await kullaniciyiGetir(tx, input.hedefUserId);

    if (hedef.role === input.yeniRol) {
      return { eskiRol: hedef.role, yeniRol: input.yeniRol, dusenOturum: 0 };
    }

    // SA'lıktan düşürülüyorsa kadro kuralı transaction İÇİNDE tekrar sınanır
    if (hedef.role === "super_admin" && input.yeniRol !== "super_admin") {
      const kalan = await aktifSaSayisi(tx, hedef.id);
      if (kalan === 0) {
        throw new IsKuraliHatasi(
          "LAST_SUPER_ADMIN",
          "Son süper yöneticinin rolü değiştirilemez",
        );
      }
    }

    await tx
      .update(users)
      .set({ role: input.yeniRol, updatedAt: sql`now()`, updatedById: input.aktorId })
      .where(eq(users.id, hedef.id));

    const dusenOturum = await oturumlariVeYukseltmeleriSil(tx, hedef.id);
    return { eskiRol: hedef.role, yeniRol: input.yeniRol, dusenOturum };
  });
}

/**
 * Kullanıcıyı pasifleştirir veya yeniden aktifleştirir.
 *
 * Pasifleştirmede oturumlar ve step-up kayıtları AYNI transaction'da silinir:
 * yetkisi alınan kullanıcının açık sekmesi çalışmaya devam etmemelidir.
 */
export async function durumDegistir(input: {
  hedefUserId: string;
  aktif: boolean;
  aktorId: string;
}): Promise<{ dusenOturum: number }> {
  if (!input.aktif && input.hedefUserId === input.aktorId) {
    throw new IsKuraliHatasi(
      "SELF_DEACTIVATE",
      "Kendinizi pasifleştiremezsiniz",
    );
  }

  return db.transaction(async (tx) => {
    await saKadrosunuKilitle(tx);
    const hedef = await kullaniciyiGetir(tx, input.hedefUserId);

    if (!input.aktif && hedef.role === "super_admin") {
      const kalan = await aktifSaSayisi(tx, hedef.id);
      if (kalan === 0) {
        throw new IsKuraliHatasi(
          "LAST_SUPER_ADMIN",
          "Son süper yönetici pasifleştirilemez",
        );
      }
    }

    await tx
      .update(users)
      .set({ isActive: input.aktif, updatedAt: sql`now()`, updatedById: input.aktorId })
      .where(eq(users.id, hedef.id));

    if (input.aktif) return { dusenOturum: 0 };
    const dusenOturum = await oturumlariVeYukseltmeleriSil(tx, hedef.id);
    return { dusenOturum };
  });
}

/**
 * 2FA'yı sıfırlar: kayıtlı TOTP sırrı ve kurtarma kodları silinir, kullanıcı
 * bir sonraki girişte kurulumu baştan yapar.
 *
 * Oturumlar ve step-up kayıtları da düşer — ikinci faktörü sıfırlanmış bir
 * kullanıcının, o faktörle açılmış oturumu geçerli kalmamalıdır.
 */
export async function ikiFaSifirla(input: {
  hedefUserId: string;
  aktorId: string;
}): Promise<{ dusenOturum: number }> {
  return db.transaction(async (tx) => {
    const hedef = await kullaniciyiGetir(tx, input.hedefUserId);

    await tx.delete(authTwoFactors).where(eq(authTwoFactors.userId, hedef.id));
    await tx
      .update(authUsers)
      .set({ twoFactorEnabled: false })
      .where(eq(authUsers.id, hedef.id));
    await tx
      .update(users)
      .set({ totpEnabledAt: null, updatedAt: sql`now()`, updatedById: input.aktorId })
      .where(eq(users.id, hedef.id));

    const dusenOturum = await oturumlariVeYukseltmeleriSil(tx, hedef.id);
    return { dusenOturum };
  });
}

/**
 * Bir kullanıcının tüm oturumlarını iptal eder.
 *
 * `korunacakSessionId` verilirse o oturum ayakta kalır — kullanıcının kendi
 * "diğer tüm oturumlarımı kapat" işlemi için. Bu durumda step-up kayıtları
 * silinmez, çünkü korunan oturumun yükseltmesi hâlâ meşrudur.
 */
export async function oturumlariIptalEt(input: {
  hedefUserId: string;
  korunacakSessionId?: string;
}): Promise<{ dusenOturum: number }> {
  return db.transaction(async (tx) => {
    const dusenOturum = await oturumlariVeYukseltmeleriSil(
      tx,
      input.hedefUserId,
      input.korunacakSessionId,
    );
    return { dusenOturum };
  });
}

/**
 * Davet bekleyen kullanıcı oluşturur.
 *
 * ⚠ `auth_account` credential satırı HİÇ YAZILMAZ. Parolası olmayan bir
 * hesaba parola ile giriş matematiksel olarak imkânsızdır — "giriş yapamaz"
 * kuralı bir bayrağa değil, verinin yokluğuna dayanır. İkinci katman olarak
 * `getCurrentUser()` zaten `is_active=false` kullanıcıya null döner.
 *
 * Davet kaydı bu transaction'da OLUŞTURULMAZ; çağıran `davetOlustur`'u ayrıca
 * çağırır. Sebep: davet üretimi kendi transaction'ında eski davetleri iptal
 * eder ve ham token'ı yalnız oraya döner.
 */
export async function bekleyenKullaniciOlustur(input: {
  email: string;
  fullName: string;
  role: UserRole;
  aktorId: string;
}): Promise<{ userId: string }> {
  if (!gecerliRolMu(input.role)) {
    throw new IsKuraliHatasi("INVALID_ROLE", "Geçersiz rol");
  }
  const email = input.email.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const mevcut = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (mevcut[0]) {
      throw new IsKuraliHatasi("EMAIL_TAKEN", "Bu e-posta zaten kayıtlı");
    }

    const userId = newId();

    await tx.insert(authUsers).values({
      id: userId,
      name: input.fullName,
      email,
      emailVerified: false,
    });

    await tx.insert(users).values({
      id: userId,
      email,
      fullName: input.fullName,
      role: input.role,
      // Davet kabul edilene kadar giriş yapamaz
      isActive: false,
      activatedAt: null,
      createdById: input.aktorId,
    });

    return { userId };
  });
}

/**
 * Kullanıcının parolası var mı — davet kabul edilmiş mi sorusunun veri
 * tarafındaki karşılığı. Testler ve doğrulama script'i için.
 */
export async function parolasiVarMi(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")),
    )
    .limit(1);
  return Boolean(rows[0]);
}
