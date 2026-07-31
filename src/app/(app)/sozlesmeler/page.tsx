import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/authz";
import { markalariListele } from "@/lib/brand-admin";
import {
  finansGorebilirMi,
  SAYFA_BOYUTU,
  sozlesmeleriSayfali,
  sozlesmeModulunuGorebilirMi,
  sozlesmeYonetebilirMi,
} from "@/lib/contract-admin";
import {
  DURUM_ETIKET,
  DURUM_TON,
  SIKLIK_ETIKET,
  TEMEL_ETIKET,
  tarihYaz,
  tutarYaz,
  yenilemeRozeti,
  type FaturalamaSikligi,
  type SozlesmeDurumu,
  type TutarTemeli,
} from "./etiketler";
import { SozlesmeFiltreleri } from "./sozlesme-filtreleri";

/**
 * Sözleşme listesi.
 *
 * ⚠ Kapsam ve alan süzgeci SORGUDA uygulanır (`sozlesmeleriSayfali`): OPS'un
 * atanmadığı markanın sözleşmesi bu sayfanın HTML'ine hiç girmez ve finansal
 * alanlar OPS için hiç SELECT edilmez. Burada yalnız gelen veri gösterilir —
 * ekran bir süzgeç değildir.
 *
 * ⚠ BU ROTAYA `loading.tsx` EKLENMEZ. Yükleme iskeleti akışı (streaming)
 * başlatır; yanıt 200 ile açılır ve sayfa içinde çağrılan `notFound()` artık
 * 404 DURUM KODU üretemez. MEM'in 404 alması durum koduna da bağlıdır ve
 * `verify:contracts` bunu sınar.
 *
 * Mobilde tablo yerine kart: 375 px'te sekiz sütun ya yatay kayar ya sütun
 * gizler. Kartın TAMAMI tek bir <a>'dır.
 */
export const dynamic = "force-dynamic";

export default async function SozlesmelerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!sozlesmeModulunuGorebilirMi(user.role)) notFound();

  const sp = await searchParams;
  const tek = (ad: string) => {
    const d = sp[ad];
    return typeof d === "string" && d.trim() ? d.trim() : undefined;
  };

  const filtre = {
    q: tek("q"),
    status: tek("durum"),
    brandId: tek("marka"),
    expiringWithin: tek("yenileme") ? Number(tek("yenileme")) : undefined,
  };
  const sayfa = Number(tek("sayfa") ?? "1");

  const { kayitlar, toplam, sayfa: aktifSayfa, sayfaSayisi } = await sozlesmeleriSayfali(
    user,
    filtre,
    Number.isFinite(sayfa) ? sayfa : 1,
  );
  /** Filtre açılırı KAPSAM İÇİNDEKİ markalarla dolar — görmediği marka sızmaz. */
  const markalar = (await markalariListele(user)).map((m) => ({
    id: String(m.id),
    name: String(m.name),
  }));

  const olusturabilir = sozlesmeYonetebilirMi(user.role);
  const finans = finansGorebilirMi(user.role);
  const filtreVar = Boolean(
    filtre.q || filtre.status || filtre.brandId || filtre.expiringWithin,
  );

  const csvParams = new URLSearchParams();
  if (filtre.q) csvParams.set("q", filtre.q);
  if (filtre.status) csvParams.set("status", filtre.status);
  if (filtre.brandId) csvParams.set("brandId", filtre.brandId);
  if (filtre.expiringWithin) csvParams.set("expiringWithin", String(filtre.expiringWithin));
  const csvHref = `/api/v1/contracts/export${csvParams.toString() ? `?${csvParams}` : ""}`;

  const sayfaHref = (n: number) => {
    const p = new URLSearchParams();
    if (filtre.q) p.set("q", filtre.q);
    if (filtre.status) p.set("durum", filtre.status);
    if (filtre.brandId) p.set("marka", filtre.brandId);
    if (filtre.expiringWithin) p.set("yenileme", String(filtre.expiringWithin));
    if (n > 1) p.set("sayfa", String(n));
    return `/sozlesmeler${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Sözleşmeler</h1>
          <div className="mt-1 h-0.5 w-10 bg-gold-500" />
          <p className="mt-2 text-sm text-ink-400">
            {user.role === "operations"
              ? "Atandığınız markaların sözleşmeleri."
              : "Marka sözleşmeleri, kapsamları ve yürürlük durumları."}
          </p>
        </div>
        {olusturabilir && (
          <div className="flex flex-wrap gap-2">
            <Link href="/sozlesmeler/yeni">
              <Button variant="primary">Yeni sözleşme</Button>
            </Link>
          </div>
        )}
      </div>

      <SozlesmeFiltreleri markalar={markalar} />

      {kayitlar.length === 0 ? (
        <div className="rounded-md border border-line-200 bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-900">
            {filtreVar ? "Bu filtrelerle eşleşen sözleşme yok." : "Henüz sözleşme yok."}
          </p>
          <p className="mx-auto mt-1 max-w-[52ch] text-sm text-ink-400">
            {filtreVar
              ? "Arama sözcüğünü kısaltmayı ya da durum ve marka filtrelerini gevşetmeyi deneyin."
              : user.role === "operations"
                ? "Atandığınız markalarda henüz sözleşme yok."
                : "Bir markayla anlaştığınızda sözleşmeyi buradan oluşturursunuz. Sözleşme önce taslak olarak kaydedilir; hazır olduğunda yürürlüğe alırsınız."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filtreVar ? (
              <Link href="/sozlesmeler">
                <Button>Filtreleri temizle</Button>
              </Link>
            ) : (
              olusturabilir && (
                <Link href="/sozlesmeler/yeni">
                  <Button variant="primary">Yeni sözleşme</Button>
                </Link>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Mobil: kart listesi (lg altında) ── */}
          <ul className="space-y-3 lg:hidden">
            {kayitlar.map((s) => {
              const k = s as Record<string, unknown>;
              const durum = k.status as SozlesmeDurumu;
              const rozet = yenilemeRozeti(k.renewalReviewDate, k.renewalDate);
              return (
                <li key={String(k.id)}>
                  <Link
                    href={`/sozlesmeler/${String(k.id)}`}
                    className="block rounded-md border border-line-200 bg-surface p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-ink-400">
                          {String(k.contractNo)}
                        </div>
                        <div className="mt-0.5 truncate text-[15px] font-medium text-ink-900">
                          {String(k.title)}
                        </div>
                        <div className="truncate text-xs text-ink-400">
                          {String(k.brandName ?? "—")}
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
                        <dt className="text-xs text-ink-400">Dönem</dt>
                        <dd className="text-ink-600">
                          {tarihYaz(k.startDate)} – {tarihYaz(k.endDate)}
                        </dd>
                      </div>
                      {/* ⚠ Finansal blok OPS'a HİÇ render edilmez */}
                      {finans && (
                        <>
                          <div>
                            <dt className="text-xs text-ink-400">Faturalama</dt>
                            <dd className="text-ink-600">
                              {SIKLIK_ETIKET[k.billingFrequency as FaturalamaSikligi]}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-ink-400">Net tutar</dt>
                            <dd className="tabular-nums text-ink-900">
                              {tutarYaz(k.amountMinor, k.currencyCode)}
                            </dd>
                            <dd className="text-xs text-ink-400">
                              {TEMEL_ETIKET[k.amountBasis as TutarTemeli]}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>

                    {rozet && (
                      <div className="mt-3">
                        <Badge variant="warning">{rozet.metin}</Badge>
                      </div>
                    )}
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
                  <th className="whitespace-nowrap px-4 py-3 font-medium">NUMARA</th>
                  <th className="px-4 py-3 font-medium">MARKA</th>
                  <th className="px-4 py-3 font-medium">BAŞLIK</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">DÖNEM</th>
                  {finans && (
                    <>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">FATURALAMA</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        NET TUTAR
                        <div className="font-normal tracking-normal">ve temeli</div>
                      </th>
                    </>
                  )}
                  <th className="px-4 py-3 font-medium">DURUM</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {kayitlar.map((s) => {
                  const k = s as Record<string, unknown>;
                  const durum = k.status as SozlesmeDurumu;
                  const rozet = yenilemeRozeti(k.renewalReviewDate, k.renewalDate);
                  return (
                    <tr key={String(k.id)} className="border-b border-line-200 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-600">
                        {String(k.contractNo)}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{String(k.brandName ?? "—")}</td>
                      <td className="px-4 py-3 text-ink-900">
                        <div className="flex flex-wrap items-center gap-2">
                          {String(k.title)}
                          {rozet && <Badge variant="warning">{rozet.metin}</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-600">
                        {tarihYaz(k.startDate)} – {tarihYaz(k.endDate)}
                      </td>
                      {finans && (
                        <>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                            {SIKLIK_ETIKET[k.billingFrequency as FaturalamaSikligi]}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-ink-900">
                            <div className="tabular-nums">
                              {tutarYaz(k.amountMinor, k.currencyCode)}
                            </div>
                            <div className="text-xs text-ink-400">
                              {TEMEL_ETIKET[k.amountBasis as TutarTemeli]}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <Badge variant={DURUM_TON[durum]}>{DURUM_ETIKET[durum]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/sozlesmeler/${String(k.id)}`}>
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
          {toplam} sözleşme
          {filtreVar ? " · filtre uygulandı" : " · filtre uygulanmadı"}
          {toplam > SAYFA_BOYUTU ? ` · sayfa başına ${SAYFA_BOYUTU}` : ""}
        </span>
        <span className="flex items-center gap-3">
          <a href={csvHref} className="text-navy-500 underline max-sm:min-h-11 max-sm:inline-flex max-sm:items-center">
            CSV indir
          </a>
          <span>
            Sayfa {aktifSayfa} / {sayfaSayisi}
          </span>
        </span>
      </div>

      {sayfaSayisi > 1 && (
        <div className="mt-3 flex justify-end gap-2">
          {aktifSayfa > 1 && (
            <Link href={sayfaHref(aktifSayfa - 1)}>
              <Button>Önceki</Button>
            </Link>
          )}
          {aktifSayfa < sayfaSayisi && (
            <Link href={sayfaHref(aktifSayfa + 1)}>
              <Button>Sonraki</Button>
            </Link>
          )}
        </div>
      )}
    </PageShell>
  );
}
