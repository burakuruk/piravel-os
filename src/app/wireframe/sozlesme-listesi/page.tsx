/**
 * SÖZLEŞME LİSTESİ — wireframe (Sprint 3 §11.1–2)
 *
 * Tartışmaya açılan kararlar:
 *   · Arama tek kutuda: sözleşme NUMARASI ve BAŞLIK üzerinde çalışır
 *   · Filtreler satır içinde (durum, marka, yenilemesi yaklaşanlar) — marka
 *     listesiyle aynı desen; ayrı bir filtre paneli açılmaz
 *   · Numara ilk sütun ve monospace: kullanıcı sözleşmeyi numarayla arar
 *   · Tutar sütunu NET tutardır ve sağa yaslıdır; brüt yalnız detayda çıkar —
 *     listede iki tutar yan yana durunca hangisinin konuşulduğu belirsizleşiyor
 *   · "Yenilemeye N gün" rozeti yalnız 60 günün altına düşünce görünür
 *   · MOBİLDE tablo değil KART düzeni (marka listesiyle aynı gerekçe):
 *     375 px'te yedi sütun ya yatay kayar ya sütun gizler
 *   · Kartın tamamı tek bir <a> — klavye ve ekran okuyucu için gerçek bağlantı
 */
import { AppWire, Dugme, Rozet } from "../_app-shell";
import { SAHTE_SOZLESMELER, TemelEtiketi } from "../_sozlesme";

/** Rozet metni hangi tarihe dayanıyorsa ona göre yazılır (REVİZE 3). */
function yenilemeMetni(tur: string | null, gun: number) {
  return tur === "gorusme" ? `Yenileme görüşmesine ${gun} gün` : `Yenilemeye ${gun} gün`;
}

export default function SozlesmeListesiWireframe() {
  return (
    <AppWire
      baslik="Sözleşmeler"
      aciklama="Marka sözleşmeleri, kapsamları ve yürürlük durumları."
      aktif="Sözleşmeler"
      ustEylem={<Dugme tur="birincil">Yeni sözleşme</Dugme>}
    >
      {/* Arama + filtreler + dışa aktarma */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-9 min-w-[240px] flex-1 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-400">
          Sözleşme numarası veya başlıkta ara…
        </span>
        <span className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-600">
          Durum: Tümü ▾
        </span>
        <span className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-600">
          Marka: Tümü ▾
        </span>
        <span className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-600">
          Yenileme: Tümü ▾
        </span>
        <Dugme>CSV indir</Dugme>
      </div>

      {/* ── Mobil: kart listesi (lg altında) ── */}
      <div className="space-y-3 lg:hidden">
        {SAHTE_SOZLESMELER.map((s) => (
          <a
            key={s.no}
            href={`/sozlesmeler/${s.no}`}
            className="block rounded-md border border-line-200 bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-ink-400">{s.no}</div>
                <div className="mt-0.5 truncate text-[15px] font-medium text-ink-900">
                  {s.baslik}
                </div>
                <div className="truncate text-xs text-ink-400">{s.marka}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Rozet ton={s.ton}>{s.durum}</Rozet>
                <span className="text-lg leading-none text-ink-400">›</span>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="col-span-2">
                <dt className="text-xs text-ink-400">Dönem</dt>
                <dd className="text-ink-600">
                  {s.baslangic} – {s.bitis}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Faturalama</dt>
                <dd className="text-ink-600">{s.siklik}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Net tutar</dt>
                <dd className="tabular-nums text-ink-900">{s.tutar}</dd>
                <dd>
                  <TemelEtiketi temel={s.temel} />
                </dd>
              </div>
            </dl>

            {s.kalanGun !== null && (
              <div className="mt-3">
                <Rozet ton="warning">{yenilemeMetni(s.kalanTur, s.kalanGun)}</Rozet>
              </div>
            )}
          </a>
        ))}
      </div>

      {/* ── Masaüstü: tablo (lg ve üstü) ── */}
      <div className="hidden rounded-md border border-line-200 bg-surface lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
              <th className="whitespace-nowrap px-4 py-3 font-medium">NUMARA</th>
              <th className="px-4 py-3 font-medium">MARKA</th>
              <th className="px-4 py-3 font-medium">BAŞLIK</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">DÖNEM</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">FATURALAMA</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                NET TUTAR
                <div className="font-normal normal-case tracking-normal">ve temeli</div>
              </th>
              <th className="px-4 py-3 font-medium">DURUM</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {SAHTE_SOZLESMELER.map((s) => (
              <tr key={s.no} className="border-b border-line-200 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-600">
                  {s.no}
                </td>
                <td className="px-4 py-3 text-ink-600">{s.marka}</td>
                <td className="px-4 py-3 text-ink-900">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.baslik}
                    {s.kalanGun !== null && (
                      <Rozet ton="warning">{yenilemeMetni(s.kalanTur, s.kalanGun)}</Rozet>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-600">
                  {s.baslangic} – {s.bitis}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-600">{s.siklik}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-900">
                  <div className="tabular-nums">{s.tutar}</div>
                  <TemelEtiketi temel={s.temel} />
                </td>
                <td className="px-4 py-3">
                  <Rozet ton={s.ton}>{s.durum}</Rozet>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-navy-500 underline">Detay</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
        <span>5 sözleşme · filtre uygulanmadı</span>
        <span>Sayfa 1 / 1</span>
      </div>
    </AppWire>
  );
}
