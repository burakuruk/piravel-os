import { uuidv7 } from "uuidv7";

/**
 * UUID v7 standardı (şema v1.2, Karar 6):
 * Tüm ID'ler uygulama katmanında bu fonksiyonla üretilir.
 * DB'deki gen_random_uuid() default'u yalnızca manuel SQL için yedektir.
 * Hiçbir iş mantığı ID sırasına dayanmaz — sıralama daima created_at iledir.
 */
export function newId(): string {
  return uuidv7();
}
