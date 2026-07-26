-- Kilit yükseltme sayacının gün alanı açıklaştırılıyor.
--
-- "password_lock_day" adı, alanın NE OLDUĞUNU değil ne zaman yazıldığını
-- ima ediyordu. Alan aslında password_lock_count_today sayacının hangi
-- takvim gününe ait olduğunu tutar; ikisi birlikte anlam taşır.
--
-- RENAME kullanılıyor (drop + create değil): sütun düşürülseydi devam eden
-- kilit yükseltme durumu kaybolur ve o gün ikinci kez eşiğe ulaşan bir hesap
-- yanlışlıkla kısa kilit alırdı.
ALTER TABLE "auth_security_state"
  RENAME COLUMN "password_lock_day" TO "password_lock_count_date";
