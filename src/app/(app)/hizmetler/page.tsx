import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { requireUser } from "@/lib/authz";
import {
  hizmetKatalogunuYonetebilirMi,
  hizmetleriListele,
  markaModulunuGorebilirMi,
} from "@/lib/brand-admin";
import { HizmetKatalogu } from "./hizmet-katalogu";

/**
 * Hizmet kataloğu — SA yazar, FIN ve OPS okur, MEM 404 alır.
 *
 * ⚠ Fiyat ve maliyet alanları OPS yanıtına hiç girmez (`hizmetleriListele`);
 * bu sayfa yalnız gelen alanları gösterir. Yazma kontrolleri de yalnız SA için
 * render edilir — asıl kapı API'dedir, ama çalışmayan bir buton göstermenin de
 * anlamı yok.
 *
 * ⚠ BU ROTAYA `loading.tsx` EKLENMEZ: akış başlayınca yanıt 200 ile açılır ve
 * `notFound()` 404 durum kodunu üretemez. MEM'in 404 alması bir yetki
 * davranışıdır ve durum koduyla sınanır (`verify:brands`).
 */
export const dynamic = "force-dynamic";

export default async function HizmetlerPage() {
  const user = await requireUser();
  if (!markaModulunuGorebilirMi(user.role)) notFound();

  const kayitlar = (await hizmetleriListele(user.role)) as Array<Record<string, unknown>>;
  const yazabilir = hizmetKatalogunuYonetebilirMi(user.role);

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Hizmet kataloğu</h1>
        <div className="mt-1 h-0.5 w-10 bg-gold-500" />
        <p className="mt-2 max-w-[68ch] text-sm text-ink-400">
          {yazabilir
            ? "Ajansın sunduğu hizmet türleri. Markalara bu katalogdan atanır; hizmet silinmez, pasifleştirilir."
            : "Ajansın sunduğu hizmet türleri. Salt okuma görünümü — katalog yönetimi yöneticidedir."}
        </p>
      </div>

      <HizmetKatalogu
        yazabilir={yazabilir}
        hizmetler={kayitlar.map((h) => ({
          id: String(h.id),
          code: String(h.code),
          name: String(h.name),
          description: h.description ? String(h.description) : null,
          defaultUnit: String(h.defaultUnit ?? "—"),
          isActive: Boolean(h.isActive),
          kullananMarka: Number(h.kullananMarka ?? 0),
        }))}
      />
    </PageShell>
  );
}
