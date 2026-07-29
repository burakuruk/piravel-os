import { and, asc, eq, ilike, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import {
  brandAssignments,
  brandContacts,
  brands,
  brandServices,
  services,
  users,
} from "@/db/schema";
import type { UserRole } from "@/lib/auth-policy";
import type { CurrentUser } from "@/lib/authz";
import { newId } from "@/lib/ids";

/**
 * Marka modülünün iş kuralları — TEK YER (Sprint 2).
 *
 * API uçları, sunucu bileşenleri ve script'ler bu modülü çağırır; kuralı
 * kendileri tekrar etmez. Aynı kural iki yerde yazıldığında biri güncellenip
 * diğeri unutulur ve yetki kontrolü sessizce delinir.
 *
 * ⚠ Yetki kapıları (kim çağırabilir) `@/lib/api` katmanındadır; buradaki
 * fonksiyonlar KAPSAMI (hangi satırlar) ve ALAN SÜZGECİNİ (hangi kolonlar)
 * kendileri uygular — ikisi de veriye en yakın yerde durmalı.
 */

// ══════════════════════════════════════════════════════════════════════════
// Hatalar
// ══════════════════════════════════════════════════════════════════════════

export class MarkaKuralHatasi extends Error {
  constructor(
    readonly code:
      | "BRAND_NOT_FOUND"
      | "BRAND_CODE_TAKEN"
      | "BRAND_CODE_IMMUTABLE"
      | "SERVICE_NOT_FOUND"
      | "SERVICE_CODE_TAKEN"
      | "SERVICE_INACTIVE"
      | "CONTACT_NOT_FOUND"
      | "USER_NOT_ASSIGNABLE"
      | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "MarkaKuralHatasi";
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Kod normalizasyonu
// ══════════════════════════════════════════════════════════════════════════

/**
 * Marka ve hizmet kodu: trim + BÜYÜK HARF.
 *
 * Benzersizlik büyük/küçük harf duyarsızdır — "svz", "SVZ " ve "Svz" aynı
 * markadır. Normalizasyon TEK giriş noktasında yapılır; DB'de ayrıca CHECK
 * ve `upper(code)` unique index'i vardır (0010), yani elle atılan bir INSERT
 * de kuralın dışına çıkamaz.
 *
 * ⚠ `toUpperCase()` kullanılır, `toLocaleUpperCase()` DEĞİL: Türkçe yerelde
 * küçük "i" noktalı büyük harfe dönüşür ve aynı kod, sunucunun yereline göre
 * iki farklı değere normalize olurdu. Kod zaten ASCII olmak zorunda
 * (KOD_DESENI); dönüşüm de yerelden bağımsız kalmalı.
 */
export function kodNormalize(deger: unknown): string {
  if (typeof deger !== "string") return "";
  return deger.trim().toUpperCase();
}

/** Kod deseni: 2–16 karakter, yalnız ASCII harf/rakam/tire. */
export const KOD_DESENI = /^[A-Z0-9][A-Z0-9-]{0,14}[A-Z0-9]$/;

export function gecerliKodMu(kod: string): boolean {
  return KOD_DESENI.test(kod);
}

// ══════════════════════════════════════════════════════════════════════════
// Rol kapıları (docs/02 §3.1–3.2 + Sprint 2 onaylı matris)
// ══════════════════════════════════════════════════════════════════════════

/**
 * MEM marka modülüne HİÇ erişemez ve 404 görür.
 *
 * 403 dönmek "böyle bir uç var ama sana kapalı" bilgisini sızdırırdı; MEM için
 * ucun varlığı da gizlenir (kullanıcı modülüyle aynı ilke).
 */
export function markaModulunuGorebilirMi(role: UserRole): boolean {
  return role !== "member";
}

/** Marka oluşturma/düzenleme yetkisi: SA ve FIN. */
export function markaYonetebilirMi(role: UserRole): boolean {
  return role === "super_admin" || role === "finance";
}

/** Silme/geri yükleme yalnız SA. */
export function markaSilebilirMi(role: UserRole): boolean {
  return role === "super_admin";
}

/** Ekip ataması yalnız SA ve FIN. */
export function atamaYonetebilirMi(role: UserRole): boolean {
  return role === "super_admin" || role === "finance";
}

/** Hizmet kataloğu yönetimi: SA ve FIN (docs/02 §3.2). */
export function hizmetKatalogunuYonetebilirMi(role: UserRole): boolean {
  return role === "super_admin" || role === "finance";
}

/**
 * Markaya ATANABİLİR roller — yalnız OPS.
 *
 * SA ve FIN rolleri gereği zaten tüm markaları görür; atamak bir şeyi
 * değiştirmez ve "atanmış" görünmeleri yetki tablosunu yanıltır. MEM marka
 * modülüne hiç erişemediği için atanması anlamsızdır.
 */
export function atanabilirMi(role: UserRole): boolean {
  return role === "operations";
}

// ══════════════════════════════════════════════════════════════════════════
// Alan görünürlüğü
// ══════════════════════════════════════════════════════════════════════════

/**
 * Rolün marka kaydında görebildiği alanlar.
 *
 * ⚠ OPS'ta `taxNumber` ve `taxOffice` YOKTUR. Süzme yanıt gövdesinde yapılır,
 * UI'da değil: gövdeye hiç girmeyen alan sızdırılamaz. UI'da gizlemek,
 * `curl` ile bakan birine karşı hiçbir şey yapmaz.
 */
export const MARKA_GORUNUR_ALANLAR: Record<
  Exclude<UserRole, "member">,
  readonly string[]
> = {
  super_admin: [
    "id", "code", "name", "legalName", "taxNumber", "taxOffice", "industry",
    "website", "email", "phone", "address", "status", "onboardedAt",
    "churnedAt", "notes", "hizmetSayisi", "ekipSayisi", "birincilYetkili",
    "createdAt",
  ],
  finance: [
    "id", "code", "name", "legalName", "taxNumber", "taxOffice", "industry",
    "website", "email", "phone", "address", "status", "onboardedAt",
    "churnedAt", "notes", "hizmetSayisi", "ekipSayisi", "birincilYetkili",
    "createdAt",
  ],
  // Vergi alanları YOK — operasyonun işi değil, sızdırmanın anlamı da yok
  operations: [
    "id", "code", "name", "legalName", "industry", "website", "email",
    "phone", "address", "status", "onboardedAt", "notes", "hizmetSayisi",
    "ekipSayisi", "birincilYetkili", "createdAt",
  ],
} as const;

/** OPS'un DÜZENLEYEBİLDİĞİ alanlar — operasyonel iletişim/varlık bilgileri. */
export const OPS_DUZENLEYEBILIR = [
  "name", "industry", "website", "email", "phone", "address", "notes",
] as const;

/** Yanıt gövdesini rolün görebildiği alanlarla sınırlar. */
export function markaAlanlariniSuz<T extends Record<string, unknown>>(
  kayit: T,
  role: UserRole,
): Partial<T> {
  if (role === "member") return {};
  const izinli = MARKA_GORUNUR_ALANLAR[role];
  const out: Record<string, unknown> = {};
  for (const alan of izinli) if (alan in kayit) out[alan] = kayit[alan];
  return out as Partial<T>;
}

/**
 * Güncelleme gövdesini rolün DÜZENLEYEBİLDİĞİ alanlarla sınırlar.
 *
 * ⚠ `code` hiçbir rolde yoktur: marka kodu oluşturulduktan sonra
 * değiştirilemez (DB'de de trigger ile kilitli).
 */
export function markaGuncellemeAlanlariniSuz(
  govde: Record<string, unknown>,
  role: UserRole,
): Record<string, unknown> {
  const tumu = [
    "name", "legalName", "taxNumber", "taxOffice", "industry", "website",
    "email", "phone", "address", "notes",
  ] as const;
  const izinli: readonly string[] =
    role === "operations" ? OPS_DUZENLEYEBILIR : tumu;

  const out: Record<string, unknown> = {};
  for (const alan of izinli) {
    if (alan in govde) out[alan] = govde[alan];
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════
// Kapsam — OPS yalnız atandığı markaları görür
// ══════════════════════════════════════════════════════════════════════════

/**
 * Kapsam koşulu — VERİTABANI SORGUSUNUN İÇİNDE.
 *
 * ⚠ Kapsam "önce hepsini çek, sonra süz" ile uygulanmaz: süzme uygulamada
 * yapılırsa sayfalama, sayım ve CSV yanlış çalışır ve bir gün biri süzmeyi
 * atlar. Koşul her sorguya WHERE olarak girer; atanmamış satır sorgunun
 * sonucuna hiç girmez.
 *
 * SA/FIN → undefined (kapsam yok, tümü)
 * OPS    → brand_assignments alt sorgusu (yalnız canlı atamalar)
 * MEM    → asla eşleşmeyen koşul; çağıran zaten 404 döner
 */
export function markaKapsamKosulu(user: CurrentUser, brandIdCol = brands.id) {
  if (user.role === "super_admin" || user.role === "finance") return undefined;
  if (user.role === "member") return sql`false`;
  return inArray(
    brandIdCol,
    db
      .select({ id: brandAssignments.brandId })
      .from(brandAssignments)
      .where(
        and(eq(brandAssignments.userId, user.id), isNull(brandAssignments.deletedAt)),
      ),
  );
}

/**
 * Markaya erişim — kapsam dışıysa "yok" gibi davranılır.
 *
 * Var olan ama erişilemeyen bir marka için 403 dönmek, OPS'a hangi markaların
 * VAR OLDUĞUNU söylerdi. Yanıt 404'tür.
 */
export async function markayaErisebilirMi(
  user: CurrentUser,
  brandId: string,
): Promise<boolean> {
  if (!markaModulunuGorebilirMi(user.role)) return false;
  const kosul = markaKapsamKosulu(user);
  const rows = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt), kosul))
    .limit(1);
  return Boolean(rows[0]);
}

// ══════════════════════════════════════════════════════════════════════════
// Marka listesi ve detayı
// ══════════════════════════════════════════════════════════════════════════

export interface MarkaFiltresi {
  /** Ad VEYA kod içinde arar (tek kutu). */
  q?: string;
  status?: string;
  industry?: string;
}

/** Canlı hizmet sayısı — korelasyonlu alt sorgu, satır başına tek değer. */
const hizmetSayisiSql = sql<number>`(
  SELECT count(*)::int FROM ${brandServices}
   WHERE ${brandServices.brandId} = ${brands.id}
     AND ${brandServices.deletedAt} IS NULL
)`;

/** Canlı atama sayısı. */
const ekipSayisiSql = sql<number>`(
  SELECT count(*)::int FROM ${brandAssignments}
   WHERE ${brandAssignments.brandId} = ${brands.id}
     AND ${brandAssignments.deletedAt} IS NULL
)`;

/** Birincil yetkilinin adı — listede "hangi marka boşta" sorusu için. */
const birincilYetkiliSql = sql<string | null>`(
  SELECT ${brandContacts.fullName} FROM ${brandContacts}
   WHERE ${brandContacts.brandId} = ${brands.id}
     AND ${brandContacts.isPrimary}
     AND ${brandContacts.deletedAt} IS NULL
   LIMIT 1
)`;

function aramaKosulu(q: string | undefined) {
  const terim = (q ?? "").trim();
  if (terim.length === 0) return undefined;
  /**
   * Arama tek kutuda ad VE kod üzerinde çalışır ve içeriden eşleşir
   * ("klinik" → "Test Klinik"). `%` ve `_` kaçırılır; aksi hâlde "%" araması
   * tüm tabloyu döndürürdü. Trigram indeksleri (0010) bu deseni kullanabilir.
   */
  const kacisli = terim.replace(/[\\%_]/g, (k) => `\\${k}`);
  return or(ilike(brands.name, `%${kacisli}%`), ilike(brands.code, `%${kacisli}%`));
}

/** Ham marka satırı — süzgeçten GEÇMEDEN önceki hâli. */
async function markaSatirlari(user: CurrentUser, filtre: MarkaFiltresi = {}) {
  const kosullar = [
    isNull(brands.deletedAt),
    markaKapsamKosulu(user),
    aramaKosulu(filtre.q),
    filtre.status ? eq(brands.status, filtre.status as never) : undefined,
    filtre.industry ? eq(brands.industry, filtre.industry) : undefined,
  ].filter(Boolean);

  return db
    .select({
      id: brands.id,
      code: brands.code,
      name: brands.name,
      legalName: brands.legalName,
      taxNumber: brands.taxNumber,
      taxOffice: brands.taxOffice,
      industry: brands.industry,
      website: brands.website,
      email: brands.email,
      phone: brands.phone,
      address: brands.address,
      status: brands.status,
      onboardedAt: brands.onboardedAt,
      churnedAt: brands.churnedAt,
      notes: brands.notes,
      createdAt: brands.createdAt,
      hizmetSayisi: hizmetSayisiSql,
      ekipSayisi: ekipSayisiSql,
      birincilYetkili: birincilYetkiliSql,
    })
    .from(brands)
    .where(and(...kosullar))
    .orderBy(asc(brands.name));
}

/**
 * Marka listesi — kapsam ve alan süzgeci uygulanmış hâlde.
 *
 * MEM buraya hiç gelmemeli (rota 404 döner); yine de boş döner: savunma
 * derinliği, tek kapıya güvenilmez.
 */
export async function markalariListele(user: CurrentUser, filtre: MarkaFiltresi = {}) {
  if (!markaModulunuGorebilirMi(user.role)) return [];
  const satirlar = await markaSatirlari(user, filtre);
  return satirlar.map((s) => markaAlanlariniSuz(s, user.role));
}

/** Tek marka — listeyle AYNI kapsam ve AYNI alan süzgecinden geçer. */
export async function markaDetayi(user: CurrentUser, brandId: string) {
  if (!markaModulunuGorebilirMi(user.role)) return null;
  const kosul = markaKapsamKosulu(user);
  const satirlar = await db
    .select({
      id: brands.id,
      code: brands.code,
      name: brands.name,
      legalName: brands.legalName,
      taxNumber: brands.taxNumber,
      taxOffice: brands.taxOffice,
      industry: brands.industry,
      website: brands.website,
      email: brands.email,
      phone: brands.phone,
      address: brands.address,
      status: brands.status,
      onboardedAt: brands.onboardedAt,
      churnedAt: brands.churnedAt,
      notes: brands.notes,
      createdAt: brands.createdAt,
      hizmetSayisi: hizmetSayisiSql,
      ekipSayisi: ekipSayisiSql,
      birincilYetkili: birincilYetkiliSql,
    })
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt), kosul))
    .limit(1);

  const satir = satirlar[0];
  if (!satir) return null;
  return markaAlanlariniSuz(satir, user.role);
}

// ══════════════════════════════════════════════════════════════════════════
// Marka oluşturma / güncelleme
// ══════════════════════════════════════════════════════════════════════════

export interface YeniMarka {
  code: string;
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  industry?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
}

function metin(deger: unknown): string | null {
  if (typeof deger !== "string") return null;
  const t = deger.trim();
  return t.length > 0 ? t : null;
}

/**
 * Marka oluşturur.
 *
 * Kod normalize edilir ve benzersizliği DB'ye bırakılır: önce SELECT ile
 * bakıp sonra INSERT etmek, iki eşzamanlı istekte ikisinin de "boşta" görüp
 * aynı kodu yazmasına açık kapı bırakır. Unique index ihlali yakalanıp
 * anlaşılır hataya çevrilir.
 */
export async function markaOlustur(input: YeniMarka & { aktorId: string }) {
  const code = kodNormalize(input.code);
  const name = metin(input.name);

  if (!gecerliKodMu(code)) {
    throw new MarkaKuralHatasi(
      "VALIDATION",
      "Marka kodu 2-16 karakter olmalı; yalnız harf, rakam ve tire içerebilir",
    );
  }
  if (!name || name.length < 2) {
    throw new MarkaKuralHatasi("VALIDATION", "Marka adı en az 2 karakter olmalıdır");
  }

  const id = newId();
  try {
    await db.insert(brands).values({
      id,
      code,
      name,
      legalName: metin(input.legalName),
      taxNumber: metin(input.taxNumber),
      taxOffice: metin(input.taxOffice),
      industry: metin(input.industry),
      email: metin(input.email),
      phone: metin(input.phone),
      website: metin(input.website),
      address: metin(input.address),
      notes: metin(input.notes),
      createdById: input.aktorId,
    });
  } catch (e) {
    if (benzersizlikIhlali(e, "uq_brands_code")) {
      throw new MarkaKuralHatasi("BRAND_CODE_TAKEN", `"${code}" kodu zaten kullanılıyor`);
    }
    throw e;
  }
  return { id, code };
}

/**
 * Markayı günceller. `code` gövdede gelse bile YOK SAYILMAZ — açıkça
 * reddedilir: sessizce yutmak, kullanıcıya "değiştirdim" yanılgısı verirdi.
 */
export async function markaGuncelle(input: {
  brandId: string;
  govde: Record<string, unknown>;
  role: UserRole;
  aktorId: string;
}) {
  if ("code" in input.govde) {
    const yeni = kodNormalize(input.govde.code);
    const mevcut = await db
      .select({ code: brands.code })
      .from(brands)
      .where(and(eq(brands.id, input.brandId), isNull(brands.deletedAt)))
      .limit(1);
    if (!mevcut[0]) throw new MarkaKuralHatasi("BRAND_NOT_FOUND", "Marka bulunamadı");
    if (yeni !== mevcut[0].code) {
      throw new MarkaKuralHatasi(
        "BRAND_CODE_IMMUTABLE",
        "Marka kodu oluşturulduktan sonra değiştirilemez",
      );
    }
  }

  const izinli = markaGuncellemeAlanlariniSuz(input.govde, input.role);
  const degerler: Record<string, unknown> = {};
  for (const [alan, deger] of Object.entries(izinli)) degerler[alan] = metin(deger);

  if ("name" in degerler && degerler.name === null) {
    throw new MarkaKuralHatasi("VALIDATION", "Marka adı boş olamaz");
  }
  if (Object.keys(degerler).length === 0) {
    throw new MarkaKuralHatasi("VALIDATION", "Güncellenecek alan yok");
  }

  const sonuc = await db
    .update(brands)
    .set({ ...degerler, updatedById: input.aktorId })
    .where(and(eq(brands.id, input.brandId), isNull(brands.deletedAt)))
    .returning({ id: brands.id });

  if (!sonuc[0]) throw new MarkaKuralHatasi("BRAND_NOT_FOUND", "Marka bulunamadı");
  return { id: sonuc[0].id, degisenAlanlar: Object.keys(degerler) };
}

/** Yaşam döngüsü değişimi (SA/FIN). */
export async function markaDurumDegistir(input: {
  brandId: string;
  status: string;
  aktorId: string;
}) {
  const gecerli = ["lead", "proposal_sent", "active", "suspended", "churned"];
  if (!gecerli.includes(input.status)) {
    throw new MarkaKuralHatasi("VALIDATION", "Geçersiz marka durumu");
  }
  const sonuc = await db
    .update(brands)
    .set({ status: input.status as never, updatedById: input.aktorId })
    .where(and(eq(brands.id, input.brandId), isNull(brands.deletedAt)))
    .returning({ id: brands.id, status: brands.status });
  if (!sonuc[0]) throw new MarkaKuralHatasi("BRAND_NOT_FOUND", "Marka bulunamadı");
  return sonuc[0];
}

// ══════════════════════════════════════════════════════════════════════════
// Marka yetkilileri (brand_contacts)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Yetkilinin bağlı olduğu marka — kapsam kontrolü için.
 *
 * `/contacts/:id` uçları markayı yoldan almaz; kapsam kontrolü ancak kaydın
 * kendi markası bilinerek yapılabilir. Bulunamazsa null döner ve çağıran 404
 * verir — silinmiş bir yetkilinin markası da sızdırılmaz.
 */
export async function yetkiliMarkasi(contactId: string): Promise<string | null> {
  const rows = await db
    .select({ brandId: brandContacts.brandId })
    .from(brandContacts)
    .where(and(eq(brandContacts.id, contactId), isNull(brandContacts.deletedAt)))
    .limit(1);
  return rows[0]?.brandId ?? null;
}

export async function yetkilileriListele(brandId: string) {
  return db
    .select({
      id: brandContacts.id,
      fullName: brandContacts.fullName,
      title: brandContacts.title,
      email: brandContacts.email,
      phone: brandContacts.phone,
      isPrimary: brandContacts.isPrimary,
    })
    .from(brandContacts)
    .where(and(eq(brandContacts.brandId, brandId), isNull(brandContacts.deletedAt)))
    .orderBy(sql`${brandContacts.isPrimary} DESC`, asc(brandContacts.fullName));
}

/**
 * Yetkili ekler.
 *
 * ⚠ Yetkili bir SİSTEM KULLANICISI DEĞİLDİR: giriş yapmaz, davet almaz,
 * `users` tablosuna satır açılmaz. Yalnız marka tarafındaki iletişim kaydıdır.
 *
 * Marka başına tek birincil yetkili: yenisi işaretlenirse eskisi aynı
 * transaction'da düşer (DB'de de partial unique index var).
 */
export async function yetkiliEkle(input: {
  brandId: string;
  fullName: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  aktorId: string;
}) {
  const fullName = metin(input.fullName);
  if (!fullName || fullName.length < 2) {
    throw new MarkaKuralHatasi("VALIDATION", "Yetkili adı en az 2 karakter olmalıdır");
  }

  return db.transaction(async (tx) => {
    if (input.isPrimary) await birincilligiDusur(tx, input.brandId);
    const id = newId();
    await tx.insert(brandContacts).values({
      id,
      brandId: input.brandId,
      fullName,
      title: metin(input.title),
      email: metin(input.email),
      phone: metin(input.phone),
      isPrimary: Boolean(input.isPrimary),
      createdById: input.aktorId,
    });
    return { id };
  });
}

export async function yetkiliGuncelle(input: {
  contactId: string;
  govde: Record<string, unknown>;
  aktorId: string;
}) {
  const kayit = await db
    .select({ id: brandContacts.id, brandId: brandContacts.brandId })
    .from(brandContacts)
    .where(and(eq(brandContacts.id, input.contactId), isNull(brandContacts.deletedAt)))
    .limit(1);
  if (!kayit[0]) throw new MarkaKuralHatasi("CONTACT_NOT_FOUND", "Yetkili bulunamadı");

  const degerler: Record<string, unknown> = {};
  for (const alan of ["fullName", "title", "email", "phone"]) {
    if (alan in input.govde) degerler[alan] = metin(input.govde[alan]);
  }
  if (degerler.fullName === null) {
    throw new MarkaKuralHatasi("VALIDATION", "Yetkili adı boş olamaz");
  }
  const birincilOlsun = input.govde.isPrimary === true;

  return db.transaction(async (tx) => {
    if (birincilOlsun) {
      await birincilligiDusur(tx, kayit[0]!.brandId);
      degerler.isPrimary = true;
    } else if (input.govde.isPrimary === false) {
      degerler.isPrimary = false;
    }
    if (Object.keys(degerler).length === 0) {
      throw new MarkaKuralHatasi("VALIDATION", "Güncellenecek alan yok");
    }
    await tx
      .update(brandContacts)
      .set({ ...degerler, updatedById: input.aktorId })
      .where(eq(brandContacts.id, input.contactId));
    return { id: input.contactId, brandId: kayit[0]!.brandId };
  });
}

export async function yetkiliSil(input: { contactId: string; aktorId: string }) {
  const sonuc = await db
    .update(brandContacts)
    .set({ deletedAt: sql`now()`, deletedById: input.aktorId, isPrimary: false })
    .where(and(eq(brandContacts.id, input.contactId), isNull(brandContacts.deletedAt)))
    .returning({ id: brandContacts.id, brandId: brandContacts.brandId });
  if (!sonuc[0]) throw new MarkaKuralHatasi("CONTACT_NOT_FOUND", "Yetkili bulunamadı");
  return sonuc[0];
}

type Islem = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Markanın mevcut birincil yetkilisini düşürür (tek birincil kuralı). */
async function birincilligiDusur(islem: Islem, brandId: string): Promise<void> {
  await islem
    .update(brandContacts)
    .set({ isPrimary: false })
    .where(
      and(
        eq(brandContacts.brandId, brandId),
        eq(brandContacts.isPrimary, true),
        isNull(brandContacts.deletedAt),
      ),
    );
}

// ══════════════════════════════════════════════════════════════════════════
// Hizmet kataloğu
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hizmet kataloğu.
 *
 * ⚠ OPS için FİYAT ve MALİYET alanları yanıta hiç girmez (docs/02 §3.2).
 * "Kaç markada kullanılıyor" sayısı pasifleştirmeden önceki etkiyi gösterir.
 */
export async function hizmetleriListele(role: UserRole) {
  if (!markaModulunuGorebilirMi(role)) return [];

  const kullananMarka = sql<number>`(
    SELECT count(*)::int FROM ${brandServices}
     WHERE ${brandServices.serviceId} = ${services.id}
       AND ${brandServices.deletedAt} IS NULL
  )`;

  const satirlar = await db
    .select({
      id: services.id,
      code: services.code,
      name: services.name,
      category: services.category,
      description: services.description,
      defaultUnit: services.defaultUnit,
      isActive: services.isActive,
      listPriceMinor: services.listPriceMinor,
      minPriceMinor: services.minPriceMinor,
      estCostMinor: services.estCostMinor,
      currencyCode: services.currencyCode,
      kullananMarka,
    })
    .from(services)
    .where(isNull(services.deletedAt))
    .orderBy(asc(services.name));

  if (role !== "operations") return satirlar;
  return satirlar.map((s) => fiyatsiz(s));
}

/**
 * Fiyat/maliyet alanlarını yanıttan ÇIKARIR (docs/02 §3.2, OPS 💰).
 *
 * Alanlar `undefined` yapılmaz, nesneden hiç kurulmaz: `JSON.stringify`
 * undefined'ı atlar ama ara katmanlardan biri onu `null`'a çevirse alan
 * yeniden görünürdü.
 */
function fiyatsiz<T extends Record<string, unknown>>(kayit: T): Partial<T> {
  const gizli = new Set(["listPriceMinor", "minPriceMinor", "estCostMinor", "currencyCode"]);
  const out: Record<string, unknown> = {};
  for (const [alan, deger] of Object.entries(kayit)) {
    if (!gizli.has(alan)) out[alan] = deger;
  }
  return out as Partial<T>;
}

export async function hizmetOlustur(input: {
  code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  defaultUnit?: string | null;
  aktorId: string;
}) {
  const code = kodNormalize(input.code);
  const name = metin(input.name);
  if (!gecerliKodMu(code)) {
    throw new MarkaKuralHatasi(
      "VALIDATION",
      "Hizmet kodu 2-16 karakter olmalı; yalnız harf, rakam ve tire içerebilir",
    );
  }
  if (!name || name.length < 2) {
    throw new MarkaKuralHatasi("VALIDATION", "Hizmet adı en az 2 karakter olmalıdır");
  }

  const id = newId();
  try {
    await db.insert(services).values({
      id,
      code,
      name,
      category: metin(input.category) ?? "genel",
      description: metin(input.description),
      defaultUnit: metin(input.defaultUnit) ?? "adet",
      createdById: input.aktorId,
    });
  } catch (e) {
    if (benzersizlikIhlali(e, "uq_services_code")) {
      throw new MarkaKuralHatasi("SERVICE_CODE_TAKEN", `"${code}" kodu zaten kullanılıyor`);
    }
    throw e;
  }
  return { id, code };
}

/**
 * Hizmeti günceller. Hizmet kodu marka kodundan farklı olarak
 * DEĞİŞTİRİLEBİLİR: katalog kodu bir belge numarasının parçası değildir.
 */
export async function hizmetGuncelle(input: {
  serviceId: string;
  govde: Record<string, unknown>;
  aktorId: string;
}) {
  const degerler: Record<string, unknown> = {};
  for (const alan of ["name", "category", "description", "defaultUnit"]) {
    if (alan in input.govde) degerler[alan] = metin(input.govde[alan]);
  }
  if ("code" in input.govde) {
    const code = kodNormalize(input.govde.code);
    if (!gecerliKodMu(code)) {
      throw new MarkaKuralHatasi("VALIDATION", "Hizmet kodu geçersiz");
    }
    degerler.code = code;
  }
  if (typeof input.govde.isActive === "boolean") {
    degerler.isActive = input.govde.isActive;
  }
  if (Object.keys(degerler).length === 0) {
    throw new MarkaKuralHatasi("VALIDATION", "Güncellenecek alan yok");
  }
  if (degerler.name === null) {
    throw new MarkaKuralHatasi("VALIDATION", "Hizmet adı boş olamaz");
  }

  try {
    const sonuc = await db
      .update(services)
      .set({ ...degerler, updatedById: input.aktorId })
      .where(and(eq(services.id, input.serviceId), isNull(services.deletedAt)))
      .returning({ id: services.id });
    if (!sonuc[0]) throw new MarkaKuralHatasi("SERVICE_NOT_FOUND", "Hizmet bulunamadı");
    return { id: sonuc[0].id, degisenAlanlar: Object.keys(degerler) };
  } catch (e) {
    if (benzersizlikIhlali(e, "uq_services_code")) {
      throw new MarkaKuralHatasi("SERVICE_CODE_TAKEN", "Bu kod zaten kullanılıyor");
    }
    throw e;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Markanın aldığı hizmetler
// ══════════════════════════════════════════════════════════════════════════

export async function markaHizmetleri(brandId: string, role: UserRole) {
  const satirlar = await db
    .select({
      id: brandServices.id,
      serviceId: services.id,
      code: services.code,
      name: services.name,
      defaultUnit: services.defaultUnit,
      isActive: services.isActive,
      listPriceMinor: services.listPriceMinor,
      currencyCode: services.currencyCode,
    })
    .from(brandServices)
    .innerJoin(services, eq(services.id, brandServices.serviceId))
    .where(and(eq(brandServices.brandId, brandId), isNull(brandServices.deletedAt)))
    .orderBy(asc(services.name));

  if (role !== "operations") return satirlar;
  return satirlar.map((s) => fiyatsiz(s));
}

/**
 * Markaya hizmet ekler.
 *
 * PASİF hizmet yeni markaya atanamaz; mevcut atamalar korunur. Pasifleştirme
 * "artık satmıyoruz" demektir, "geçmişi sil" değil.
 *
 * Daha önce çıkarılmış (soft delete) bir hizmet yeniden eklenebilir: canlı
 * kayıt yoksa yeni satır açılır — partial unique index yalnız canlıları
 * kapsadığı için çakışma olmaz.
 */
export async function markayaHizmetEkle(input: {
  brandId: string;
  serviceId: string;
  aktorId: string;
}) {
  const hizmet = await db
    .select({ id: services.id, isActive: services.isActive })
    .from(services)
    .where(and(eq(services.id, input.serviceId), isNull(services.deletedAt)))
    .limit(1);
  if (!hizmet[0]) throw new MarkaKuralHatasi("SERVICE_NOT_FOUND", "Hizmet bulunamadı");
  if (!hizmet[0].isActive) {
    throw new MarkaKuralHatasi(
      "SERVICE_INACTIVE",
      "Pasif hizmet yeni markalara atanamaz",
    );
  }

  const mevcut = await db
    .select({ id: brandServices.id })
    .from(brandServices)
    .where(
      and(
        eq(brandServices.brandId, input.brandId),
        eq(brandServices.serviceId, input.serviceId),
        isNull(brandServices.deletedAt),
      ),
    )
    .limit(1);
  if (mevcut[0]) return { id: mevcut[0].id, yeni: false };

  const id = newId();
  await db.insert(brandServices).values({
    id,
    brandId: input.brandId,
    serviceId: input.serviceId,
    createdById: input.aktorId,
  });
  return { id, yeni: true };
}

/** Hizmeti markadan çıkarır — soft delete, kayıt tarihçede kalır. */
export async function markadanHizmetCikar(input: {
  brandId: string;
  serviceId: string;
  aktorId: string;
}) {
  const sonuc = await db
    .update(brandServices)
    .set({ deletedAt: sql`now()`, deletedById: input.aktorId })
    .where(
      and(
        eq(brandServices.brandId, input.brandId),
        eq(brandServices.serviceId, input.serviceId),
        isNull(brandServices.deletedAt),
      ),
    )
    .returning({ id: brandServices.id });
  if (!sonuc[0]) throw new MarkaKuralHatasi("SERVICE_NOT_FOUND", "Bu hizmet markada yok");
  return sonuc[0];
}

// ══════════════════════════════════════════════════════════════════════════
// Ekip ataması
// ══════════════════════════════════════════════════════════════════════════

/**
 * Markanın sorumlu ekibi — YALNIZ açıkça atanmış OPS kullanıcıları.
 *
 * SA ve FIN rolleri gereği tüm markaları görür; burada listelenmeleri
 * "bu marka onlara atanmış" izlenimi verir ve yetki tablosunu yanıltırdı.
 * Rol süzgeci sorgunun içindedir — atama yanlışlıkla açılmış olsa bile
 * yanıta girmez.
 */
export async function atamalariListele(brandId: string) {
  return db
    .select({
      id: brandAssignments.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      assignedAt: brandAssignments.assignedAt,
    })
    .from(brandAssignments)
    .innerJoin(users, eq(users.id, brandAssignments.userId))
    .where(
      and(
        eq(brandAssignments.brandId, brandId),
        isNull(brandAssignments.deletedAt),
        isNull(users.deletedAt),
        eq(users.role, "operations"),
      ),
    )
    .orderBy(asc(users.fullName));
}

/**
 * Atanabilir kullanıcı araması — SONUÇTA YALNIZ OPS ÇIKAR.
 *
 * SA ve FIN sonuçlara hiç girmez: rol gereği zaten tüm markaları görürler.
 * MEM bu sprintte markaya atanmaz. Pasif ve davet bekleyen kullanıcılar da
 * elenir — atanan kişi bugün çalışabilmeli.
 */
export async function atanabilirKullanicilar(brandId: string, q?: string) {
  const terim = (q ?? "").trim().replace(/[\\%_]/g, (k) => `\\${k}`);
  const arama =
    terim.length > 0
      ? or(ilike(users.fullName, `%${terim}%`), ilike(users.email, `%${terim}%`))
      : undefined;

  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.role, "operations"),
        eq(users.isActive, true),
        arama,
        // Zaten atanmış olanlar sonuçlarda çıkmaz
        notExists(
          db
            .select({ x: sql`1` })
            .from(brandAssignments)
            .where(
              and(
                eq(brandAssignments.brandId, brandId),
                eq(brandAssignments.userId, users.id),
                isNull(brandAssignments.deletedAt),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(users.fullName))
    .limit(20);
}

/**
 * Kullanıcıyı markaya atar.
 *
 * ⚠ Atama bir YETKİ SINIRIDIR: OPS kullanıcısı yalnız atandığı markaları
 * görür. Bu yüzden rol kontrolü burada, veriye en yakın yerde yapılır — rota
 * katmanına bırakılsaydı bir script ya da başka bir uç kuralı atlayabilirdi.
 */
export async function atamaEkle(input: {
  brandId: string;
  userId: string;
  aktorId: string;
}) {
  const hedef = await db
    .select({ id: users.id, role: users.role, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
    .limit(1);

  if (!hedef[0] || !hedef[0].isActive || !atanabilirMi(hedef[0].role)) {
    throw new MarkaKuralHatasi(
      "USER_NOT_ASSIGNABLE",
      "Markaya yalnız aktif operasyon kullanıcıları atanabilir",
    );
  }

  const mevcut = await db
    .select({ id: brandAssignments.id })
    .from(brandAssignments)
    .where(
      and(
        eq(brandAssignments.brandId, input.brandId),
        eq(brandAssignments.userId, input.userId),
        isNull(brandAssignments.deletedAt),
      ),
    )
    .limit(1);
  if (mevcut[0]) return { id: mevcut[0].id, yeni: false };

  const id = newId();
  await db.insert(brandAssignments).values({
    id,
    brandId: input.brandId,
    userId: input.userId,
    createdById: input.aktorId,
  });
  return { id, yeni: true };
}

/**
 * Atamayı kaldırır — soft delete.
 *
 * Kayıt silinmez: "bu kullanıcı o tarihte bu markayı görebiliyor muydu"
 * sorusu denetimde cevaplanabilir olmalı. Erişim bir sonraki istekte kesilir,
 * çünkü kapsam her sorguda yeniden hesaplanır.
 */
export async function atamaKaldir(input: {
  brandId: string;
  userId: string;
  aktorId: string;
}) {
  const sonuc = await db
    .update(brandAssignments)
    .set({ deletedAt: sql`now()`, deletedById: input.aktorId })
    .where(
      and(
        eq(brandAssignments.brandId, input.brandId),
        eq(brandAssignments.userId, input.userId),
        isNull(brandAssignments.deletedAt),
      ),
    )
    .returning({ id: brandAssignments.id });
  if (!sonuc[0]) {
    throw new MarkaKuralHatasi("USER_NOT_ASSIGNABLE", "Bu kullanıcı markaya atanmış değil");
  }
  return sonuc[0];
}

// ══════════════════════════════════════════════════════════════════════════
// CSV
// ══════════════════════════════════════════════════════════════════════════

/**
 * CSV sütunları — ROLE GÖRE.
 *
 * ⚠ OPS'un CSV'sinde vergi sütunları YOKTUR. Ekranda gizlenip dışa aktarmada
 * çıkan bir alan, süzgecin en kolay atlandığı yerdir: dosya diske iner ve
 * paylaşılır.
 */
export function markaCsvSutunlari(role: UserRole) {
  const ortak = [
    { baslik: "KOD", alan: "code" },
    { baslik: "MARKA", alan: "name" },
    { baslik: "UNVAN", alan: "legalName" },
    { baslik: "SEKTOR", alan: "industry" },
    { baslik: "DURUM", alan: "status" },
    { baslik: "BIRINCIL YETKILI", alan: "birincilYetkili" },
    { baslik: "E-POSTA", alan: "email" },
    { baslik: "TELEFON", alan: "phone" },
    { baslik: "HIZMET SAYISI", alan: "hizmetSayisi" },
    { baslik: "EKIP SAYISI", alan: "ekipSayisi" },
  ];
  if (role === "operations") return ortak;
  return [
    ...ortak,
    { baslik: "VERGI NO", alan: "taxNumber" },
    { baslik: "VERGI DAIRESI", alan: "taxOffice" },
  ];
}

/**
 * CSV satırları — listeyle AYNI kapsam ve AYNI alan süzgecinden geçer.
 *
 * Dışa aktarma listenin O ANKİ filtresini yansıtır; kullanıcı ekranda ne
 * görüyorsa dosyada onu bulur.
 */
export async function markaCsvSatirlari(user: CurrentUser, filtre: MarkaFiltresi = {}) {
  const kayitlar = await markalariListele(user, filtre);
  return kayitlar as Record<string, unknown>[];
}

// ══════════════════════════════════════════════════════════════════════════

/**
 * Postgres unique index ihlali mi (23505) ve hangi index?
 *
 * ⚠ Drizzle sürücü hatasını KENDİ hatasına sarar (`DrizzleQueryError`);
 * `code` alanı en üstte bulunmaz. Zincir `cause` üzerinden gezilir — yalnız
 * üst nesneye bakan bir kontrol her ihlali 500'e çevirirdi.
 */
function benzersizlikIhlali(e: unknown, indexAdi: string): boolean {
  let dugum: unknown = e;
  for (let derinlik = 0; dugum && derinlik < 5; derinlik += 1) {
    const hata = dugum as { code?: string; constraint?: string; detail?: string; cause?: unknown };
    if (
      hata.code === "23505" &&
      (hata.constraint === indexAdi ||
        (typeof hata.detail === "string" && hata.detail.includes(indexAdi)))
    ) {
      return true;
    }
    dugum = hata.cause;
  }
  return false;
}
