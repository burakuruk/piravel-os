/**
 * Davet akışının İSTEMCİYE de açık sabitleri.
 *
 * ⚠ Bu dosya bilerek bağımlılıksızdır. `invitations.ts` veritabanı sürücüsünü
 * (`pg`) içeri alır; bir istemci bileşeni oradan tek bir sabit için import
 * ettiğinde Turbopack `fs`/`net`/`tls` çözemeyip derlemeyi düşürür. Sabitler
 * burada durur, sunucu tarafı `invitations.ts` üzerinden yeniden dışa verir.
 */

/** Kabul edilen parolanın en küçük uzunluğu (seed script'iyle aynı kural). */
export const MIN_PAROLA_UZUNLUGU = 12;

/** Davetin geçerlilik süresi. */
export const DAVET_GECERLILIK_SAAT = 72;

/**
 * Kabul ekranı çerezinin ömrü. Davetin kendisinden (72 saat) çok daha kısa:
 * çerez yalnız "bağlantıya az önce tıklandı" bilgisini taşır.
 */
export const DAVET_CEREZ_SURESI_SN = 10 * 60;

/** Çerez adı — Path=/davet ile sınırlanır. */
export const DAVET_CEREZ_ADI = "piravel_davet";

/** Dışarıya tek tip yanıt: hangi durumda olduğu kullanıcıya AÇIKLANMAZ. */
export const DAVET_HATA_KODU = "INVITATION_UNAVAILABLE";
export const DAVET_HATA_MESAJI =
  "Bu davet bağlantısı kullanılamıyor. Yöneticinizden yeni bir bağlantı isteyin.";
