import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/authz";
import { hizmetleriListele, markaHizmetleri } from "@/lib/brand-admin";
import {
  brutHesapla,
  finansGorebilirMi,
  kalemleriListele,
  kalemToplami,
  sozlesmeDetayi,
  sozlesmeModulunuGorebilirMi,
  sozlesmeYonetebilirMi,
  toplamOzeti,
} from "@/lib/contract-admin";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  DURUM_ETIKET,
  DURUM_TON,
  SIKLIK_ETIKET,
  TEMEL_ETIKET,
  tarihYaz,
  tutarYaz,
  type FaturalamaSikligi,
  type SozlesmeDurumu,
  type TutarTemeli,
} from "../etiketler";
import { OdemePlani } from "./odeme-plani";
import { SozlesmeIslemler } from "./sozlesme-islemler";
import { SozlesmeKalemler, type Kalem, type KatalogHizmeti } from "./sozlesme-kalemler";
import { SozlesmeYenileme } from "./sozlesme-yenileme";

/**
 * Sözleşme detayı — tek sayfa, sekme yok.
 *
 * ⚠ KİLİTLİ ALANLAR FORM GİBİ GÖRÜNMEZ. Aktif sözleşmede tutar, tarih,
 * faturalama ve kalemler DÜZ METİNDİR; çerçeveli kutu ya da "Düzenle"
 * bağlantısı yoktur. Düzenlenebilen az sayıdaki alan (yenileme, notlar) KENDİ
 * kartındadır ve yalnız orada "Düzenle" çıkar — kilit sınırı görünür olsun.
 *
 * ⚠ OPS için finansal alanlar SORGUYA HİÇ GİRMEZ (`contract-admin` §5a); bu
 * sayfa da `finans` bayrağı ile o blokları hiç render etmez. İki katman:
 * veri yok + işaretleme yok.
 *
 * ⚠ `loading.tsx` EKLENMEZ: streaming yanıtı 200 ile açar ve `notFound()`
 * 404 durum kodunu üretemez.
 */
export const dynamic = "force-dynamic";

export default async function SozlesmeDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!sozlesmeModulunuGorebilirMi(user.role)) notFound();

  const { id } = await params;
  const kayit = await sozlesmeDetayi(user, id);
  if (!kayit) notFound();

  const s = kayit as Record<string, unknown>;
  const durum = s.status as SozlesmeDurumu;
  const finans = finansGorebilirMi(user.role);
  const yonetebilir = sozlesmeYonetebilirMi(user.role);
  const taslak = durum === "draft";
  const paraBirimi = String(s.currencyCode ?? "TRY");

  const kalemler = (await kalemleriListele(id, user.role)) as unknown as Kalem[];

  const [markaSatir, katalogHam, markaninHizmetleri] = await Promise.all([
    db
      .select({ name: brands.name, status: brands.status })
      .from(brands)
      .where(eq(brands.id, String(s.brandId)))
      .limit(1),
    hizmetleriListele(user.role),
    markaHizmetleri(String(s.brandId), user.role),
  ]);

  const markaAdi = String(s.brandName ?? markaSatir[0]?.name ?? "—");
  const markaDurumu = String(markaSatir[0]?.status ?? "");

  const markadakiIdler = new Set(
    (markaninHizmetleri as { serviceId?: unknown }[]).map((h) => String(h.serviceId)),
  );
  const katalog: KatalogHizmeti[] = (katalogHam as Record<string, unknown>[]).map((k) => ({
    id: String(k.id),
    code: String(k.code),
    name: String(k.name),
    isActive: Boolean(k.isActive),
    markada: markadakiIdler.has(String(k.id)),
  }));

  /**
   * Aktivasyonda markanın hizmet listesine EKLENECEK olanlar.
   *
   * Onay penceresi bunu kalem kalem sayar; "bir şeyler değişecek" demek
   * kullanıcının neyi onayladığını anlamasına yetmiyor.
   */
  const baglanacakHizmetler = [
    ...new Set(
      kalemler
        .filter((k) => k.serviceId && !markadakiIdler.has(k.serviceId))
        .map((k) => katalog.find((x) => x.id === k.serviceId))
        .filter((x): x is KatalogHizmeti => Boolean(x) && x!.isActive)
        .map((x) => x.name),
    ),
  ];

  /** Toplam özeti YALNIZ finans görebilen roller için hesaplanır. */
  const toplamlar = finans
    ? toplamOzeti(
        await kalemToplami(id),
        Number(s.discountMinor ?? 0),
        Number(s.amountMinor ?? 0),
      )
    : null;

  const temelEtiket = finans
    ? `${TEMEL_ETIKET[s.amountBasis as TutarTemeli]} · ${tutarYaz(s.amountMinor, paraBirimi)}`
    : "";

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/sozlesmeler"
          className="max-sm:min-h-11 inline-flex items-center text-sm text-navy-500 underline"
        >
          ← Sözleşmeler
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">
          {String(s.title)}
        </h1>
        <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        <p className="mt-2 text-sm text-ink-400">{markaAdi}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          <div className="text-xs text-ink-400">Sözleşme numarası</div>
          {/* Salt okunur künye — input DEĞİL, değiştirilemez */}
          <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-sm bg-fill-100 px-2 py-1 font-mono text-sm text-ink-900">
            {String(s.contractNo)}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-ink-400"
              aria-hidden="true"
            >
              <rect x="4" y="11" width="16" height="9" rx="1.5" />
              <path d="M8 11V7.5a4 4 0 018 0V11" />
            </svg>
            <span className="sr-only">değiştirilemez</span>
          </div>
        </div>
        <Badge variant={DURUM_TON[durum]}>{DURUM_ETIKET[durum]}</Badge>
        {/* ⚠ `timestamptz` sürücüden Date olarak gelir; tarihYaz ikisini de alır */}
        {s.activatedAt != null && (
          <span className="text-xs text-ink-400">
            Yürürlüğe alındı: {tarihYaz(s.activatedAt)}
          </span>
        )}
        {s.endedAt != null && (
          <span className="text-xs text-ink-400">Sonlandırıldı: {tarihYaz(s.endedAt)}</span>
        )}
        {s.cancelledAt != null && (
          <span className="text-xs text-ink-400">İptal edildi: {tarihYaz(s.cancelledAt)}</span>
        )}
      </div>

      {yonetebilir && (
        <div className="mb-6">
          <SozlesmeIslemler
            contractId={id}
            contractNo={String(s.contractNo)}
            status={durum}
            markaAdi={markaAdi}
            markaDurumu={markaDurumu}
            baglanacakHizmetler={baglanacakHizmetler}
          />
        </div>
      )}

      {(durum === "ended" || durum === "cancelled") && (
        <p className="mb-6 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
          {durum === "ended" ? "Sonlandırma" : "İptal"} gerekçesi:{" "}
          {String(s.endReason ?? s.cancelReason ?? "—")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-md border border-line-200 bg-surface">
            <div className="border-b border-line-200 px-5 py-3">
              <h2 className="text-base font-semibold text-ink-900">Sözleşme bilgileri</h2>
            </div>
            <div className="p-5">
              {/* Salt okunur: düz metin, kutu yok — kilitli alanlar form gibi görünmez */}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-400">Marka</dt>
                  <dd className="mt-0.5 text-sm text-ink-900">{markaAdi}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">Başlangıç</dt>
                  <dd className="mt-0.5 text-sm text-ink-900">{tarihYaz(s.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">Bitiş</dt>
                  <dd className="mt-0.5 text-sm text-ink-900">{tarihYaz(s.endDate)}</dd>
                </div>
                {finans && (
                  <div>
                    <dt className="text-xs text-ink-400">Ödeme yöntemi</dt>
                    <dd className="mt-0.5 text-sm text-ink-900">
                      {String(s.paymentMethod ?? "—")}
                    </dd>
                  </div>
                )}
              </dl>
              {!taslak && (
                <p className="mt-4 text-xs text-ink-400">
                  <Badge variant="muted">Kilitli</Badge> Yürürlükteki sözleşmede tutar,
                  tarih ve faturalama bilgileri değiştirilemez.
                </p>
              )}
            </div>
          </section>

          {/* ⚠ Finansal kart OPS'a HİÇ render edilmez */}
          {finans && (
            <section className="rounded-md border border-line-200 bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-200 px-5 py-3">
                <h2 className="text-base font-semibold text-ink-900">Tutar ve KDV</h2>
                <Badge variant="info">
                  {s.amountBasis === "per_period" ? "Dönemlik tutar" : "Sözleşme toplamı"}
                </Badge>
              </div>
              <div className="p-5">
                <div className="max-w-[380px]">
                  <div className="pb-1 text-xs text-ink-400">
                    {s.amountBasis === "per_period"
                      ? "Her faturalama döneminde"
                      : "Sözleşme geneli"}
                  </div>
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-ink-600">Net tutar</span>
                    <span className="tabular-nums text-ink-900">
                      {tutarYaz(s.amountMinor, paraBirimi)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-ink-400">KDV (%{String(Number(s.vatRate))})</span>
                    <span className="tabular-nums text-ink-600">
                      {tutarYaz(
                        brutHesapla(Number(s.amountMinor), Number(s.vatRate)) -
                          Number(s.amountMinor),
                        paraBirimi,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-line-200 pt-2 text-sm">
                    <span className="font-medium text-ink-900">Brüt tutar</span>
                    <span className="font-semibold tabular-nums text-ink-900">
                      {tutarYaz(brutHesapla(Number(s.amountMinor), Number(s.vatRate)), paraBirimi)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-ink-400">
                  {paraBirimi === "TRY"
                    ? "Türk lirası sözleşme · kur 1,0000"
                    : `${paraBirimi} sözleşme · kur ${String(s.fxRate)}`}
                </p>
              </div>
            </section>
          )}

          <SozlesmeKalemler
            contractId={id}
            kalemler={kalemler}
            katalog={katalog}
            duzenlenebilir={yonetebilir && taslak}
            finans={finans}
            paraBirimi={paraBirimi}
            toplamlar={toplamlar}
          />

          {finans && <OdemePlani contractId={id} temelEtiket={temelEtiket} />}
        </div>

        <div className="space-y-4">
          {finans && (
            <section className="rounded-md border border-line-200 bg-surface">
              <div className="border-b border-line-200 px-5 py-3">
                <h2 className="text-base font-semibold text-ink-900">Faturalama</h2>
              </div>
              <div className="p-5">
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs text-ink-400">Sıklık</dt>
                    <dd className="mt-0.5 text-sm text-ink-900">
                      {SIKLIK_ETIKET[s.billingFrequency as FaturalamaSikligi]}
                      {s.billingFrequency !== "one_time" &&
                        ` (her ${String(s.billingInterval)} dönemde bir)`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">İlk vade</dt>
                    <dd className="mt-0.5 text-sm text-ink-900">{tarihYaz(s.firstDueDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Taksit sayısı</dt>
                    <dd className="mt-0.5 text-sm text-ink-900">
                      {s.installmentCount == null
                        ? s.endDate
                          ? "Bitiş tarihine kadar"
                          : "Belirtilmemiş"
                        : String(s.installmentCount)}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          )}

          <SozlesmeYenileme
            contractId={id}
            endDate={s.endDate == null ? null : String(s.endDate)}
            renewalDate={s.renewalDate == null ? null : String(s.renewalDate)}
            renewalReviewDate={
              s.renewalReviewDate == null ? null : String(s.renewalReviewDate)
            }
            autoRenew={Boolean(s.autoRenew)}
            duzenlenebilir={yonetebilir && durum !== "ended" && durum !== "cancelled"}
          />

          <section className="rounded-md border border-line-200 bg-surface">
            <div className="border-b border-line-200 px-5 py-3">
              <h2 className="text-base font-semibold text-ink-900">Notlar</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-ink-600">{String(s.notes ?? "Henüz not yok.")}</p>
            </div>
          </section>

          {!finans && (
            <p className="rounded-sm bg-fill-100 px-3 py-2.5 text-xs text-ink-400">
              Sözleşmelerin finansal bilgileri rolünüz kapsamında değildir ve bu ekranda
              yer almaz.
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
