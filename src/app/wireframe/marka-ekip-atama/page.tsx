/**
 * MARKAYA EKİP ÜYESİ ATAMA — wireframe (Sprint 2 §6)
 *
 * Tartışmaya açılan kararlar:
 *   · Atama bir YETKİ SINIRIDIR: OPS kullanıcısı yalnız atandığı markaları
 *     görür. Bu yüzden ekran "kime hangi markayı veriyorum" sorusunu net
 *     sormalı ve sonucu hemen göstermeli
 *   · Atama kaldırıldığında o kullanıcı markayı ANINDA göremez — uyarı verilir
 *   · SA ve FIN atamadan bağımsız olarak tüm markaları görür; listede bu
 *     açıkça yazılır, yoksa "neden onu atayamıyorum" sorusu çıkar
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
              ["Test operations", "Operasyon", "Yalnız atandığı markaları görür", true],
              ["Test finance", "Finans", "Tüm markaları görür (rol gereği)", false],
            ].map(([ad, rol, not, kaldirilabilir]) => (
              <div key={String(ad)} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-900">{String(ad)}</span>
                    <Rozet ton={rol === "Finans" ? "info" : "success"}>{String(rol)}</Rozet>
                  </div>
                  <div className="text-xs text-ink-400">{String(not)}</div>
                </div>
                {kaldirilabilir ? (
                  <span className="text-sm text-danger underline">Kaldır</span>
                ) : (
                  <span className="text-xs text-ink-400">Atama gerekmez</span>
                )}
              </div>
            ))}
          </div>
        </Kart>

        <Kart baslik="Kullanıcı ata">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <div className="mb-1 text-sm text-ink-600">Kullanıcı</div>
              <div className="flex h-9 items-center rounded-sm border border-line-300 px-3 text-sm text-ink-400">
                Ad veya e-posta ile ara… ▾
              </div>
            </div>
            <Dugme tur="birincil">Ata</Dugme>
          </div>

          <div className="mt-3 rounded-sm border border-line-200 bg-fill-100 p-3 text-sm">
            <div className="mb-2 text-xs tracking-widest text-ink-400">ARAMA SONUCU</div>
            <div className="space-y-2">
              {[
                ["Sahte Operasyon", "operations · sahte-ops@example.com", true],
                ["Örnek Üye", "member · ornek@example.com", true],
                ["Test Yonetici", "super_admin · admin@example.com", false],
              ].map(([ad, meta, atanabilir]) => (
                <div key={String(ad)} className="flex items-center justify-between">
                  <div>
                    <div className="text-ink-900">{String(ad)}</div>
                    <div className="text-xs text-ink-400">{String(meta)}</div>
                  </div>
                  {atanabilir ? (
                    <span className="text-xs text-navy-500 underline">Seç</span>
                  ) : (
                    <span className="text-xs text-ink-400">Zaten tüm markaları görür</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Kart>

        <div className="rounded-sm bg-warning-bg px-3 py-2 text-xs text-warning">
          <strong>Karar notu:</strong> Atama bir yetki sınırıdır. Kaldırıldığı anda
          OPS kullanıcısı bu markayı ve ona bağlı kayıtları göremez; açık
          sekmesinde de bir sonraki istekte erişimi kesilir. Kaldırma işlemi onay
          penceresi ister.
        </div>
      </div>
    </AppWire>
  );
}
