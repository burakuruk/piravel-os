/** Kullanıcı ekranlarının ortak etiketleri — tek kaynak. */

export const ROL_ETIKET = {
  super_admin: "Süper Yönetici",
  finance: "Finans",
  operations: "Operasyon",
  member: "Üye",
} as const;

export const DURUM_ETIKET = {
  active: "Aktif",
  inactive: "Pasif",
  pending: "Davet bekliyor",
} as const;

export const DURUM_TON = {
  active: "success",
  inactive: "muted",
  pending: "warning",
} as const;

/**
 * Davet durumları. Kullanıcıya gösterilen TEK bilgi budur; ham token veya
 * hash hiçbir ekrana çıkmaz.
 */
export const DAVET_DURUM_ETIKET = {
  pending: "Davet bekliyor",
  expired: "Süresi doldu",
  accepted: "Kabul edildi",
  revoked: "İptal edildi",
} as const;
