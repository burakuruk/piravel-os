/**
 * YENİLEME BİLGİLERİ KARTI — wireframe (REVİZE 3)
 *
 * Tartışmaya açılan kararlar:
 *   · İKİ AYRI TARİH: "yenileme görüşmesi" ile "yenileme" aynı şey değil.
 *     31.03.2027'de biten bir sözleşmede 15.09.2026 yenileme tarihi olamaz;
 *     o gün görüşmenin yapılacağı gündür. Tek kolon iki kavramı taşıyınca hem
 *     rozet hem de bildirim yanlış konuşuyor
 *   · ROZET METNİ DAYANDIĞI ALANI SÖYLER: görüşme tarihi varsa "Yenileme
 *     görüşmesine N gün", yoksa "Yenilemeye N gün". Aynı metnin iki farklı
 *     tarihi göstermesi, kullanıcının takvimini yanlış kurmasına yol açıyordu
 *   · Kart, sözleşmenin bitişini de gösterir: iki tarih ancak bitişe göre
 *     anlamlı okunuyor
 *   · Yenileme planlanmamışsa kart boş kalmaz, ne yapılabileceğini söyler
 */
import { Bilgi, Kart, Rozet } from "../_app-shell";

function Tuval({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[1000px]">
        <h1 className="font-display text-2xl font-semibold text-ink-900">{baslik}</h1>
        <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        <div className="mt-6 grid gap-x-6 gap-y-6 lg:grid-cols-2">{children}</div>
      </div>
    </div>
  );
}

function Durum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-xs font-medium tracking-widest text-ink-400">{label}</div>
      {children}
    </div>
  );
}

export default function SozlesmeYenilemeWireframe() {
  return (
    <Tuval baslik="Yenileme bilgileri kartı">
      <Durum label="1 · GÖRÜŞME VE YENİLEME TARİHİ DOLU">
        <Kart
          baslik="Yenileme"
          eylem={<span className="text-sm text-navy-500 underline">Düzenle</span>}
        >
          <dl className="space-y-3">
            <Bilgi etiket="Sözleşme bitişi" deger="31.03.2027" />
            <Bilgi etiket="Yenileme görüşmesi" deger="15.09.2026" />
            <Bilgi etiket="Yenileme tarihi (yeni dönem)" deger="01.04.2027" />
            <Bilgi etiket="Hatırlatma" deger="Açık" />
          </dl>
          <div className="mt-3">
            <Rozet ton="warning">Yenileme görüşmesine 47 gün</Rozet>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Rozet <strong className="text-ink-600">görüşme</strong> tarihine göre
            sayar. Sözleşme 31.03.2027’de biter, yeni dönem 01.04.2027’de başlar.
          </p>
        </Kart>
      </Durum>

      <Durum label="2 · YALNIZ YENİLEME TARİHİ VAR">
        <Kart
          baslik="Yenileme"
          eylem={<span className="text-sm text-navy-500 underline">Düzenle</span>}
        >
          <dl className="space-y-3">
            <Bilgi etiket="Sözleşme bitişi" deger="30.09.2026" />
            <Bilgi etiket="Yenileme görüşmesi" />
            <Bilgi etiket="Yenileme tarihi (yeni dönem)" deger="01.10.2026" />
            <Bilgi etiket="Hatırlatma" deger="Kapalı" />
          </dl>
          <div className="mt-3">
            <Rozet ton="warning">Yenilemeye 63 gün</Rozet>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Görüşme tarihi girilmediği için rozet doğrudan{" "}
            <strong className="text-ink-600">yenileme</strong> tarihine sayar. Görüşme
            tarihi eklerseniz hatırlatma daha erken çıkar.
          </p>
        </Kart>
      </Durum>

      <Durum label="3 · YENİLEME PLANLANMAMIŞ">
        <Kart
          baslik="Yenileme"
          eylem={<span className="text-sm text-navy-500 underline">Düzenle</span>}
        >
          <dl className="space-y-3">
            <Bilgi etiket="Sözleşme bitişi" deger="31.12.2026" />
            <Bilgi etiket="Yenileme görüşmesi" />
            <Bilgi etiket="Yenileme tarihi (yeni dönem)" />
            <Bilgi etiket="Hatırlatma" deger="Kapalı" />
          </dl>
          <p className="mt-3 rounded-sm bg-fill-100 px-3 py-2 text-[13px] text-ink-600">
            Bu sözleşme için yenileme planlanmamış. Bitiş yaklaştığında uyarı
            almak isterseniz bir görüşme tarihi ekleyin.
          </p>
        </Kart>
      </Durum>

      <Durum label="4 · GEÇERSİZ TARİH — DÜZENLEME MODU">
        <Kart baslik="Yenileme">
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-sm text-ink-600">Yenileme görüşmesi tarihi</div>
              <div className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-900">
                15.09.2026
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-ink-600">
                Yenileme tarihi (yeni dönem başlangıcı)
              </div>
              <div className="flex h-9 items-center rounded-sm border border-danger bg-surface px-3 text-sm text-ink-900">
                01.01.2027
              </div>
              <p className="mt-1 text-xs text-danger">
                Yenileme tarihi, sözleşmenin bitişinden (31.03.2027) önce olamaz.
              </p>
            </div>
            <label className="flex items-start gap-2 text-[13px] text-ink-400">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-line-300 bg-fill-100" />
              Otomatik yenileme bayrağı — yenileme tarihi geçerli olmadan
              işaretlenemez
            </label>
          </div>
        </Kart>
      </Durum>
    </Tuval>
  );
}
