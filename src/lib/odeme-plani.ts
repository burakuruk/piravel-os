import { allocateMinor, taxMinor } from "@/lib/money";

/**
 * Ödeme planı ÖNİZLEME motoru — Sprint 3 (plan §8, §3e-1).
 *
 * ⚠ Bu modül SAF'tır: veritabanına yazmaz, okumaz, tarih için "şimdi"yi
 * kullanmaz. Aynı girdi her zaman aynı çıktıyı verir — testlerin sabitleyeceği
 * tek şey budur.
 *
 * ⚠ HİÇBİR `receivables` / `recurring_templates` kaydı ÜRETİLMEZ. Bu sprintte
 * plan yalnız hesaplanır ve gösterilir; Sprint 4'te aynı fonksiyon recurrence
 * motorunun girdi üreticisi olacak.
 *
 * Tutar aritmetiği `@/lib/money`'dedir (Karar 1); burada yalnız takvim ve
 * satır kurgusu var.
 */

export type TutarTemeli = "per_period" | "contract_total";
export type FaturalamaSikligi = "one_time" | "monthly" | "quarterly" | "yearly";

/** Üretilebilecek en fazla satır — bozuk yapılandırma sunucuyu meşgul etmesin. */
export const PLAN_UST_SINIR = 120;

/** Süresiz `per_period` sözleşmede gösterilen örnek dönem sayısı. */
export const SINIRSIZ_ORNEK_DONEM = 12;

export class OdemePlaniHatasi extends Error {
  constructor(
    readonly code: "PREVIEW_TOO_LONG" | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "OdemePlaniHatasi";
  }
}

export interface OdemePlaniGirdisi {
  /** KDV hariç NET tutar. Neyi ifade ettiğini `amountBasis` söyler. */
  amountMinor: number;
  amountBasis: TutarTemeli;
  vatRatePercent: number;
  billingFrequency: FaturalamaSikligi;
  billingInterval: number;
  /** YYYY-MM-DD */
  startDate: string;
  endDate?: string | null;
  firstDueDate?: string | null;
  paymentDay?: number | null;
  installmentCount?: number | null;
}

export interface PlanSatiri {
  sira: number;
  /** YYYY-MM-DD */
  vadeTarihi: string;
  netMinor: number;
  kdvMinor: number;
  brutMinor: number;
}

export interface OdemePlani {
  satirlar: PlanSatiri[];
  toplam: { netMinor: number; kdvMinor: number; brutMinor: number };
  /**
   * Süresiz `per_period` sözleşmede liste bir ÖRNEKTİR, kırpma değildir:
   * sözleşmenin toplamı zaten tanımsızdır, kırpılacak bir toplam yoktur.
   */
  sinirliOnizleme: boolean;
}

// ══════════════════════════════════════════════════════════════════════════
// Takvim
// ══════════════════════════════════════════════════════════════════════════

interface Tarih {
  yil: number;
  ay: number; // 1-12
  gun: number;
}

/** "YYYY-MM-DD" → parça. Biçim dışı girdi VALIDATION'dır, sessizce NaN değil. */
function tarihAyristir(deger: string, alan: string): Tarih {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deger ?? "");
  if (!m) throw new OdemePlaniHatasi("VALIDATION", `${alan} geçerli bir tarih değil`);
  const yil = Number(m[1]);
  const ay = Number(m[2]);
  const gun = Number(m[3]);
  if (ay < 1 || ay > 12 || gun < 1 || gun > ayinSonGunu(yil, ay)) {
    throw new OdemePlaniHatasi("VALIDATION", `${alan} geçerli bir tarih değil`);
  }
  return { yil, ay, gun };
}

function tarihYaz(t: Tarih): string {
  return `${String(t.yil).padStart(4, "0")}-${String(t.ay).padStart(2, "0")}-${String(t.gun).padStart(2, "0")}`;
}

/**
 * Ayın son günü.
 *
 * `Date.UTC(y, m, 0)` kullanılır: yerel saat dilimi kullanılsaydı sunucu
 * saatine göre bir gün kayabilirdi ve plan ortamdan ortama değişirdi.
 */
function ayinSonGunu(yil: number, ay: number): number {
  return new Date(Date.UTC(yil, ay, 0)).getUTCDate();
}

/**
 * Aya ay ekler ve HEDEF GÜNÜ kırparak tarih üretir.
 *
 * ⚠ Kırpılmış gün ANA DEĞER OLARAK TAŞINMAZ. Vade günü 31 ise Nisan'da 30'a
 * kırpılır ama Mayıs yine 31 olmalıdır. Kırpılan günden devam edilseydi plan
 * ilk kısa aydan sonra kalıcı olarak kayardı (31 → 30 → 30 → 30…).
 */
function ayEkle(baslangic: { yil: number; ay: number }, aySayisi: number, hedefGun: number): Tarih {
  const toplamAy = (baslangic.yil * 12 + (baslangic.ay - 1)) + aySayisi;
  const yil = Math.floor(toplamAy / 12);
  const ay = (toplamAy % 12) + 1;
  return { yil, ay, gun: Math.min(hedefGun, ayinSonGunu(yil, ay)) };
}

/** Sıklığın ay cinsinden adımı. `one_time` tek satırlıktır, adımı yoktur. */
function adimAy(siklik: FaturalamaSikligi, interval: number): number {
  switch (siklik) {
    case "monthly":
      return 1 * interval;
    case "quarterly":
      return 3 * interval;
    case "yearly":
      return 12 * interval;
    case "one_time":
      return 0;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Motor
// ══════════════════════════════════════════════════════════════════════════

/**
 * Ödeme planını hesaplar. **Hiçbir kayıt üretmez.**
 *
 * Bitiş kuralları (plan §8):
 *   one_time                     → tam 1 satır
 *   installmentCount dolu        → o kadar satır
 *   installmentCount boş + endDate → endDate'e kadar
 *   ikisi de boş                 → per_period'de 12 dönem ÖRNEK,
 *                                  contract_total'da VALIDATION
 *   ikisi de dolu                → önce ulaşılan sınır
 */
export function odemePlaniOnizle(girdi: OdemePlaniGirdisi): OdemePlani {
  const {
    amountMinor,
    amountBasis,
    vatRatePercent,
    billingFrequency,
    billingInterval,
    installmentCount,
  } = girdi;

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new OdemePlaniHatasi("VALIDATION", "Tutar sıfırdan büyük olmalıdır");
  }
  if (!Number.isSafeInteger(billingInterval) || billingInterval < 1 || billingInterval > 12) {
    throw new OdemePlaniHatasi("VALIDATION", "Faturalama aralığı 1-12 arasında olmalıdır");
  }
  if (installmentCount != null && (!Number.isSafeInteger(installmentCount) || installmentCount < 1)) {
    throw new OdemePlaniHatasi("VALIDATION", "Taksit sayısı en az 1 olmalıdır");
  }

  const start = tarihAyristir(girdi.startDate, "Başlangıç tarihi");
  const end = girdi.endDate ? tarihAyristir(girdi.endDate, "Bitiş tarihi") : null;

  // ── İlk vade ──
  //
  // `firstDueDate` `paymentDay`'den ÖNCELİKLİDİR; boşsa vade start_date +
  // payment_day kuralından türetilir.
  const ilkVade = ilkVadeHesapla(girdi, start);

  /**
   * Hedef gün: takvimin çapası. `paymentDay` varsa o kazanır — kullanıcı
   * "her ayın 31'i" dediğinde ilk vade 30 Nisan'a kırpılsa bile sonraki
   * aylar 31 olmalı.
   */
  const hedefGun = girdi.paymentDay ?? ilkVade.gun;
  if (girdi.paymentDay != null && (girdi.paymentDay < 1 || girdi.paymentDay > 31)) {
    throw new OdemePlaniHatasi("VALIDATION", "Ödeme günü 1-31 arasında olmalıdır");
  }

  // ── Satır sayısı ──
  const { adet, sinirliOnizleme } = satirSayisi({
    billingFrequency,
    amountBasis,
    installmentCount: installmentCount ?? null,
    end,
    ilkVade,
    adim: adimAy(billingFrequency, billingInterval),
    hedefGun,
  });

  // ── Tutarlar ──
  //
  // Sıra önemli: önce SÖZLEŞME seviyesinde toplam net/KDV hesaplanır, sonra
  // ikisi AYRI AYRI bölünür. Taksit başına KDV hesaplayıp toplamak her satırda
  // ayrı yuvarlama yapıp kuruş biriktirirdi.
  const netler =
    amountBasis === "contract_total"
      ? allocateMinor(amountMinor, adet)
      : new Array<number>(adet).fill(amountMinor);

  const toplamNet = amountBasis === "contract_total" ? amountMinor : amountMinor * adet;
  const toplamKdv = taxMinor(toplamNet, vatRatePercent);

  const kdvler =
    amountBasis === "contract_total"
      ? allocateMinor(toplamKdv, adet)
      : new Array<number>(adet).fill(taxMinor(amountMinor, vatRatePercent));

  // ── Satırlar ──
  const satirlar: PlanSatiri[] = [];
  const adim = adimAy(billingFrequency, billingInterval);
  for (let i = 0; i < adet; i += 1) {
    const vade = i === 0 ? ilkVade : ayEkle(ilkVade, adim * i, hedefGun);
    const netMinor = netler[i]!;
    const kdvMinor = kdvler[i]!;
    satirlar.push({
      sira: i + 1,
      vadeTarihi: tarihYaz(vade),
      netMinor,
      kdvMinor,
      // Brüt BÖLÜNMEZ, satırda türetilir: bağımsız yuvarlansaydı
      // Σ brüt ≠ sözleşme brütü olabilirdi.
      brutMinor: netMinor + kdvMinor,
    });
  }

  const netToplam = satirlar.reduce((t, s) => t + s.netMinor, 0);
  const kdvToplam = satirlar.reduce((t, s) => t + s.kdvMinor, 0);

  return {
    satirlar,
    toplam: {
      netMinor: netToplam,
      kdvMinor: kdvToplam,
      brutMinor: netToplam + kdvToplam,
    },
    sinirliOnizleme,
  };
}

/**
 * İlk vade tarihi.
 *
 * `firstDueDate` verilmişse aynen kullanılır (DB'de `>= start_date` CHECK'i
 * var). Yoksa `paymentDay` başlangıç ayına uygulanır; o gün başlangıçtan
 * önceye düşerse bir sonraki döneme kaydırılır — vadesi geçmiş bir ilk taksit
 * üretmek anlamsız olurdu. `paymentDay` de yoksa başlangıç tarihinin kendisi.
 */
function ilkVadeHesapla(girdi: OdemePlaniGirdisi, start: Tarih): Tarih {
  if (girdi.firstDueDate) {
    const ilk = tarihAyristir(girdi.firstDueDate, "İlk vade tarihi");
    if (tarihYaz(ilk) < tarihYaz(start)) {
      throw new OdemePlaniHatasi(
        "VALIDATION",
        "İlk vade tarihi başlangıç tarihinden önce olamaz",
      );
    }
    return ilk;
  }
  if (girdi.paymentDay == null) return start;

  const adayAy = { yil: start.yil, ay: start.ay };
  const aday = ayEkle(adayAy, 0, girdi.paymentDay);
  if (tarihYaz(aday) >= tarihYaz(start)) return aday;
  return ayEkle(adayAy, adimAy(girdi.billingFrequency, girdi.billingInterval) || 1, girdi.paymentDay);
}

/**
 * Kaç satır üretilecek?
 *
 * ⚠ `endDate`'e kadar sayarken döngü ÜST SINIRDA kesilir ve hata fırlatılır —
 * uzak bir bitiş tarihi on binlerce satır üretip belleği tüketmemeli. Liste
 * KISALTILMAZ: kısaltılmış bir plan toplamı sözleşme tutarından küçük gösterir
 * ve yanlış bir rakam konuşulur.
 */
function satirSayisi(p: {
  billingFrequency: FaturalamaSikligi;
  amountBasis: TutarTemeli;
  installmentCount: number | null;
  end: Tarih | null;
  ilkVade: Tarih;
  adim: number;
  hedefGun: number;
}): { adet: number; sinirliOnizleme: boolean } {
  if (p.billingFrequency === "one_time") return { adet: 1, sinirliOnizleme: false };

  const bitisAdedi = p.end ? tariheKadarAdet(p.ilkVade, p.end, p.adim, p.hedefGun) : null;

  // İkisi de doluysa ÖNCE ULAŞILAN sınır
  const adaylar = [p.installmentCount, bitisAdedi].filter(
    (x): x is number => typeof x === "number",
  );

  if (adaylar.length === 0) {
    // Sınırsız: toplam temelinde bölünemez (DB CHECK de engeller)
    if (p.amountBasis === "contract_total") {
      throw new OdemePlaniHatasi(
        "VALIDATION",
        "Toplam tutar temelinde taksit sayısı veya bitiş tarihi zorunludur",
      );
    }
    return { adet: SINIRSIZ_ORNEK_DONEM, sinirliOnizleme: true };
  }

  const adet = Math.min(...adaylar);
  if (adet < 1) {
    throw new OdemePlaniHatasi(
      "VALIDATION",
      "Bitiş tarihi ilk vadeden önce; hiç vade üretilemiyor",
    );
  }
  if (adet > PLAN_UST_SINIR) {
    throw new OdemePlaniHatasi(
      "PREVIEW_TOO_LONG",
      `Bu yapılandırma ${adet} vade üretiyor; üst sınır ${PLAN_UST_SINIR}. ` +
        "Taksit sayısını düşürün ya da bitiş tarihini öne çekin.",
    );
  }
  return { adet, sinirliOnizleme: false };
}

/** İlk vadeden bitişe kadar kaç vade sığar? Üst sınırı aşarsa sınırın 1 fazlası. */
function tariheKadarAdet(ilkVade: Tarih, end: Tarih, adim: number, hedefGun: number): number {
  const bitis = tarihYaz(end);
  if (tarihYaz(ilkVade) > bitis) return 0;
  let adet = 1;
  while (adet <= PLAN_UST_SINIR) {
    const sonraki = ayEkle(ilkVade, adim * adet, hedefGun);
    if (tarihYaz(sonraki) > bitis) return adet;
    adet += 1;
  }
  // Sınırın üstünde: kesin sayı gerekmiyor, çağıran zaten hata fırlatacak
  return PLAN_UST_SINIR + 1;
}
