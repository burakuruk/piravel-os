import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/authz";
import {
  atamalariListele,
  atamaYonetebilirMi,
  hizmetleriListele,
  markaDetayi,
  markaHizmetBagiYonetebilirMi,
  markaHizmetleri,
  markaModulunuGorebilirMi,
  sonDegisiklikler,
  yetkilileriListele,
} from "@/lib/brand-admin";
import { DURUM_ETIKET, DURUM_TON, type MarkaDurumu } from "../etiketler";
import { MarkaEkibi } from "./marka-ekibi";
import { MarkaHizmetleri } from "./marka-hizmetleri";
import { MarkaKimlik, type MarkaAlanlari } from "./marka-kimlik";
import { MarkaYetkilileri } from "./marka-yetkilileri";

/**
 * Marka detayı — tek sayfa, sekme yok.
 *
 * Sekmeler "bu markanın yetkilisi var mı" sorusunu bir tık uzağa düşürürdü.
 * Sözleşme, alacak ve tahsilat bölümleri bu sprintte GELİŞTİRİLMEDİ ve ekranda
 * hiç gösterilmez: olmayan bir şeyin yer tutucusu kullanıcıya "burada bir şey
 * eksik" hissi verir.
 *
 * ⚠ Kapsam sorguda uygulanır: OPS atanmadığı markanın detayını açamaz ve o
 * markanın hiçbir alanı bu sayfanın HTML'ine girmez.
 */
export const dynamic = "force-dynamic";

export default async function MarkaDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!markaModulunuGorebilirMi(user.role)) notFound();

  const { id } = await params;
  const marka = (await markaDetayi(user, id)) as MarkaAlanlari | null;
  if (!marka) notFound();

  const [yetkililer, hizmetler, atamalar, katalog, degisiklikler] = await Promise.all([
    yetkilileriListele(id),
    markaHizmetleri(id, user.role),
    atamalariListele(id),
    hizmetleriListele(user.role),
    sonDegisiklikler(id, 3),
  ]);

  const durum = marka.status as MarkaDurumu;
  const duzenleyebilir = user.role !== "member";
  const durumDegistirebilir = user.role === "super_admin" || user.role === "finance";
  const hizmetYonetebilir = markaHizmetBagiYonetebilirMi(user.role);
  const atamaYonetebilir = atamaYonetebilirMi(user.role);

  return (
    <PageShell>
      <div className="mb-6">
        <Link href="/markalar" className="text-sm text-navy-500 underline">
          ← Markalar
        </Link>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">{marka.name}</h1>
            <div className="mt-1 h-0.5 w-10 bg-gold-500" />
            <p className="mt-2 text-sm text-ink-400">
              <span className="font-mono">{marka.code}</span>
              {marka.industry ? ` · ${marka.industry}` : ""}
            </p>
          </div>
          <Badge variant={DURUM_TON[durum]}>{DURUM_ETIKET[durum]}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <MarkaKimlik
            marka={marka}
            duzenleyebilir={duzenleyebilir}
            durumDegistirebilir={durumDegistirebilir}
            sinirliDuzenleme={user.role === "operations"}
          />

          <MarkaYetkilileri
            brandId={id}
            yetkililer={yetkililer.map((y) => ({
              id: y.id,
              fullName: y.fullName,
              title: y.title,
              email: y.email,
              phone: y.phone,
              isPrimary: y.isPrimary,
            }))}
            ekleyebilir={duzenleyebilir}
            silebilir={durumDegistirebilir}
          />

          <MarkaHizmetleri
            brandId={id}
            hizmetler={hizmetler.map((h) => ({
              serviceId: String(h.serviceId),
              code: String(h.code),
              name: String(h.name),
              defaultUnit: String(h.defaultUnit),
              isActive: Boolean(h.isActive),
            }))}
            katalog={katalog.map((k) => ({
              id: String(k.id),
              code: String(k.code),
              name: String(k.name),
              isActive: Boolean(k.isActive),
            }))}
            yonetebilir={hizmetYonetebilir}
          />
        </div>

        <div className="space-y-4">
          <MarkaEkibi
            brandId={id}
            atamalar={atamalar.map((a) => ({
              id: a.id,
              userId: a.userId,
              fullName: a.fullName,
              email: a.email,
              assignedAt: a.assignedAt.toISOString(),
            }))}
            yonetebilir={atamaYonetebilir}
          />

          <section className="rounded-md border border-line-200 bg-surface">
            <div className="flex items-center justify-between border-b border-line-200 px-5 py-3">
              <h2 className="text-base font-semibold text-ink-900">Son değişiklikler</h2>
              <span className="text-sm text-ink-400">Son 3 kayıt</span>
            </div>
            <div className="p-5">
              {degisiklikler.length === 0 ? (
                <p className="text-sm text-ink-400">Henüz kayıtlı değişiklik yok.</p>
              ) : (
                <ol className="space-y-3 text-sm">
                  {degisiklikler.map((d) => (
                    <li key={String(d.id)}>
                      <div className="text-ink-900">{d.islem ?? "Değişiklik"}</div>
                      <div className="text-xs text-ink-400">
                        {d.kullanici ?? "—"} ·{" "}
                        {new Date(d.tarih).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="rounded-md border border-line-200 bg-surface">
            <div className="border-b border-line-200 px-5 py-3">
              <h2 className="text-base font-semibold text-ink-900">Notlar</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-ink-400">
                {(marka as { notes?: string | null }).notes || "Henüz not yok."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
