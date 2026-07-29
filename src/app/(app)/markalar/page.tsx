import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/authz";
import {
  kapsamdakiSektorler,
  markalariSayfali,
  markaModulunuGorebilirMi,
  markaYonetebilirMi,
  SAYFA_BOYUTU,
} from "@/lib/brand-admin";
import { DURUM_ETIKET, DURUM_TON, type MarkaDurumu } from "./etiketler";
import { MarkaFiltreleri } from "./marka-filtreleri";

/**
 * Marka listesi.
 *
 * ⚠ Kapsam ve alan süzgeci SORGUDA uygulanır (`markalariSayfali`): OPS'un
 * atanmadığı marka bu sayfanın HTML'ine hiç girmez ve vergi alanları OPS
 * yanıtında hiç bulunmaz. Burada yalnız gelen veri gösterilir.
 *
 * ⚠ BU ROTAYA `loading.tsx` EKLENMEZ. Yükleme iskeleti akışı (streaming)
 * başlatır; yanıt 200 ile açılır ve sayfa içinde çağrılan `notFound()` artık
 * 404 DURUM KODU üretemez — gövde 404 gösterse de durum kodu 200 kalır.
 * Kapsam dışı bir markanın "yok" görünmesi durum koduna da bağlıdır ve
 * `verify:brands` bunu sınar. Bekleme geri bildirimi form ve düğme
 * durumlarıyla verilir.
 *
 * Mobilde tablo yerine kart: 375 px'te sekiz sütun ya yatay kayar ya sütun
 * gizler; ikisi de bilgi kaybı. Kartın TAMAMI tek bir <a>'dır — chevron ile
 * ayrı bir "Detay" bağlantısı aynı işi iki kez yapardı.
 */
export const dynamic = "force-dynamic";

export default async function MarkalarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!markaModulunuGorebilirMi(user.role)) notFound();

  const sp = await searchParams;
  const tek = (ad: string) => {
    const d = sp[ad];
    return typeof d === "string" && d.trim() ? d.trim() : undefined;
  };

  const filtre = { q: tek("q"), status: tek("durum"), industry: tek("sektor") };
  const sayfa = Number(tek("sayfa") ?? "1");
  const { kayitlar, toplam, sayfa: aktifSayfa, sayfaSayisi } = await markalariSayfali(
    user,
    filtre,
    Number.isFinite(sayfa) ? sayfa : 1,
  );
  const sektorler = await kapsamdakiSektorler(user);
  const olusturabilir = markaYonetebilirMi(user.role);
  const filtreVar = Boolean(filtre.q || filtre.status || filtre.industry);

  /** CSV bağlantısı listeyle AYNI parametreleri taşır: dosya ekranda görünendir. */
  const csvParams = new URLSearchParams();
  if (filtre.q) csvParams.set("q", filtre.q);
  if (filtre.status) csvParams.set("status", filtre.status);
  if (filtre.industry) csvParams.set("industry", filtre.industry);
  const csvHref = `/api/v1/brands/export${csvParams.toString() ? `?${csvParams}` : ""}`;

  const sayfaHref = (n: number) => {
    const p = new URLSearchParams();
    if (filtre.q) p.set("q", filtre.q);
    if (filtre.status) p.set("durum", filtre.status);
    if (filtre.industry) p.set("sektor", filtre.industry);
    if (n > 1) p.set("sayfa", String(n));
    return `/markalar${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Markalar</h1>
          <div className="mt-1 h-0.5 w-10 bg-gold-500" />
          <p className="mt-2 text-sm text-ink-400">
            {user.role === "operations"
              ? "Size atanan markalar, yetkilileri ve aldıkları hizmetler."
              : "Müşteri markaları, yetkilileri ve aldıkları hizmetler."}
          </p>
        </div>
        {olusturabilir && (
          <div className="flex flex-wrap gap-2">
            <Link href="/markalar/yeni">
              <Button variant="primary">Yeni marka</Button>
            </Link>
          </div>
        )}
      </div>

      <MarkaFiltreleri sektorler={sektorler} />

      {kayitlar.length === 0 ? (
        <div className="rounded-md border border-line-200 bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-900">
            {filtreVar ? "Bu filtreyle eşleşen marka yok." : "Henüz marka yok."}
          </p>
          <p className="mt-1 text-sm text-ink-400">
            {filtreVar
              ? "Arama terimini kısaltmayı veya filtreleri temizlemeyi deneyin."
              : user.role === "operations"
                ? "Size henüz bir marka atanmamış. Atama yapıldığında burada görünür."
                : "İlk markayı ekleyerek başlayın."}
          </p>
          {!filtreVar && olusturabilir && (
            <Link href="/markalar/yeni" className="mt-4 inline-block">
              <Button variant="primary">Yeni marka</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ── Mobil: kart listesi (lg altında) ── */}
          <ul className="space-y-3 lg:hidden">
            {kayitlar.map((m) => {
              const durum = m.status as MarkaDurumu;
              return (
                <li key={String(m.id)}>
                  <Link
                    href={`/markalar/${String(m.id)}`}
                    className="block rounded-md border border-line-200 bg-surface p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-ink-400">{String(m.code)}</div>
                        <div className="mt-0.5 truncate text-[15px] font-medium text-ink-900">
                          {String(m.name)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={DURUM_TON[durum]}>{DURUM_ETIKET[durum]}</Badge>
                        <span aria-hidden className="text-lg leading-none text-ink-400">
                          ›
                        </span>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="col-span-2">
                        <dt className="text-xs text-ink-400">Sektör</dt>
                        <dd className="text-ink-600">{String(m.industry ?? "—")}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-ink-400">Birincil yetkili</dt>
                        <dd className="text-ink-600">{String(m.birincilYetkili ?? "—")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-400">Hizmet</dt>
                        <dd className="tabular-nums text-ink-600">{String(m.hizmetSayisi)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-400">Atanan ekip</dt>
                        <dd className="tabular-nums text-ink-600">{String(m.ekipSayisi)}</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* ── Masaüstü: tablo ── */}
          <div className="hidden rounded-md border border-line-200 bg-surface lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-medium">KOD</th>
                  <th className="px-4 py-3 font-medium">MARKA</th>
                  <th className="px-4 py-3 font-medium">SEKTÖR</th>
                  <th className="px-4 py-3 font-medium">BİRİNCİL YETKİLİ</th>
                  <th className="px-4 py-3 text-right font-medium">HİZMET</th>
                  <th className="px-4 py-3 text-right font-medium">EKİP</th>
                  <th className="px-4 py-3 font-medium">DURUM</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {kayitlar.map((m) => {
                  const durum = m.status as MarkaDurumu;
                  return (
                    <tr key={String(m.id)} className="border-b border-line-200 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-ink-600">{String(m.code)}</td>
                      <td className="px-4 py-3 text-ink-900">{String(m.name)}</td>
                      <td className="px-4 py-3 text-ink-600">{String(m.industry ?? "—")}</td>
                      <td className="px-4 py-3 text-ink-600">
                        {String(m.birincilYetkili ?? "—")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-600">
                        {String(m.hizmetSayisi)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-600">
                        {String(m.ekipSayisi)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={DURUM_TON[durum]}>{DURUM_ETIKET[durum]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/markalar/${String(m.id)}`}>
                          <Button size="table">Detay</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-400">
        <span>
          {toplam} marka{filtreVar ? " · filtre uygulandı" : ""}
          {toplam > SAYFA_BOYUTU ? ` · sayfa ${aktifSayfa} / ${sayfaSayisi}` : ""}
        </span>
        <div className="flex items-center gap-2">
          {sayfaSayisi > 1 && (
            <nav aria-label="Sayfalama" className="flex items-center gap-2">
              {aktifSayfa > 1 && (
                <Link href={sayfaHref(aktifSayfa - 1)}>
                  <Button size="table">Önceki</Button>
                </Link>
              )}
              {aktifSayfa < sayfaSayisi && (
                <Link href={sayfaHref(aktifSayfa + 1)}>
                  <Button size="table">Sonraki</Button>
                </Link>
              )}
            </nav>
          )}
          {kayitlar.length > 0 && (
            <a href={csvHref} download>
              <Button size="table">CSV indir</Button>
            </a>
          )}
        </div>
      </div>
    </PageShell>
  );
}
