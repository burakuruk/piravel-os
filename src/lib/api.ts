import { headers as gelenBasliklar } from "next/headers";
import {
  atamaYonetebilirMi,
  hizmetKatalogunuYonetebilirMi,
  MarkaKuralHatasi,
  markaModulunuGorebilirMi,
  markayaErisebilirMi,
  markaYonetebilirMi,
} from "@/lib/brand-admin";
import { getCurrentUser, type CurrentUser } from "@/lib/authz";
import { requireStepUp, StepUpGerekli, type KritikIslem } from "@/lib/step-up";
import { IsKuraliHatasi, kullaniciListesiniGorebilirMi, kullaniciYonetebilirMi } from "@/lib/user-admin";

/**
 * API rotalarının ortak kapıları — PRD §7, docs/02.
 *
 * ⚠ Yetki kontrolü UI'da değil BURADA zorlanır. Butonu gizlemek yetki değildir;
 * yanıt gövdesi de rolün görebildiği alanlarla sınırlanır.
 */

export function hataYanit(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Kullanıcı yönetimine hiç erişemeyen roller için 404.
 *
 * 403 dönmek "böyle bir uç var ama sana kapalı" bilgisini sızdırırdı; MEM için
 * ucun varlığı da gizlenir.
 */
export const YOK = () => hataYanit("NOT_FOUND", "Bulunamadı", 404);

export class RotaHatasi extends Error {
  constructor(readonly yanit: Response) {
    super("rota hatası");
    this.name = "RotaHatasi";
  }
}

/** Oturum zorunlu; yoksa 401. */
export async function oturumluKullanici(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new RotaHatasi(hataYanit("UNAUTHENTICATED", "Oturum bulunamadı", 401));
  }
  return user;
}

/** Kullanıcı kayıtlarını OKUYABİLEN roller (SA/FIN/OPS). MEM → 404. */
export async function okuyabilenKullanici(): Promise<CurrentUser> {
  const user = await oturumluKullanici();
  if (!kullaniciListesiniGorebilirMi(user.role)) throw new RotaHatasi(YOK());
  return user;
}

/** Kullanıcı YÖNETEBİLEN rol (yalnız SA). Diğerleri 404 görür. */
export async function yonetenKullanici(): Promise<CurrentUser> {
  const user = await oturumluKullanici();
  if (!kullaniciYonetebilirMi(user.role)) throw new RotaHatasi(YOK());
  return user;
}

/**
 * Marka modülünü OKUYABİLEN roller (SA/FIN/OPS). MEM → 404.
 *
 * MEM için ucun VARLIĞI da gizlenir: 403 dönmek "böyle bir uç var ama sana
 * kapalı" bilgisini sızdırırdı.
 */
export async function markaOkuyabilenKullanici(): Promise<CurrentUser> {
  const user = await oturumluKullanici();
  if (!markaModulunuGorebilirMi(user.role)) throw new RotaHatasi(YOK());
  return user;
}

/**
 * Marka oluşturma/düzenleme (SA/FIN).
 *
 * OPS 403 alır, 404 değil: modülü zaten görüyor, ucun varlığı sır değil.
 * MEM yine 404 görür.
 */
export async function markaYonetenKullanici(): Promise<CurrentUser> {
  const user = await markaOkuyabilenKullanici();
  if (!markaYonetebilirMi(user.role)) {
    throw new RotaHatasi(hataYanit("FORBIDDEN", "Bu işlem için yetkiniz yok", 403));
  }
  return user;
}

/**
 * Ekip ataması YÖNETİMİ — yalnız SA, diğerleri 404.
 *
 * ⚠ Burada 403 değil 404 dönülür. Atama bir YETKİ DEVRİ ucudur; kimlerin
 * yetki dağıtabildiği bilgisi de kapalıdır. FIN, OPS ve MEM için ucun varlığı
 * görünmez. (Markanın "sorumlu ekip" LİSTESİ ayrıdır ve kapsam içindeki
 * herkese açıktır — detay ekranı onu gösteriyor.)
 */
export async function atamaYonetenKullanici(): Promise<CurrentUser> {
  const user = await oturumluKullanici();
  if (!atamaYonetebilirMi(user.role)) throw new RotaHatasi(YOK());
  return user;
}

/**
 * Hizmet kataloğu YAZMA — yalnız SA.
 *
 * FIN ve OPS katalogu okur (modülü zaten görüyorlar, ucun varlığı sır değil)
 * ama değiştiremez → 403. MEM modülü hiç görmediği için 404 alır.
 */
export async function hizmetYonetenKullanici(): Promise<CurrentUser> {
  const user = await markaOkuyabilenKullanici();
  if (!hizmetKatalogunuYonetebilirMi(user.role)) {
    throw new RotaHatasi(hataYanit("FORBIDDEN", "Bu işlem için yetkiniz yok", 403));
  }
  return user;
}

/**
 * Marka kapsam kapısı — kapsam dışı marka YOK gibi davranır.
 *
 * ⚠ 403 dönmek OPS'a hangi markaların VAR OLDUĞUNU söylerdi; atanmadığı bir
 * markanın kimliğini deneyen biri "var ama yasak" ile "hiç yok" arasındaki
 * farkı ölçerek müşteri listesini çıkarabilirdi.
 */
export async function erisilebilirMarka(user: CurrentUser, brandId: string): Promise<void> {
  if (!(await markayaErisebilirMi(user, brandId))) throw new RotaHatasi(YOK());
}

/** Kritik işlem kapısı — yükseltme yoksa 403 SESSION_STALE. */
export async function kritikIslemKapisi(
  user: CurrentUser,
  islem: KritikIslem,
): Promise<void> {
  try {
    await requireStepUp(user.sessionId, islem);
  } catch (e) {
    if (e instanceof StepUpGerekli) {
      throw new RotaHatasi(
        hataYanit("SESSION_STALE", "Bu işlem için kimliğinizi yeniden doğrulayın", 403),
      );
    }
    throw e;
  }
}

/**
 * Durum değiştiren isteklerin sertleştirmesi.
 *
 * Origin kontrolü CSRF'in asıl kapısıdır: tarayıcı bu başlığı script ile
 * değiştiremez, dolayısıyla başka bir siteden gönderilen istek elenir.
 * Content-Type kısıtı, `application/json`'ın basit istek (simple request)
 * sayılmamasına dayanır — form gönderimiyle CSRF denemesi preflight'a takılır.
 */
export async function yazmaIstegiDogrula(request: Request): Promise<void> {
  await durumDegistirenIstek(request);

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("application/json")) {
    throw new RotaHatasi(
      hataYanit("UNSUPPORTED_MEDIA_TYPE", "İçerik türü desteklenmiyor", 415),
    );
  }
}

/**
 * Durum değiştiren HER isteğin ortak kapısı — gövdesi olsun olmasın.
 *
 * ⚠ ORIGIN ZORUNLUDUR, "varsa doğrula" YETMEZ. Başlığın yokluğunu geçerli
 * saymak, onu göndermeyen her istemciye kapıyı açar; tarayıcıdan gelen
 * siteler arası istekler ise Origin'i daima taşır. Eksik başlık bu yüzden
 * reddedilir — CSRF koruması "başlık varsa kontrol et" ile kurulamaz.
 *
 * Gövde varsa yalnız `application/json` kabul edilir: bu tür basit istek
 * (simple request) sayılmadığı için siteler arası form gönderimi preflight'a
 * takılır ve hiç ulaşmaz.
 */
export async function durumDegistirenIstek(request: Request): Promise<void> {
  const basliklar = await gelenBasliklar();
  const origin = request.headers.get("origin");

  if (!origin) {
    throw new RotaHatasi(
      hataYanit("FORBIDDEN_ORIGIN", "İstek kaynağı doğrulanamadı", 403),
    );
  }
  if (!guvenilirOrigin(origin, basliklar.get("host"))) {
    throw new RotaHatasi(hataYanit("FORBIDDEN_ORIGIN", "İstek kaynağı kabul edilmedi", 403));
  }

  // Gövdesiz isteklerde Content-Type hiç gelmez; geldiyse JSON olmalı.
  const ct = request.headers.get("content-type");
  if (ct && !ct.toLowerCase().startsWith("application/json")) {
    throw new RotaHatasi(
      hataYanit("UNSUPPORTED_MEDIA_TYPE", "İçerik türü desteklenmiyor", 415),
    );
  }
}

/** Better Auth ile AYNI güvenilir origin kümesi. */
function guvenilirOrigin(origin: string, host: string | null): boolean {
  const izinli = new Set<string>();
  const ekle = (deger: string | undefined | null) => {
    if (!deger) return;
    for (const parca of deger.split(",")) {
      const t = parca.trim();
      if (t) izinli.add(t.replace(/\/$/, ""));
    }
  };
  ekle(process.env.BETTER_AUTH_URL);
  ekle(process.env.BETTER_AUTH_TRUSTED_ORIGINS);
  if (host) {
    izinli.add(`http://${host}`);
    izinli.add(`https://${host}`);
  }
  return izinli.has(origin.replace(/\/$/, ""));
}

/**
 * Davet bağlantısının üretileceği taban adres.
 *
 * `BETTER_AUTH_URL` önceliklidir: bağlantı e-postaya gidecek ve kullanıcının
 * göreceği kanonik adres odur. Host başlığı yalnız yapılandırma yoksa
 * kullanılır — istemci beyanına dayandığı için tek başına güvenilmez.
 */
export async function uygulamaOrigin(): Promise<string> {
  const yapilandirilmis = process.env.BETTER_AUTH_URL?.trim();
  if (yapilandirilmis) return yapilandirilmis.replace(/\/$/, "");
  const basliklar = await gelenBasliklar();
  const host = basliklar.get("host") ?? "localhost:3000";
  const sema = basliklar.get("x-forwarded-proto") ?? "http";
  return `${sema}://${host}`;
}

/** Gövdeyi güvenli oku — bozuk JSON istisna fırlatmaz. */
export async function govdeOku<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

/** İş kuralı hatalarını tutarlı HTTP koduna çevirir. */
export function isKuraliYaniti(e: unknown): Response | null {
  if (e instanceof IsKuraliHatasi) {
    const durum =
      e.code === "USER_NOT_FOUND" ? 404 : e.code === "EMAIL_TAKEN" ? 409 : 400;
    return hataYanit(e.code, e.message, durum);
  }
  if (e instanceof MarkaKuralHatasi) return hataYanit(e.code, e.message, markaDurumu(e.code));
  return null;
}

/**
 * Marka iş kuralı → HTTP.
 *
 * 409: eşzamanlı/çakışan durum (kod alınmış). 422: istek biçimsel olarak
 * doğru ama iş kuralı reddediyor (pasif hizmet atanamaz, kod değiştirilemez,
 * kullanıcı atanabilir değil) — istemcinin gövdeyi düzelterek tekrar
 * denemesi anlamsızdır. 400: gövde hatalı.
 */
function markaDurumu(code: MarkaKuralHatasi["code"]): number {
  switch (code) {
    case "BRAND_NOT_FOUND":
    case "SERVICE_NOT_FOUND":
    case "CONTACT_NOT_FOUND":
      return 404;
    case "BRAND_CODE_TAKEN":
    case "SERVICE_CODE_TAKEN":
      return 409;
    case "BRAND_CODE_IMMUTABLE":
    case "SERVICE_INACTIVE":
    case "USER_NOT_ASSIGNABLE":
      return 422;
    default:
      return 400;
  }
}

/** Rota gövdesini saran ortak hata dönüşümü. */
export async function rota(islev: () => Promise<Response>): Promise<Response> {
  try {
    return await islev();
  } catch (e) {
    if (e instanceof RotaHatasi) return e.yanit;
    const isKurali = isKuraliYaniti(e);
    if (isKurali) return isKurali;
    console.error("Rota hatası:", e);
    return hataYanit("INTERNAL", "Beklenmeyen bir hata oluştu", 500);
  }
}
