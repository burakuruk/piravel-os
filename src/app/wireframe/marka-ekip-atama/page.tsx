/**
 * MARKAYA EKİP ÜYESİ ATAMA — wireframe (Sprint 2 §6)
 *
 * Tartışmaya açılan kararlar:
 *   · Atama bir YETKİ SINIRIDIR: OPS kullanıcısı yalnız atandığı markaları
 *     görür. Bu yüzden ekran "kime hangi markayı veriyorum" sorusunu net
 *     sormalı ve sonucu hemen göstermeli
 *   · Atama kaldırıldığında o kullanıcı markayı ANINDA göremez — uyarı verilir
 *   · YALNIZ OPS ATANABİLİR. SA ve FIN arama sonuçlarına hiç girmez: rol
 *     gereği zaten tüm markaları görürler, atamak bir şeyi değiştirmez ve
 *     "atanmış" görünmeleri yetki tablosunu yanıltır. MEM bu sprintte
 *     markaya atanmaz — marka modülüne hiç erişemiyor
 *   · Pasif kullanıcılar listede görünmez
 */
import { AppWire, Dugme, Kart, Rozet } from "../_app-shell";

export default function MarkaEkipAtamaWireframe() {
  return (
    <AppWire
      baslik="Sahte Vize A.Ş. › Ekip ataması"
      aciklama="Bu markada çalışacak kullanıcılar."
    >
      <div className="max-w-[720px] space-y-4">
        <Kart baslik="Atanmış kullanıcılar">
          <div className="divide-y divide-line-200 text-sm">
            {[
              ["Sahte Operasyon", "sahte-ops@example.com", "12.03.2026 tarihinde atandı"],
              ["Örnek Operasyon", "ornek-ops@example.com", "02.07.2026 tarihinde atandı"],
            ].map(([ad, mail, not]) => (
              <div key={mail} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-900">{ad}</span>
                    <Rozet ton="success">Operasyon</Rozet>
                  </div>
                  <div className="truncate text-xs text-ink-400">
                    {mail} · {not}
                  </div>
                </div>
                <span className="shrink-0 text-sm text-danger underline">Kaldır</span>
              </div>
            ))}
          </div>
        </Kart>

        <Kart baslik="Operasyon kullanıcısı ata">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <div className="mb-1 text-sm text-ink-600">Kullanıcı</div>
              <div className="flex h-9 items-center rounded-sm border border-line-300 px-3 text-sm text-ink-400">
                Ad veya e-posta ile ara… ▾
              </div>
            </div>
            <Dugme tur="birincil">Ata</Dugme>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Aramada yalnız operasyon rolündeki aktif kullanıcılar çıkar. Yönetici ve
            finans rolleri tüm markaları rolleri gereği zaten görür; atanmaları
            gerekmez.
          </p>

          {/* Arama sonucu: yalnız OPS. SA/FIN/MEM sonuçlara hiç girmez. */}
          <div className="mt-3 rounded-sm border border-line-200 bg-fill-100 p-3 text-sm">
            <div className="mb-2 text-xs tracking-widest text-ink-400">ARAMA SONUCU</div>
            <div className="space-y-2">
              {[
                ["Deneme Operasyon", "sahte-ops2@example.com"],
                ["Test Operasyon", "test-ops@example.com"],
              ].map(([ad, mail]) => (
                <div key={mail} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-ink-900">{ad}</div>
                    <div className="truncate text-xs text-ink-400">operations · {mail}</div>
                  </div>
                  <span className="shrink-0 text-xs text-navy-500 underline">Seç</span>
                </div>
              ))}
            </div>
          </div>
        </Kart>

        <div className="rounded-sm bg-warning-bg px-3 py-2 text-xs text-warning">
          Atamayı kaldırdığınızda bu kullanıcı markayı ve ona bağlı kayıtları
          anında göremez. İşlem onay ister.
        </div>
      </div>
    </AppWire>
  );
}
