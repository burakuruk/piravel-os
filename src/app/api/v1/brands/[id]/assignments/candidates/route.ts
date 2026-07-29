import { atamaYonetenKullanici, erisilebilirMarka, rota } from "@/lib/api";
import { atanabilirKullanicilar } from "@/lib/brand-admin";

/**
 * GET /api/v1/brands/:id/assignments/candidates?q= — atanabilir kullanıcılar
 *
 * ⚠ Sonuçta YALNIZ aktif OPS kullanıcıları çıkar. SA ve FIN arama sonuçlarına
 * hiç girmez: rol gereği zaten tüm markaları görürler, atamak bir şeyi
 * değiştirmez. MEM bu sprintte markaya atanmaz. Süzme SORGUNUN İÇİNDEdir —
 * arayüz listeyi kısaltmakla yükümlü değildir.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await atamaYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirMarka(user, id);

    const q = new URL(request.url).searchParams.get("q") ?? undefined;
    return Response.json({ candidates: await atanabilirKullanicilar(id, q) });
  });
}

export const dynamic = "force-dynamic";
