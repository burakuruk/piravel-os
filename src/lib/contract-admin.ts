import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import {
  brands,
  brandServices,
  contractItems,
  contracts,
  services,
} from "@/db/schema";
import type { UserRole } from "@/lib/auth-policy";
import type { CurrentUser } from "@/lib/authz";
import { newId } from "@/lib/ids";
import { markaKapsamKosulu } from "@/lib/brand-admin";
import { extractNetFromGross, taxMinor } from "@/lib/money";
import {
  odemePlaniOnizle,
  OdemePlaniHatasi,
  type FaturalamaSikligi,
  type OdemePlani,
  type TutarTemeli,
} from "@/lib/odeme-plani";

/**
 * Sözleşme modülünün iş kuralları — TEK YER (Sprint 3).
 *
 * Marka modülüyle aynı ilke: API uçları, sunucu bileşenleri ve script'ler bunu
 * çağırır; kuralı kendileri tekrar etmez.
 *
 * ⚠ OPS için alan süzgeci DEĞİL, AYRI SORGU kullanılır (§5a): finansal
 * kolonlar OPS'un SQL'ine hiç girmez. Veri sorgudan çıkmazsa loga, önbelleğe,
 * hata gövdesine ve sonraki bir `JSON.stringify`'a da sızamaz.
 */

// ══════════════════════════════════════════════════════════════════════════
// Hatalar
// ══════════════════════════════════════════════════════════════════════════

export class SozlesmeKuralHatasi extends Error {
  constructor(
    readonly code:
      | "CONTRACT_NOT_FOUND"
      | "CONTRACT_NO_TAKEN"
      | "CONTRACT_LOCKED"
      | "INVALID_TRANSITION"
      | "BRAND_NOT_ACTIVATABLE"
      | "SERVICE_INACTIVE"
      | "PREVIEW_TOO_LONG"
      | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "SozlesmeKuralHatasi";
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Rol kapıları
// ══════════════════════════════════════════════════════════════════════════

/** MEM sözleşme modülüne HİÇ erişemez ve 404 görür (marka modülüyle aynı ilke). */
export function sozlesmeModulunuGorebilirMi(role: UserRole): boolean {
  return role !== "member";
}

/** Oluşturma/düzenleme/aktivasyon/sonlandırma/iptal: SA ve FIN. */
export function sozlesmeYonetebilirMi(role: UserRole): boolean {
  return role === "super_admin" || role === "finance";
}

/** Silme (yalnız taslak) yalnız SA. */
export function sozlesmeSilebilirMi(role: UserRole): boolean {
  return role === "super_admin";
}

/** OPS finansal alanları HİÇ görmez — sorgusu da onları seçmez. */
export function finansGorebilirMi(role: UserRole): boolean {
  return role === "super_admin" || role === "finance";
}

// ══════════════════════════════════════════════════════════════════════════
// Alan kilidi — duruma göre
// ══════════════════════════════════════════════════════════════════════════

/**
 * `active` sözleşmede DÜZENLENEBİLEN alanlar.
 *
 * Tutar, tutar TEMELİ, para birimi, tarih, sıklık ve kalemler kilitlidir:
 * yürürlükteki bir belgenin parası ve takvimi sessizce değişmemeli.
 * `ended`/`cancelled` tamamen salt okunur.
 */
export const AKTIF_DUZENLENEBILIR = [
  "notes",
  "renewalDate",
  "renewalReviewDate",
  "autoRenew",
  "nextPriceReviewDate",
  "paymentTermsDays",
] as const;

/** `draft`'ta düzenlenebilen tüm alanlar. */
export const TASLAK_DUZENLENEBILIR = [
  ...AKTIF_DUZENLENEBILIR,
  "title",
  "brandId",
  "startDate",
  "endDate",
  "enteredAmountMinor",
  "amountBasis",
  "vatRate",
  "vatIncluded",
  "discountMinor",
  "currencyCode",
  "fxRate",
  "billingFrequency",
  "billingInterval",
  "firstDueDate",
  "installmentCount",
  "paymentDay",
  "paymentMethod",
  "pricingModel",
  "terminationTerms",
] as const;

export function duzenlenebilirAlanlar(status: string): readonly string[] {
  if (status === "draft") return TASLAK_DUZENLENEBILIR;
  if (status === "active") return AKTIF_DUZENLENEBILIR;
  return [];
}

// ══════════════════════════════════════════════════════════════════════════
// Durum geçişleri
// ══════════════════════════════════════════════════════════════════════════

export const GECERLI_GECISLER: Record<string, readonly string[]> = {
  draft: ["active", "cancelled"],
  active: ["ended", "cancelled"],
  ended: [],
  cancelled: [],
};

export function gecisGecerliMi(mevcut: string, hedef: string): boolean {
  return (GECERLI_GECISLER[mevcut] ?? []).includes(hedef);
}

/**
 * Aktivasyonda markanın durumu.
 *
 * `lead`/`proposal_sent` → sözleşmenin imzalanması, adayın müşteri olduğu
 * andır; marka AYNI transaction'da `active` yapılır ve AYRI bir denetim kaydı
 * üretilir. `suspended`/`churned` → askıdaki/ayrılmış markaya yeni yükümlülük
 * yazılmaz.
 */
const MARKAYI_AKTIFLESTIR = new Set(["lead", "proposal_sent"]);
const AKTIVASYONA_KAPALI = new Set(["suspended", "churned"]);

// ══════════════════════════════════════════════════════════════════════════
// Alan seçimi — OPS için AYRI sorgu şekli (§5a)
// ══════════════════════════════════════════════════════════════════════════

/** Her rolde görünen, finansal olmayan alanlar. */
const ORTAK_ALANLAR = {
  id: contracts.id,
  contractNo: contracts.contractNo,
  brandId: contracts.brandId,
  title: contracts.title,
  status: contracts.status,
  startDate: contracts.startDate,
  endDate: contracts.endDate,
  renewalDate: contracts.renewalDate,
  renewalReviewDate: contracts.renewalReviewDate,
  autoRenew: contracts.autoRenew,
  nextPriceReviewDate: contracts.nextPriceReviewDate,
  notes: contracts.notes,
  activatedAt: contracts.activatedAt,
  endedAt: contracts.endedAt,
  endReason: contracts.endReason,
  cancelledAt: contracts.cancelledAt,
  cancelReason: contracts.cancelReason,
  createdAt: contracts.createdAt,
} as const;

/**
 * SA/FIN alanları — finansal kolonlar dâhil.
 *
 * ⚠ OPS sorgusunda bu kolonların HİÇBİRİ SELECT edilmez. Sprint 2'de alanlar
 * geniş sorgudan çekilip yanıtta süzülüyordu; sözleşmede o desen kullanılmaz.
 */
const TAM_ALANLAR = {
  ...ORTAK_ALANLAR,
  amountMinor: contracts.amountMinor,
  amountBasis: contracts.amountBasis,
  amountBaseMinor: contracts.amountBaseMinor,
  currencyCode: contracts.currencyCode,
  fxRate: contracts.fxRate,
  vatRate: contracts.vatRate,
  vatIncluded: contracts.vatIncluded,
  discountMinor: contracts.discountMinor,
  billingFrequency: contracts.billingFrequency,
  billingInterval: contracts.billingInterval,
  firstDueDate: contracts.firstDueDate,
  installmentCount: contracts.installmentCount,
  paymentDay: contracts.paymentDay,
  paymentTermsDays: contracts.paymentTermsDays,
  paymentMethod: contracts.paymentMethod,
  pricingModel: contracts.pricingModel,
} as const;

/** Marka adı — listede ve detayda gösterilir. */
const markaAdiSql = sql<string>`(
  SELECT b.name FROM brands b WHERE b.id = contracts.brand_id
)`;

function alanSecimi(role: UserRole) {
  const temel = finansGorebilirMi(role) ? TAM_ALANLAR : ORTAK_ALANLAR;
  return { ...temel, brandName: markaAdiSql };
}

// ══════════════════════════════════════════════════════════════════════════
// Kapsam ve listeleme
// ══════════════════════════════════════════════════════════════════════════

export interface SozlesmeFiltresi {
  q?: string;
  status?: string;
  brandId?: string;
  /** Yenileme görüşmesi/yenilemesi N gün içinde olanlar. */
  expiringWithin?: number;
}

function aramaKosulu(q: string | undefined) {
  const terim = (q ?? "").trim();
  if (terim.length === 0) return undefined;
  const kacisli = terim.replace(/[\\%_]/g, (k) => `\\${k}`);
  return or(
    ilike(contracts.contractNo, `%${kacisli}%`),
    ilike(contracts.title, `%${kacisli}%`),
  );
}

/**
 * "N gün içinde yenilenecek" koşulu.
 *
 * Rozet hangi tarihe dayanıyorsa filtre de ona dayanır: görüşme tarihi varsa
 * o, yoksa yenileme tarihi. `coalesce` iki kısmi indeksi de kullanılabilir
 * kılmaz ama sözleşme sayısı bu ölçekte sorun değil; doğruluk önce gelir.
 */
function yenilemeKosulu(gun: number | undefined) {
  if (!gun || !Number.isFinite(gun) || gun <= 0) return undefined;
  return sql`coalesce(${contracts.renewalReviewDate}, ${contracts.renewalDate})
             BETWEEN current_date AND (current_date + ${Math.floor(gun)} * interval '1 day')`;
}

function listeKosullari(user: CurrentUser, filtre: SozlesmeFiltresi) {
  return [
    isNull(contracts.deletedAt),
    markaKapsamKosulu(user, contracts.brandId),
    aramaKosulu(filtre.q),
    filtre.status ? eq(contracts.status, filtre.status as never) : undefined,
    filtre.brandId ? eq(contracts.brandId, filtre.brandId) : undefined,
    yenilemeKosulu(filtre.expiringWithin),
  ].filter(Boolean);
}

export const SAYFA_BOYUTU = 20;

export async function sozlesmeleriListele(
  user: CurrentUser,
  filtre: SozlesmeFiltresi = {},
) {
  if (!sozlesmeModulunuGorebilirMi(user.role)) return [];
  return db
    .select(alanSecimi(user.role))
    .from(contracts)
    .where(and(...listeKosullari(user, filtre)))
    .orderBy(desc(contracts.createdAt));
}

export async function sozlesmeleriSayfali(
  user: CurrentUser,
  filtre: SozlesmeFiltresi = {},
  sayfa = 1,
) {
  if (!sozlesmeModulunuGorebilirMi(user.role)) {
    return { kayitlar: [], toplam: 0, sayfa: 1, sayfaSayisi: 1 };
  }
  const gecerliSayfa = Number.isFinite(sayfa) && sayfa > 0 ? Math.floor(sayfa) : 1;

  const sayim = await db
    .select({ adet: sql<number>`count(*)::int` })
    .from(contracts)
    .where(and(...listeKosullari(user, filtre)));
  const toplam = sayim[0]?.adet ?? 0;
  const sayfaSayisi = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const guvenliSayfa = Math.min(gecerliSayfa, sayfaSayisi);

  const kayitlar = await db
    .select(alanSecimi(user.role))
    .from(contracts)
    .where(and(...listeKosullari(user, filtre)))
    .orderBy(desc(contracts.createdAt))
    .limit(SAYFA_BOYUTU)
    .offset((guvenliSayfa - 1) * SAYFA_BOYUTU);

  return { kayitlar, toplam, sayfa: guvenliSayfa, sayfaSayisi };
}

/** Tek sözleşme — listeyle AYNI kapsam ve AYNI sorgu şekli. */
export async function sozlesmeDetayi(user: CurrentUser, contractId: string) {
  if (!sozlesmeModulunuGorebilirMi(user.role)) return null;
  const satirlar = await db
    .select(alanSecimi(user.role))
    .from(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        isNull(contracts.deletedAt),
        markaKapsamKosulu(user, contracts.brandId),
      ),
    )
    .limit(1);
  return satirlar[0] ?? null;
}

/** Erişilemeyen sözleşme "yok" gibi davranır — 403 varlığını sızdırırdı. */
export async function sozlesmeyeErisebilirMi(
  user: CurrentUser,
  contractId: string,
): Promise<boolean> {
  if (!sozlesmeModulunuGorebilirMi(user.role)) return false;
  const rows = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        isNull(contracts.deletedAt),
        markaKapsamKosulu(user, contracts.brandId),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

// ══════════════════════════════════════════════════════════════════════════
// Kalemler
// ══════════════════════════════════════════════════════════════════════════

/** OPS kalemlerde de fiyat görmez — sorgu onları seçmez. */
const KALEM_ORTAK = {
  id: contractItems.id,
  serviceId: contractItems.serviceId,
  name: contractItems.name,
  description: contractItems.description,
  quantity: contractItems.quantity,
  unit: contractItems.unit,
  period: contractItems.period,
  sortOrder: contractItems.sortOrder,
} as const;

const KALEM_TAM = {
  ...KALEM_ORTAK,
  unitPriceMinor: contractItems.unitPriceMinor,
  totalMinor: contractItems.totalMinor,
  estCostMinor: contractItems.estCostMinor,
  currencyCode: contractItems.currencyCode,
} as const;

export async function kalemleriListele(contractId: string, role: UserRole) {
  return db
    .select(finansGorebilirMi(role) ? KALEM_TAM : KALEM_ORTAK)
    .from(contractItems)
    .where(and(eq(contractItems.contractId, contractId), isNull(contractItems.deletedAt)))
    .orderBy(asc(contractItems.sortOrder), asc(contractItems.name));
}

export interface KalemGirdisi {
  serviceId?: string | null;
  name?: string;
  description?: string | null;
  quantity?: number | string;
  unit?: string;
  period?: string;
  unitPriceMinor?: number;
  estCostMinor?: number;
}

/**
 * Kalemleri TOPLU yazar (PUT semantiği): gönderilen liste yenisidir.
 *
 * ⚠ Kalem katalogdan seçilir ama adı ve fiyatı O AN KOPYALANIR (snapshot).
 * Sonraki okumalarda `services`'e JOIN ile ad çekilmez; `service_id` yalnız
 * izlenebilirlik içindir. Katalogda sonradan yapılan değişiklik imzalanmış
 * sözleşmeyi geriye dönük değiştirmemeli.
 */
export async function kalemleriYaz(input: {
  contractId: string;
  kalemler: KalemGirdisi[];
  aktorId: string;
}): Promise<{ warnings: string[]; adet: number }> {
  const sozlesme = await db
    .select({
      id: contracts.id,
      status: contracts.status,
      brandId: contracts.brandId,
      currencyCode: contracts.currencyCode,
    })
    .from(contracts)
    .where(and(eq(contracts.id, input.contractId), isNull(contracts.deletedAt)))
    .limit(1);
  const s = sozlesme[0];
  if (!s) throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");
  if (s.status !== "draft") {
    throw new SozlesmeKuralHatasi(
      "CONTRACT_LOCKED",
      "Kalemler yalnız taslak sözleşmede düzenlenebilir",
    );
  }

  const warnings: string[] = [];

  // Katalog bilgileri tek sorguda — kalem başına sorgu N+1 üretirdi
  const serviceIds = input.kalemler
    .map((k) => k.serviceId)
    .filter((x): x is string => typeof x === "string" && x.length > 0);

  const katalog = new Map<
    string,
    { id: string; code: string; name: string; description: string | null; defaultUnit: string; isActive: boolean; listPriceMinor: number | null; markada: boolean }
  >();

  if (serviceIds.length > 0) {
    const rows = await db
      .select({
        id: services.id,
        code: services.code,
        name: services.name,
        description: services.description,
        defaultUnit: services.defaultUnit,
        isActive: services.isActive,
        listPriceMinor: services.listPriceMinor,
        markada: sql<boolean>`EXISTS (
          SELECT 1 FROM brand_services bs
           WHERE bs.service_id = services.id
             AND bs.brand_id = ${s.brandId}
             AND bs.deleted_at IS NULL
        )`,
      })
      .from(services)
      /**
       * ⚠ `= ANY(${dizi})` KULLANILMAZ: Drizzle diziyi tek bir parametre olarak
       * bağlar ve Postgres uuid[] tipini çıkaramayıp sorguyu düşürür. `inArray`
       * her öğeyi ayrı parametreye açar.
       */
      .where(and(isNull(services.deletedAt), inArray(services.id, serviceIds)));
    for (const r of rows) katalog.set(r.id, r);
  }

  const yazilacak: (typeof contractItems.$inferInsert)[] = [];
  let sira = 0;

  for (const k of input.kalemler) {
    let ad = (k.name ?? "").trim();
    let birim = (k.unit ?? "").trim();
    let aciklama = k.description ?? null;

    if (k.serviceId) {
      const hizmet = katalog.get(k.serviceId);
      if (!hizmet) {
        throw new SozlesmeKuralHatasi("VALIDATION", "Seçilen hizmet bulunamadı");
      }
      /**
       * PASİF hizmet YENİ kaleme eklenemez. Mevcut kalemler korunur —
       * pasifleştirme "artık satmıyoruz" demektir, "geçmişi sil" değil.
       */
      if (!hizmet.isActive) {
        throw new SozlesmeKuralHatasi(
          "SERVICE_INACTIVE",
          `"${hizmet.name}" pasif bir hizmet; yeni kaleme eklenemez`,
        );
      }
      // Snapshot: katalog değerleri KOPYALANIR
      if (!ad) ad = hizmet.name;
      if (!birim) birim = hizmet.defaultUnit;
      if (aciklama === null) aciklama = hizmet.description;

      if (!hizmet.markada) {
        warnings.push(
          `"${hizmet.name}" bu markaya tanımlı değil; sözleşme yürürlüğe alındığında markanın hizmet listesine eklenecek`,
        );
      }
    }

    if (!ad || ad.length < 2) {
      throw new SozlesmeKuralHatasi("VALIDATION", "Kalem adı en az 2 karakter olmalıdır");
    }

    const miktar = Number(k.quantity ?? 1);
    if (!Number.isFinite(miktar) || miktar <= 0) {
      throw new SozlesmeKuralHatasi("VALIDATION", "Kalem miktarı sıfırdan büyük olmalıdır");
    }
    const birimFiyat = Math.trunc(Number(k.unitPriceMinor ?? 0));
    if (!Number.isSafeInteger(birimFiyat) || birimFiyat < 0) {
      throw new SozlesmeKuralHatasi("VALIDATION", "Birim fiyat negatif olamaz");
    }

    sira += 1;
    yazilacak.push({
      id: newId(),
      contractId: input.contractId,
      serviceId: k.serviceId ?? null,
      name: ad,
      description: aciklama,
      quantity: String(miktar),
      unit: birim || "adet",
      period: (k.period ?? "monthly").trim() || "monthly",
      unitPriceMinor: birimFiyat,
      // Kalem para birimi sözleşmeyle aynı olmak ZORUNDA (DB trigger'ı da zorlar)
      currencyCode: s.currencyCode,
      totalMinor: Math.round(miktar * birimFiyat),
      estCostMinor: Math.trunc(Number(k.estCostMinor ?? 0)),
      sortOrder: sira,
      createdById: input.aktorId,
    });
  }

  await db.transaction(async (tx) => {
    // Eski kalemler soft delete: geçmiş silinmez, yeni liste üstüne yazılır
    await tx
      .update(contractItems)
      .set({ deletedAt: sql`now()`, deletedById: input.aktorId })
      .where(
        and(eq(contractItems.contractId, input.contractId), isNull(contractItems.deletedAt)),
      );
    if (yazilacak.length > 0) await tx.insert(contractItems).values(yazilacak);
  });

  return { warnings, adet: yazilacak.length };
}

// ══════════════════════════════════════════════════════════════════════════
// Tutar semantiği (§7a, §7b)
// ══════════════════════════════════════════════════════════════════════════

/**
 * KDV giriş sözleşmesi: kullanıcı `enteredAmountMinor` yazar, sunucu NET saklar.
 *
 * ⚠ Saklanan değer `vatIncluded=true` diye İKİNCİ KEZ netleştirilmez.
 * Güncelleme de `enteredAmountMinor` üzerinden gelir; sunucu net'i yeniden
 * hesaplar, mevcut net'i tekrar bölmez. Aksi hâlde her kaydetmede tutar
 * küçülürdü.
 */
export function netHesapla(
  enteredAmountMinor: number,
  vatIncluded: boolean,
  vatRatePercent: number,
): number {
  if (!Number.isSafeInteger(enteredAmountMinor) || enteredAmountMinor <= 0) {
    throw new SozlesmeKuralHatasi("VALIDATION", "Tutar sıfırdan büyük olmalıdır");
  }
  return vatIncluded
    ? extractNetFromGross(enteredAmountMinor, vatRatePercent)
    : enteredAmountMinor;
}

/** Yanıt için brüt — HESAPLANIR, saklanmaz. */
export function brutHesapla(netMinor: number, vatRatePercent: number): number {
  return netMinor + taxMinor(netMinor, vatRatePercent);
}

export interface ToplamOzeti {
  kalemToplamiMinor: number;
  discountMinor: number;
  beklenenNetMinor: number;
  amountMinor: number;
  uyusmazlik: boolean;
  farkMinor: number;
}

/**
 * Kalem toplamı ↔ sözleşme tutarı karşılaştırması (§7a).
 *
 * `amountMinor` ZATEN indirimli net tutardır; `discountMinor` hesaba ikinci kez
 * girmez. Uyuşmazlık kaydetmeyi ENGELLEMEZ, uyarı üretir — gerçek hayatta
 * pazarlık sonucu toplam ile kalemler tutmayabilir.
 *
 * ⚠ Üç değer de `amountBasis` ile AYNI temeldedir; karşılaştırma temel
 * dönüşümü yapmaz.
 */
export function toplamOzeti(
  kalemToplamiMinor: number,
  discountMinor: number,
  amountMinor: number,
): ToplamOzeti {
  const beklenenNetMinor = kalemToplamiMinor - discountMinor;
  return {
    kalemToplamiMinor,
    discountMinor,
    beklenenNetMinor,
    amountMinor,
    uyusmazlik: kalemToplamiMinor > 0 && beklenenNetMinor !== amountMinor,
    farkMinor: beklenenNetMinor - amountMinor,
  };
}

export async function kalemToplami(contractId: string): Promise<number> {
  const rows = await db
    .select({ toplam: sql<number>`coalesce(sum(${contractItems.totalMinor}), 0)::bigint` })
    .from(contractItems)
    .where(and(eq(contractItems.contractId, contractId), isNull(contractItems.deletedAt)));
  return Number(rows[0]?.toplam ?? 0);
}

// ══════════════════════════════════════════════════════════════════════════
// Oluşturma
// ══════════════════════════════════════════════════════════════════════════

export interface YeniSozlesme {
  brandId: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  enteredAmountMinor: number;
  /** ZORUNLU — varsayılanı yoktur, eksikse VALIDATION. */
  amountBasis: TutarTemeli;
  currencyCode?: string;
  fxRate?: number;
  vatRate?: number;
  vatIncluded?: boolean;
  discountMinor?: number;
  billingFrequency?: FaturalamaSikligi;
  billingInterval?: number;
  firstDueDate?: string | null;
  installmentCount?: number | null;
  paymentDay?: number | null;
  paymentTermsDays?: number;
  paymentMethod?: string | null;
  renewalDate?: string | null;
  renewalReviewDate?: string | null;
  autoRenew?: boolean;
  notes?: string | null;
}

function metin(deger: unknown): string | null {
  if (typeof deger !== "string") return null;
  const t = deger.trim();
  return t.length > 0 ? t : null;
}

const TUTAR_TEMELLERI = new Set<TutarTemeli>(["per_period", "contract_total"]);
const SIKLIKLAR = new Set<FaturalamaSikligi>(["one_time", "monthly", "quarterly", "yearly"]);

/**
 * Taslak sözleşme oluşturur.
 *
 * Numara SUNUCUDA üretilir (`next_contract_no()`): yıl Europe/Istanbul'dan
 * gelir, sayaç satır kilidiyle ilerler ve numara yeniden kullanılmaz.
 */
export async function sozlesmeOlustur(input: YeniSozlesme & { aktorId: string }) {
  const title = metin(input.title);
  if (!title || title.length < 2) {
    throw new SozlesmeKuralHatasi("VALIDATION", "Sözleşme başlığı en az 2 karakter olmalıdır");
  }
  if (!metin(input.brandId)) {
    throw new SozlesmeKuralHatasi("VALIDATION", "Marka seçilmelidir");
  }
  // ⚠ Eksik `amountBasis` SESSİZCE "dönemlik" sayılmaz.
  if (!input.amountBasis || !TUTAR_TEMELLERI.has(input.amountBasis)) {
    throw new SozlesmeKuralHatasi(
      "VALIDATION",
      "Tutar temeli zorunludur: per_period veya contract_total",
    );
  }

  const vatRate = Number(input.vatRate ?? 20);
  const vatIncluded = Boolean(input.vatIncluded);
  const netMinor = netHesapla(Number(input.enteredAmountMinor), vatIncluded, vatRate);

  const currencyCode = (metin(input.currencyCode) ?? "TRY").toUpperCase();
  const fxRate = Number(input.fxRate ?? 1);
  if (!(fxRate > 0)) throw new SozlesmeKuralHatasi("VALIDATION", "Kur pozitif olmalıdır");
  if (currencyCode === "TRY" && fxRate !== 1) {
    throw new SozlesmeKuralHatasi("VALIDATION", "Türk lirası sözleşmelerde kur 1 olmalıdır");
  }

  const billingFrequency = (input.billingFrequency ?? "monthly") as FaturalamaSikligi;
  if (!SIKLIKLAR.has(billingFrequency)) {
    throw new SozlesmeKuralHatasi("VALIDATION", "Geçersiz faturalama sıklığı");
  }
  const billingInterval = Number(input.billingInterval ?? 1);
  const installmentCount =
    input.installmentCount == null ? null : Math.trunc(Number(input.installmentCount));

  // Tek seferlikte temel zorunlu olarak toplam; DB CHECK de aynısını söyler
  const amountBasis: TutarTemeli =
    billingFrequency === "one_time" ? "contract_total" : input.amountBasis;

  if (
    amountBasis === "contract_total" &&
    billingFrequency !== "one_time" &&
    installmentCount == null &&
    !input.endDate
  ) {
    throw new SozlesmeKuralHatasi(
      "VALIDATION",
      "Toplam tutar temelinde taksit sayısı veya bitiş tarihi zorunludur",
    );
  }

  const degerler = {
    id: newId(),
    brandId: input.brandId,
    contractNo: sql<string>`next_contract_no()`,
    title,
    status: "draft" as const,
    startDate: input.startDate,
    endDate: metin(input.endDate),
    renewalDate: metin(input.renewalDate),
    renewalReviewDate: metin(input.renewalReviewDate),
    autoRenew: Boolean(input.autoRenew),
    amountMinor: netMinor,
    amountBasis,
    currencyCode,
    fxRate: String(fxRate),
    amountBaseMinor: Math.round(netMinor * fxRate),
    vatRate: String(vatRate),
    vatIncluded,
    discountMinor: Math.trunc(Number(input.discountMinor ?? 0)),
    billingFrequency,
    billingInterval,
    firstDueDate: metin(input.firstDueDate),
    installmentCount,
    paymentDay: input.paymentDay == null ? null : Math.trunc(Number(input.paymentDay)),
    paymentTermsDays: Math.trunc(Number(input.paymentTermsDays ?? 0)),
    paymentMethod: metin(input.paymentMethod),
    notes: metin(input.notes),
    createdById: input.aktorId,
  };

  // Plan hesaplanabiliyor mu? 120 sınırı KAYDETMEDEN önce yakalanır.
  planiDogrula({
    amountMinor: netMinor,
    amountBasis,
    vatRatePercent: vatRate,
    billingFrequency,
    billingInterval,
    startDate: input.startDate,
    endDate: degerler.endDate,
    firstDueDate: degerler.firstDueDate,
    paymentDay: degerler.paymentDay,
    installmentCount,
  });

  const sonuc = await db
    .insert(contracts)
    .values(degerler as never)
    .returning({ id: contracts.id, contractNo: contracts.contractNo });

  return sonuc[0]!;
}

/** Plan üretilebiliyor mu — hata kodunu sözleşme hatasına çevirir. */
function planiDogrula(girdi: Parameters<typeof odemePlaniOnizle>[0]): void {
  try {
    odemePlaniOnizle(girdi);
  } catch (e) {
    if (e instanceof OdemePlaniHatasi) {
      throw new SozlesmeKuralHatasi(
        e.code === "PREVIEW_TOO_LONG" ? "PREVIEW_TOO_LONG" : "VALIDATION",
        e.message,
      );
    }
    throw e;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Güncelleme
// ══════════════════════════════════════════════════════════════════════════

/**
 * Sözleşmeyi günceller — duruma göre alan kilidiyle.
 *
 * Kilitli bir alan gövdede gelirse SESSİZCE YUTULMAZ: `CONTRACT_LOCKED`
 * fırlatılır. Yutmak kullanıcıya "değiştirdim" yanılgısı verirdi.
 */
export async function sozlesmeGuncelle(input: {
  contractId: string;
  govde: Record<string, unknown>;
  aktorId: string;
}) {
  const mevcut = await db
    .select({
      id: contracts.id,
      status: contracts.status,
      amountMinor: contracts.amountMinor,
      amountBasis: contracts.amountBasis,
      vatRate: contracts.vatRate,
      vatIncluded: contracts.vatIncluded,
      currencyCode: contracts.currencyCode,
      fxRate: contracts.fxRate,
      billingFrequency: contracts.billingFrequency,
      billingInterval: contracts.billingInterval,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      firstDueDate: contracts.firstDueDate,
      paymentDay: contracts.paymentDay,
      installmentCount: contracts.installmentCount,
    })
    .from(contracts)
    .where(and(eq(contracts.id, input.contractId), isNull(contracts.deletedAt)))
    .limit(1);
  const s = mevcut[0];
  if (!s) throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");

  const izinli = duzenlenebilirAlanlar(s.status);
  if (izinli.length === 0) {
    throw new SozlesmeKuralHatasi(
      "CONTRACT_LOCKED",
      "Sonlanmış veya iptal edilmiş sözleşme düzenlenemez",
    );
  }

  const gonderilen = Object.keys(input.govde).filter((a) => a !== "contractNo");
  const kilitli = gonderilen.filter((a) => !izinli.includes(a));
  if (kilitli.length > 0) {
    throw new SozlesmeKuralHatasi(
      "CONTRACT_LOCKED",
      `Bu durumda değiştirilemeyen alanlar: ${kilitli.join(", ")}`,
    );
  }
  if ("contractNo" in input.govde) {
    throw new SozlesmeKuralHatasi(
      "CONTRACT_LOCKED",
      "Sözleşme numarası değiştirilemez",
    );
  }

  const d: Record<string, unknown> = {};
  for (const alan of ["title", "notes", "paymentMethod", "terminationTerms"]) {
    if (alan in input.govde) d[alan] = metin(input.govde[alan]);
  }
  for (const alan of [
    "startDate", "endDate", "renewalDate", "renewalReviewDate",
    "firstDueDate", "nextPriceReviewDate",
  ]) {
    if (alan in input.govde) d[alan] = metin(input.govde[alan]);
  }
  if ("autoRenew" in input.govde) d.autoRenew = Boolean(input.govde.autoRenew);
  if ("paymentTermsDays" in input.govde) {
    d.paymentTermsDays = Math.trunc(Number(input.govde.paymentTermsDays ?? 0));
  }
  if ("brandId" in input.govde) d.brandId = metin(input.govde.brandId);
  if ("paymentDay" in input.govde) {
    d.paymentDay =
      input.govde.paymentDay == null ? null : Math.trunc(Number(input.govde.paymentDay));
  }
  if ("installmentCount" in input.govde) {
    d.installmentCount =
      input.govde.installmentCount == null
        ? null
        : Math.trunc(Number(input.govde.installmentCount));
  }
  if ("billingFrequency" in input.govde) {
    const f = String(input.govde.billingFrequency) as FaturalamaSikligi;
    if (!SIKLIKLAR.has(f)) throw new SozlesmeKuralHatasi("VALIDATION", "Geçersiz sıklık");
    d.billingFrequency = f;
  }
  if ("billingInterval" in input.govde) {
    d.billingInterval = Math.trunc(Number(input.govde.billingInterval ?? 1));
  }
  if ("discountMinor" in input.govde) {
    d.discountMinor = Math.trunc(Number(input.govde.discountMinor ?? 0));
  }
  if ("amountBasis" in input.govde) {
    const b = String(input.govde.amountBasis) as TutarTemeli;
    if (!TUTAR_TEMELLERI.has(b)) {
      throw new SozlesmeKuralHatasi("VALIDATION", "Geçersiz tutar temeli");
    }
    d.amountBasis = b;
  }

  const vatRate = Number(
    "vatRate" in input.govde ? input.govde.vatRate : s.vatRate,
  );
  const vatIncluded =
    "vatIncluded" in input.govde ? Boolean(input.govde.vatIncluded) : s.vatIncluded;
  if ("vatRate" in input.govde) d.vatRate = String(vatRate);
  if ("vatIncluded" in input.govde) d.vatIncluded = vatIncluded;

  /**
   * ⚠ Tutar YALNIZ `enteredAmountMinor` üzerinden güncellenir. Doğrudan
   * `amountMinor` kabul edilseydi, KDV dahil giren bir kullanıcı her
   * kaydetmede net'i yeniden böler ve tutar sessizce küçülürdü.
   */
  if ("enteredAmountMinor" in input.govde) {
    d.amountMinor = netHesapla(Number(input.govde.enteredAmountMinor), vatIncluded, vatRate);
  }
  if ("currencyCode" in input.govde) {
    d.currencyCode = (metin(input.govde.currencyCode) ?? "TRY").toUpperCase();
  }
  if ("fxRate" in input.govde) {
    const fx = Number(input.govde.fxRate);
    if (!(fx > 0)) throw new SozlesmeKuralHatasi("VALIDATION", "Kur pozitif olmalıdır");
    d.fxRate = String(fx);
  }
  const yeniNet = (d.amountMinor as number | undefined) ?? s.amountMinor;
  const yeniFx = Number((d.fxRate as string | undefined) ?? s.fxRate);
  if ("enteredAmountMinor" in input.govde || "fxRate" in input.govde) {
    d.amountBaseMinor = Math.round(yeniNet * yeniFx);
  }

  if (Object.keys(d).length === 0) {
    throw new SozlesmeKuralHatasi("VALIDATION", "Güncellenecek alan yok");
  }

  // Değişiklik sonrası plan hâlâ üretilebiliyor mu?
  planiDogrula({
    amountMinor: yeniNet,
    amountBasis: (d.amountBasis as TutarTemeli) ?? (s.amountBasis as TutarTemeli),
    vatRatePercent: vatRate,
    billingFrequency:
      (d.billingFrequency as FaturalamaSikligi) ?? (s.billingFrequency as FaturalamaSikligi),
    billingInterval: (d.billingInterval as number) ?? s.billingInterval,
    startDate: (d.startDate as string) ?? s.startDate,
    endDate: "endDate" in d ? (d.endDate as string | null) : s.endDate,
    firstDueDate: "firstDueDate" in d ? (d.firstDueDate as string | null) : s.firstDueDate,
    paymentDay: "paymentDay" in d ? (d.paymentDay as number | null) : s.paymentDay,
    installmentCount:
      "installmentCount" in d ? (d.installmentCount as number | null) : s.installmentCount,
  });

  const sonuc = await db
    .update(contracts)
    .set({ ...d, updatedById: input.aktorId })
    .where(and(eq(contracts.id, input.contractId), isNull(contracts.deletedAt)))
    .returning({ id: contracts.id });
  if (!sonuc[0]) throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");
  return { id: sonuc[0].id, degisenAlanlar: Object.keys(d) };
}

/** Silme — YALNIZ taslak, soft delete. Aktif sözleşme silinemez. */
export async function sozlesmeSil(input: { contractId: string; aktorId: string }) {
  const mevcut = await db
    .select({ id: contracts.id, status: contracts.status, contractNo: contracts.contractNo })
    .from(contracts)
    .where(and(eq(contracts.id, input.contractId), isNull(contracts.deletedAt)))
    .limit(1);
  const s = mevcut[0];
  if (!s) throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");
  if (s.status !== "draft") {
    throw new SozlesmeKuralHatasi(
      "CONTRACT_LOCKED",
      "Yalnız taslak sözleşme silinebilir",
    );
  }
  await db
    .update(contracts)
    .set({ deletedAt: sql`now()`, deletedById: input.aktorId })
    .where(eq(contracts.id, input.contractId));
  /**
   * ⚠ Numara SERBEST BIRAKILMAZ: benzersizlik indeksi tüm satırları kapsar ve
   * sayaç geri sarılmaz. Silinen taslağın numarası bir daha verilmez.
   */
  return { id: s.id, contractNo: s.contractNo };
}

// ══════════════════════════════════════════════════════════════════════════
// Durum geçişleri — kilitli, tek transaction
// ══════════════════════════════════════════════════════════════════════════

type Islem = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Sözleşme satırını KİLİTLEYEREK okur.
 *
 * ⚠ `SELECT … FOR UPDATE`: durum okuma, geçiş kontrolü ve yazma aynı
 * transaction'da olmalı. Kilitsizken iki paralel `activate` isteği de "draft"
 * görür, ikisi de yazar ve iki ayrı denetim kaydı düşer.
 */
async function kilitliSozlesme(tx: Islem, contractId: string) {
  const rows = await tx.execute(
    sql`SELECT id, status, brand_id, contract_no, activated_at
          FROM contracts
         WHERE id = ${contractId} AND deleted_at IS NULL
         FOR UPDATE`,
  );
  const r = (rows as unknown as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[]);
  const satir = r[0];
  if (!satir) throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");
  return {
    id: String(satir.id),
    status: String(satir.status),
    brandId: String(satir.brand_id),
    contractNo: String(satir.contract_no),
  };
}

export interface AktivasyonSonucu {
  id: string;
  contractNo: string;
  markaAktiflestirildi: boolean;
  brandId: string;
  baglananHizmetler: { serviceId: string; brandServiceId: string; yeni: boolean }[];
  warnings: string[];
}

/**
 * Sözleşmeyi yürürlüğe alır — TEK TRANSACTION.
 *
 * Aynı tx içinde: durum + `activated_at` + (gerekiyorsa) marka durumu +
 * marka-hizmet bağlama. Herhangi bir adım düşerse hepsi geri alınır.
 *
 * ⚠ HİÇBİR `receivables` / `recurring_templates` kaydı YAZILMAZ (§8).
 */
export async function sozlesmeAktiflestir(input: {
  contractId: string;
  aktorId: string;
}): Promise<AktivasyonSonucu> {
  return db.transaction(async (tx) => {
    const s = await kilitliSozlesme(tx, input.contractId);
    if (!gecisGecerliMi(s.status, "active")) {
      throw new SozlesmeKuralHatasi(
        "INVALID_TRANSITION",
        `"${s.status}" durumundaki sözleşme yürürlüğe alınamaz`,
      );
    }

    // Marka da kilitlenir: durum kontrolü ile güncellemesi arasında değişmesin
    const markaRows = await tx.execute(
      sql`SELECT id, status, name FROM brands
           WHERE id = ${s.brandId} AND deleted_at IS NULL
           FOR UPDATE`,
    );
    const mr = (markaRows as unknown as { rows?: Record<string, unknown>[] }).rows ??
      (markaRows as unknown as Record<string, unknown>[]);
    const marka = mr[0];
    if (!marka) throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");

    const markaDurum = String(marka.status);
    if (AKTIVASYONA_KAPALI.has(markaDurum)) {
      throw new SozlesmeKuralHatasi(
        "BRAND_NOT_ACTIVATABLE",
        `"${String(marka.name)}" markası ${markaDurum === "suspended" ? "askıda" : "ayrılmış"}; yeni yükümlülük yazılamaz`,
      );
    }

    let markaAktiflestirildi = false;
    if (MARKAYI_AKTIFLESTIR.has(markaDurum)) {
      await tx
        .update(brands)
        .set({ status: "active", updatedById: input.aktorId })
        .where(eq(brands.id, s.brandId));
      markaAktiflestirildi = true;
    }

    await tx
      .update(contracts)
      .set({
        status: "active",
        activatedAt: sql`now()`,
        updatedById: input.aktorId,
      })
      .where(eq(contracts.id, input.contractId));

    const { baglananlar, warnings } = await markaHizmetleriniBagla(tx, {
      brandId: s.brandId,
      contractId: input.contractId,
      aktorId: input.aktorId,
    });

    return {
      id: s.id,
      contractNo: s.contractNo,
      markaAktiflestirildi,
      brandId: s.brandId,
      baglananHizmetler: baglananlar,
      warnings,
    };
  });
}

/**
 * Sözleşmenin hizmetlerini markaya bağlar — AKTİVASYONLA AYNI TRANSACTION'DA.
 *
 * Üç durum ayrı ele alınır; `brand_services` üzerindeki kısmi tekillik yalnız
 * `deleted_at IS NULL` satırları kapsadığı için "zaten var mı" sorusu tek
 * sorguyla cevaplanamaz:
 *   yok                      → INSERT
 *   var, canlı               → dokunulmaz (ikinci satır YOK, denetim kaydı YOK)
 *   var, soft delete edilmiş → CANLANDIRILIR (yeni satır açılmaz)
 *
 * Pasif katalog hizmeti BAĞLANMAZ ama aktivasyonu da engellemez: sözleşme
 * imzalanmış, kalem snapshot'ı duruyor.
 */
async function markaHizmetleriniBagla(
  tx: Islem,
  p: { brandId: string; contractId: string; aktorId: string },
): Promise<{
  baglananlar: { serviceId: string; brandServiceId: string; yeni: boolean }[];
  warnings: string[];
}> {
  const kalemler = await tx
    .select({
      serviceId: contractItems.serviceId,
      ad: contractItems.name,
      isActive: services.isActive,
      hizmetAdi: services.name,
    })
    .from(contractItems)
    .innerJoin(services, eq(services.id, contractItems.serviceId))
    .where(
      and(
        eq(contractItems.contractId, p.contractId),
        isNull(contractItems.deletedAt),
        isNull(services.deletedAt),
      ),
    );

  const baglananlar: { serviceId: string; brandServiceId: string; yeni: boolean }[] = [];
  const warnings: string[] = [];
  const gorulen = new Set<string>();

  for (const k of kalemler) {
    const serviceId = k.serviceId;
    if (!serviceId || gorulen.has(serviceId)) continue;
    gorulen.add(serviceId);

    if (!k.isActive) {
      warnings.push(
        `"${k.hizmetAdi}" katalogda pasif; markanın hizmet listesine eklenmedi`,
      );
      continue;
    }

    const mevcut = await tx
      .select({ id: brandServices.id, deletedAt: brandServices.deletedAt })
      .from(brandServices)
      .where(
        and(eq(brandServices.brandId, p.brandId), eq(brandServices.serviceId, serviceId)),
      )
      .orderBy(asc(brandServices.deletedAt))
      .limit(1);

    const kayit = mevcut[0];
    if (kayit && kayit.deletedAt === null) continue; // zaten canlı: işlem yok

    if (kayit) {
      // Soft delete edilmiş kayıt CANLANDIRILIR — yeni satır açılmaz
      await tx
        .update(brandServices)
        .set({ deletedAt: null, deletedById: null, updatedById: p.aktorId })
        .where(eq(brandServices.id, kayit.id));
      baglananlar.push({ serviceId, brandServiceId: kayit.id, yeni: false });
      continue;
    }

    const id = newId();
    await tx.insert(brandServices).values({
      id,
      brandId: p.brandId,
      serviceId,
      createdById: p.aktorId,
    });
    baglananlar.push({ serviceId, brandServiceId: id, yeni: true });
  }

  return { baglananlar, warnings };
}

/** Gerekçe doğrulaması — DB CHECK'iyle aynı sınır (btrim sonrası 3-500). */
function gerekce(deger: unknown, alanAdi: string): string {
  const t = typeof deger === "string" ? deger.trim() : "";
  if (t.length < 3 || t.length > 500) {
    throw new SozlesmeKuralHatasi(
      "VALIDATION",
      `${alanAdi} en az 3, en çok 500 karakter olmalıdır`,
    );
  }
  return t;
}

/**
 * Sözleşmeyi sonlandırır.
 *
 * ⚠ `brand_services` DOKUNULMAZ: marka o hizmeti başka bir sözleşmeyle alıyor
 * ya da operasyonel olarak kullanıyor olabilir. Sözleşme bitti diye bağlantıyı
 * koparmak sessiz veri kaybıdır.
 */
export async function sozlesmeSonlandir(input: {
  contractId: string;
  endReason: unknown;
  aktorId: string;
}) {
  const reason = gerekce(input.endReason, "Sonlandırma gerekçesi");
  return db.transaction(async (tx) => {
    const s = await kilitliSozlesme(tx, input.contractId);
    if (!gecisGecerliMi(s.status, "ended")) {
      throw new SozlesmeKuralHatasi(
        "INVALID_TRANSITION",
        `"${s.status}" durumundaki sözleşme sonlandırılamaz`,
      );
    }
    await tx
      .update(contracts)
      .set({
        status: "ended",
        endedAt: sql`now()`,
        endReason: reason,
        updatedById: input.aktorId,
      })
      .where(eq(contracts.id, input.contractId));
    return { id: s.id, contractNo: s.contractNo, endReason: reason };
  });
}

/**
 * Sözleşmeyi iptal eder — TASLAK İPTALİ DÂHİL.
 *
 * Taslakta `activated_at` NULL kalır: sözleşme hiç yürürlüğe girmemiştir.
 * `brand_services` burada da dokunulmaz.
 */
export async function sozlesmeIptalEt(input: {
  contractId: string;
  cancelReason: unknown;
  aktorId: string;
}) {
  const reason = gerekce(input.cancelReason, "İptal gerekçesi");
  return db.transaction(async (tx) => {
    const s = await kilitliSozlesme(tx, input.contractId);
    if (!gecisGecerliMi(s.status, "cancelled")) {
      throw new SozlesmeKuralHatasi(
        "INVALID_TRANSITION",
        `"${s.status}" durumundaki sözleşme iptal edilemez`,
      );
    }
    await tx
      .update(contracts)
      .set({
        status: "cancelled",
        cancelledAt: sql`now()`,
        cancelReason: reason,
        updatedById: input.aktorId,
      })
      .where(eq(contracts.id, input.contractId));
    return { id: s.id, contractNo: s.contractNo, cancelReason: reason };
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Ödeme planı önizlemesi
// ══════════════════════════════════════════════════════════════════════════

/**
 * Sözleşmenin ödeme planını hesaplar. **Kayıt üretmez.**
 *
 * OPS bu ucu çağıramaz (rota katmanı engeller); yine de finansal veri
 * döndürdüğü için burada da rol kontrolü var — savunma derinliği.
 */
export async function sozlesmeOdemePlani(
  user: CurrentUser,
  contractId: string,
): Promise<OdemePlani & { currencyCode: string }> {
  if (!finansGorebilirMi(user.role)) {
    throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");
  }
  const rows = await db
    .select({
      amountMinor: contracts.amountMinor,
      amountBasis: contracts.amountBasis,
      vatRate: contracts.vatRate,
      billingFrequency: contracts.billingFrequency,
      billingInterval: contracts.billingInterval,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      firstDueDate: contracts.firstDueDate,
      paymentDay: contracts.paymentDay,
      installmentCount: contracts.installmentCount,
      currencyCode: contracts.currencyCode,
    })
    .from(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        isNull(contracts.deletedAt),
        markaKapsamKosulu(user, contracts.brandId),
      ),
    )
    .limit(1);

  const s = rows[0];
  if (!s) throw new SozlesmeKuralHatasi("CONTRACT_NOT_FOUND", "Sözleşme bulunamadı");

  try {
    const plan = odemePlaniOnizle({
      amountMinor: s.amountMinor,
      amountBasis: s.amountBasis as TutarTemeli,
      vatRatePercent: Number(s.vatRate),
      billingFrequency: s.billingFrequency as FaturalamaSikligi,
      billingInterval: s.billingInterval,
      startDate: s.startDate,
      endDate: s.endDate,
      firstDueDate: s.firstDueDate,
      paymentDay: s.paymentDay,
      installmentCount: s.installmentCount,
    });
    return { ...plan, currencyCode: s.currencyCode };
  } catch (e) {
    if (e instanceof OdemePlaniHatasi) {
      throw new SozlesmeKuralHatasi(
        e.code === "PREVIEW_TOO_LONG" ? "PREVIEW_TOO_LONG" : "VALIDATION",
        e.message,
      );
    }
    throw e;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// CSV
// ══════════════════════════════════════════════════════════════════════════

/**
 * CSV sütunları — ROLE GÖRE.
 *
 * ⚠ OPS'un CSV'sinde tutar ve faturalama sütunları YOKTUR. Ekranda gizlenip
 * dışa aktarmada çıkan bir alan, süzgecin en kolay atlandığı yerdir.
 *
 * ⚠ Tutar sütununun yanında TUTAR TEMELİ sütunu vardır: tek başına bir rakam
 * dışa aktarılmaz, çünkü neyi ifade ettiği belirsiz kalır.
 */
export function sozlesmeCsvSutunlari(role: UserRole) {
  const ortak = [
    { baslik: "NUMARA", alan: "contractNo" },
    { baslik: "MARKA", alan: "brandName" },
    { baslik: "BASLIK", alan: "title" },
    { baslik: "DURUM", alan: "status" },
    { baslik: "BASLANGIC", alan: "startDate" },
    { baslik: "BITIS", alan: "endDate" },
    { baslik: "YENILEME GORUSMESI", alan: "renewalReviewDate" },
    { baslik: "YENILEME TARIHI", alan: "renewalDate" },
  ];
  if (!finansGorebilirMi(role)) return ortak;
  return [
    ...ortak,
    { baslik: "NET TUTAR", alan: "amountMinor" },
    { baslik: "TUTAR TEMELI", alan: "amountBasisEtiket" },
    { baslik: "PARA BIRIMI", alan: "currencyCode" },
    { baslik: "KDV ORANI", alan: "vatRate" },
    { baslik: "INDIRIM", alan: "discountMinor" },
    { baslik: "FATURALAMA", alan: "billingFrequency" },
    { baslik: "TAKSIT SAYISI", alan: "installmentCount" },
  ];
}

export const TUTAR_TEMELI_ETIKET: Record<string, string> = {
  per_period: "Donemlik",
  contract_total: "Sozlesme toplami",
};

export async function sozlesmeCsvSatirlari(
  user: CurrentUser,
  filtre: SozlesmeFiltresi = {},
) {
  const kayitlar = await sozlesmeleriListele(user, filtre);
  return kayitlar.map((k) => {
    const kayit = k as Record<string, unknown>;
    if (!("amountBasis" in kayit)) return kayit;
    return {
      ...kayit,
      amountBasisEtiket: TUTAR_TEMELI_ETIKET[String(kayit.amountBasis)] ?? "",
    };
  });
}
