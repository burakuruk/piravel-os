import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireUser } from "@/lib/authz";
import { markalariListele } from "@/lib/brand-admin";
import { sozlesmeModulunuGorebilirMi, sozlesmeYonetebilirMi } from "@/lib/contract-admin";
import { YeniSozlesmeFormu } from "./yeni-sozlesme-formu";

/**
 * Yeni sözleşme.
 *
 * ⚠ Yetki İKİ KATMANDA: burada modülü göremeyen 404, yönetemeyen 404 alır
 * (form hiç render edilmez); API katmanı ayrıca 403 döner. Ekranı gizlemek
 * yetki değildir — ama yetkisi olmayana form göstermek de yanlış.
 *
 * ⚠ `loading.tsx` EKLENMEZ (liste sayfasındaki gerekçe).
 */
export const dynamic = "force-dynamic";

export default async function YeniSozlesmePage() {
  const user = await requireUser();
  if (!sozlesmeModulunuGorebilirMi(user.role)) notFound();
  if (!sozlesmeYonetebilirMi(user.role)) notFound();

  const markalar = (await markalariListele(user)).map((m) => ({
    id: String(m.id),
    name: String(m.name),
    code: String(m.code),
  }));

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/sozlesmeler"
          className="max-sm:min-h-11 inline-flex items-center text-sm text-navy-500 underline"
        >
          ← Sözleşmeler
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">Yeni sözleşme</h1>
        <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        <p className="mt-2 max-w-[68ch] text-sm text-ink-400">
          Sözleşme taslak olarak kaydedilir. Kapsam kalemleri ve yürürlüğe alma sonraki
          adımlardır.
        </p>
      </div>

      <YeniSozlesmeFormu markalar={markalar} />
    </PageShell>
  );
}
