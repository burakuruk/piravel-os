/**
 * ÖDEME PLANI ÖNİZLEMESİ — wireframe (Sprint 3 §11.10)
 *
 * Tartışmaya açılan kararlar:
 *   · “Bu önizleme kayıt oluşturmaz” ifadesi PANELİN EN ÜSTÜNDE ve okunur
 *     boyutta: kullanıcı 12 satırlık bir vade tablosu görünce doğal olarak
 *     "bunlar sisteme yazıldı mı" diye soruyor
 *   · Aynı ifade panelin ALTINDA da tekrarlanır: uzun listede üst şerit ekrandan
 *     çıkıyor
 *   · Panelde İNDİRME / KAYDETME düğmesi YOK: üretilmemiş bir plana eylem
 *     bağlamak onu kalıcı sanmaya davet eder
 *   · Ay sonu davranışı tablodan okunuyor (30.04, 30.06, 28.02) ve tek cümleyle
 *     de yazılıyor
 *   · MOBİLDE tablo değil kart listesi — dört kolon 375 px'te yatay kayıyordu
 *   · Sınıra dayanan plan için ayrı bir uyarı şeridi (aşağıdaki ikinci panel)
 */
import { Dugme, Kart, Rozet } from "../_app-shell";
import {
  PLAN_TOPLAM_BOLUNEN,
  PLAN_TOPLAM_KALANLI,
  PLAN_TUTAR,
  SAHTE_PLAN,
  SozlesmeNo,
  TOPLAM_BOLUNEN,
  TOPLAM_KALANLI,
} from "../_sozlesme";

/**
 * Taksit listesi — TOPLAM temelli planlar (REVİZE 4).
 *
 * Her satır "net taksit" olarak etiketlenir ve KDV varsa net/KDV/brüt üçlüsü
 * gösterilir: kullanıcı taksitin hangi rakam olduğunu ("bana kesilecek fatura
 * mı, net mi") tahmin etmek zorunda kalmamalı.
 *
 * Toplam satırı üç sütunda birden verilir — bölünmenin sözleşme tutarını
 * bozmadığı doğrudan okunabilsin.
 */
function TaksitListesi({
  satirlar,
  toplam,
}: {
  satirlar: readonly (readonly [string, string, string, string, string])[];
  toplam: { net: string; kdv: string; brut: string };
}) {
  return (
    <>
      {/* Mobil: taksit kartı */}
      <div className="space-y-2 sm:hidden">
        {satirlar.map(([sira, tarih, net, kdv, brut]) => (
          <div key={sira} className="rounded-sm border border-line-200 px-3 py-2.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm text-ink-900">{sira}. taksit</span>
              <span className="text-sm tabular-nums text-ink-600">{tarih}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-600">Net taksit</span>
              <span className="tabular-nums text-ink-900">{net}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-400">KDV (%20)</span>
              <span className="tabular-nums text-ink-600">{kdv}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-line-200 pt-1 text-sm">
              <span className="font-medium text-ink-900">Brüt</span>
              <span className="font-medium tabular-nums text-ink-900">{brut}</span>
            </div>
          </div>
        ))}
        <div className="rounded-sm bg-fill-100 px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-600">Taksitler toplamı (net)</span>
            <span className="tabular-nums text-ink-900">{toplam.net}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">KDV toplamı</span>
            <span className="tabular-nums text-ink-600">{toplam.kdv}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-line-300 pt-1">
            <span className="font-medium text-ink-900">Brüt toplam</span>
            <span className="font-semibold tabular-nums text-ink-900">{toplam.brut}</span>
          </div>
        </div>
      </div>

      {/* Masaüstü: tablo */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">VADE TARİHİ</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              NET TAKSİT
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">KDV (%20)</th>
            <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">BRÜT</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map(([sira, tarih, net, kdv, brut]) => (
            <tr key={sira} className="border-b border-line-200 last:border-0">
              <td className="py-2 pr-3 tabular-nums text-ink-400">{sira}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-900">{tarih}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-900">
                {net}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-600">
                {kdv}
              </td>
              <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums text-ink-900">
                {brut}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line-300">
            <td className="py-2.5 pr-3 font-medium text-ink-900" colSpan={2}>
              Taksitler toplamı
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-ink-900">
              {toplam.net}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-600">
              {toplam.kdv}
            </td>
            <td className="whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums text-ink-900">
              {toplam.brut}
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

/** Panelin başında ve sonunda tekrarlanan şerit. */
function KayitUretmezSeridi() {
  return (
    <p className="flex items-start gap-2 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5h.01" />
      </svg>
      <span>
        <strong>Bu önizleme kayıt oluşturmaz.</strong> Aşağıdaki vadeler yalnız
        hesaplanarak gösterilir; sisteme alacak veya fatura olarak yazılmaz.
      </span>
    </p>
  );
}

export default function OdemePlaniWireframe() {
  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[880px] space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            Ödeme planı önizlemesi
          </h1>
          <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        </div>

        <Kart
          baslik="Sosyal medya yönetimi 2026"
          eylem={<Rozet ton="success">Aktif</Rozet>}
        >
          <div className="mb-4">
            <KayitUretmezSeridi />
          </div>

          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
            <SozlesmeNo no="PRV-2026-0001" />
            <div>
              <div className="text-xs text-ink-400">Marka</div>
              <div className="mt-0.5 text-sm text-ink-900">Sahte Vize A.Ş.</div>
            </div>
            <div>
              <div className="text-xs text-ink-400">Sıklık</div>
              <div className="mt-0.5 text-sm text-ink-900">Aylık · her 1 dönemde bir</div>
            </div>
            <div>
              <div className="text-xs text-ink-400">İlk vade</div>
              <div className="mt-0.5 text-sm tabular-nums text-ink-900">30.04.2026</div>
            </div>
            <div>
              <div className="text-xs text-ink-400">Tutar temeli</div>
              <div className="mt-0.5 text-sm text-ink-900">
                Dönemlik net · 45.000,00 ₺
              </div>
            </div>
          </div>

          <p className="mb-3 text-[13px] text-ink-600">
            Dönemlik tutar her vadede tekrar eder; toplam, dönem sayısıyla çarpılarak
            oluşur.
          </p>

          {/* ── Mobil: kart listesi ── */}
          <div className="space-y-2 sm:hidden">
            {SAHTE_PLAN.map(([sira, tarih]) => (
              <div
                key={sira}
                className="flex items-center justify-between gap-3 rounded-sm border border-line-200 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-xs text-ink-400">{sira}. dönem</div>
                  <div className="text-sm tabular-nums text-ink-900">{tarih}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium tabular-nums text-ink-900">
                    {PLAN_TUTAR.brut}
                  </div>
                  <div className="text-xs tabular-nums text-ink-400">
                    net {PLAN_TUTAR.net}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Masaüstü: tablo ── */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">VADE TARİHİ</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">NET</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">KDV (%20)</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">BRÜT</th>
              </tr>
            </thead>
            <tbody>
              {SAHTE_PLAN.map(([sira, tarih]) => (
                <tr key={sira} className="border-b border-line-200 last:border-0">
                  <td className="py-2 pr-3 tabular-nums text-ink-400">{sira}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-900">{tarih}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-600">
                    {PLAN_TUTAR.net}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-600">
                    {PLAN_TUTAR.kdv}
                  </td>
                  <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums text-ink-900">
                    {PLAN_TUTAR.brut}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-300">
                <td className="py-2.5 pr-3 font-medium text-ink-900" colSpan={2}>
                  12 dönem toplamı
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-600">
                  540.000,00 ₺
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-600">
                  108.000,00 ₺
                </td>
                <td className="whitespace-nowrap py-2.5 pl-3 text-right font-semibold tabular-nums text-ink-900">
                  648.000,00 ₺
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-3 text-xs text-ink-400">
            Vade günü ayın 31’i seçildiği için 31’i olmayan aylarda ayın son günü
            kullanılır (30.04, 30.06, 30.09, 30.11, 28.02).
          </p>

          <div className="mt-4">
            <KayitUretmezSeridi />
          </div>

          <div className="mt-4 flex justify-end">
            <Dugme>Kapat</Dugme>
          </div>
        </Kart>

        {/* TOPLAM temelli: tutar taksitlere bölünür */}
        <Kart baslik="Web sitesi yenileme" eylem={<Rozet ton="muted">Taslak</Rozet>}>
          <div className="mb-4">
            <KayitUretmezSeridi />
          </div>

          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
            <SozlesmeNo no="PRV-2026-0005" />
            <div>
              <div className="text-xs text-ink-400">Sıklık</div>
              <div className="mt-0.5 text-sm text-ink-900">3 taksit</div>
            </div>
            <div>
              <div className="text-xs text-ink-400">Tutar temeli</div>
              <div className="mt-0.5 text-sm text-ink-900">
                Sözleşme toplamı · 60.000,00 ₺
              </div>
            </div>
          </div>

          <p className="mb-3 text-[13px] text-ink-600">
            Toplam tutar taksitlere bölünür; her vade toplamın bir parçasıdır. Net ve
            KDV ayrı ayrı bölünür.
          </p>

          <TaksitListesi satirlar={PLAN_TOPLAM_BOLUNEN} toplam={TOPLAM_BOLUNEN} />
        </Kart>

        {/* TOPLAM temelli, bölünmeyen tutar: kalan kuruş son taksitte */}
        <Kart
          baslik="Kurumsal kimlik yenileme"
          eylem={<Rozet ton="muted">Taslak</Rozet>}
        >
          <div className="mb-4">
            <KayitUretmezSeridi />
          </div>

          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
            <SozlesmeNo no="PRV-2026-0007" />
            <div>
              <div className="text-xs text-ink-400">Sıklık</div>
              <div className="mt-0.5 text-sm text-ink-900">3 taksit</div>
            </div>
            <div>
              <div className="text-xs text-ink-400">Tutar temeli</div>
              <div className="mt-0.5 text-sm text-ink-900">
                Sözleşme toplamı · 100.000,00 ₺
              </div>
            </div>
          </div>

          <TaksitListesi satirlar={PLAN_TOPLAM_KALANLI} toplam={TOPLAM_KALANLI} />

          <p className="mt-3 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
            Tutar taksitlere tam bölünmediği için artan{" "}
            <strong className="tabular-nums">0,01 ₺</strong> net ve{" "}
            <strong className="tabular-nums">0,02 ₺</strong> KDV son taksite eklendi.
            Net, KDV ve brüt toplamlarının üçü de sözleşme tutarlarına birebir eşittir.
          </p>
        </Kart>

        {/* DÖNEMLİK + sınırsız: liste kısaltılır (toplam temelinde bu durum olamaz) */}
        <Kart baslik="Aylık bakım" eylem={<Rozet ton="muted">Taslak</Rozet>}>
          <div className="mb-4">
            <KayitUretmezSeridi />
          </div>

          <div className="mb-3 flex flex-wrap gap-x-8 gap-y-3">
            <SozlesmeNo no="PRV-2026-0008" />
            <div>
              <div className="text-xs text-ink-400">Tutar temeli</div>
              <div className="mt-0.5 text-sm text-ink-900">
                Dönemlik net · 24.000,00 ₺
              </div>
            </div>
          </div>

          <p className="rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
            Bu sözleşmede bitiş tarihi ve taksit sayısı belirtilmemiş. Önizleme
            yalnız <strong>ilk 12 dönemi</strong> örnek olarak gösteriyor — sözleşmenin
            toplamı süresiz olduğu için tanımlı değildir.
          </p>

          <div className="mt-3 space-y-2 text-sm">
            {[
              ["1", "31.05.2026"],
              ["2", "30.06.2026"],
              ["3", "31.07.2026"],
            ].map(([s, t]) => (
              <div key={s} className="flex justify-between border-b border-line-200 pb-2">
                <span className="tabular-nums text-ink-900">
                  {s}. dönem · {t}
                </span>
                <span className="tabular-nums text-ink-600">24.000,00 ₺</span>
              </div>
            ))}
            <div className="pt-1 text-xs text-ink-400">… ve 9 dönem daha</div>
          </div>
        </Kart>

        {/* 120 satır sınırı aşıldı: liste KESİLMEZ, yapılandırma reddedilir */}
        <Kart baslik="Uzun vadeli bakım" eylem={<Rozet ton="muted">Taslak</Rozet>}>
          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
            <SozlesmeNo no="PRV-2026-0009" />
            <div>
              <div className="text-xs text-ink-400">Sıklık</div>
              <div className="mt-0.5 text-sm text-ink-900">Aylık · 144 taksit</div>
            </div>
            <div>
              <div className="text-xs text-ink-400">Tutar temeli</div>
              <div className="mt-0.5 text-sm text-ink-900">
                Sözleşme toplamı · 288.000,00 ₺
              </div>
            </div>
          </div>

          <p className="rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger">
            Bu yapılandırma <strong>144 vade</strong> üretiyor; üst sınır{" "}
            <strong>120</strong>. Ödeme planı kısaltılarak gösterilmez — taksit
            sayısını düşürün ya da bitiş tarihini öne çekin.
          </p>
          <p className="mt-2 text-xs text-ink-400">
            Liste kesilseydi ekrandaki toplam sözleşme tutarından küçük çıkar ve yanlış
            bir rakam konuşulurdu. Bu yüzden plan üretilmiyor.
          </p>
        </Kart>
      </div>
    </div>
  );
}
