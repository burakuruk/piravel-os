import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireUser } from "@/lib/authz";
import { markaModulunuGorebilirMi, markaYonetebilirMi } from "@/lib/brand-admin";
import { YeniMarkaFormu } from "./yeni-marka-formu";

/**
 * Yeni marka — SA ve FIN.
 *
 * OPS marka oluşturamaz; modülü gördüğü için 404 değil, sayfaya hiç
 * girememesi yeterlidir (liste ekranında buton da render edilmez). Yine de
 * doğrudan URL denemesi 404 alır: yetki kapısı görünürlükten bağımsızdır.
 */
export const dynamic = "force-dynamic";

export default async function YeniMarkaPage() {
  const user = await requireUser();
  if (!markaModulunuGorebilirMi(user.role)) notFound();
  if (!markaYonetebilirMi(user.role)) notFound();

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/markalar"
          /* Geri bağlantısı da bir dokunma hedefidir: mobilde 44 px */
          className="max-sm:min-h-11 inline-flex items-center text-sm text-navy-500 underline"
        >
          ← Markalar
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">Yeni marka</h1>
        <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        <p className="mt-2 max-w-[68ch] text-sm text-ink-400">
          Yalnız kimlik bilgileri. Yetkili kişiler, hizmetler ve sorumlu ekip
          marka açıldıktan sonra detay sayfasından eklenir.
        </p>
      </div>

      <YeniMarkaFormu vergiGorunur={user.role !== "operations"} />
    </PageShell>
  );
}
