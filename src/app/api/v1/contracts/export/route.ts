import { headers as gelenBasliklar } from "next/headers";
import { rota, sozlesmeOkuyabilenKullanici } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import {
  sozlesmeCsvSatirlari,
  sozlesmeCsvSutunlari,
  type SozlesmeFiltresi,
} from "@/lib/contract-admin";
import { csvIndirmeBasligi, csvOlustur } from "@/lib/csv";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET /api/v1/contracts/export?format=csv — filtreli sözleşme listesi (CSV)
 *
 * Marka dışa aktarımıyla aynı dört kural: kapsam, alan süzgeci, formül
 * enjeksiyonu koruması + BOM, denetim.
 *
 * ⚠ OPS'un dosyasında tutar ve faturalama sütunları YOKTUR — alanlar zaten
 * sorguya girmiyor.
 *
 * ⚠ Tutar sütununun yanında TUTAR TEMELİ sütunu vardır: tek başına bir rakam
 * dışa aktarılmaz, çünkü dönemlik mi toplam mı olduğu dosyada belirsiz kalır
 * ve tablo başka bir yerde yanlış toplanır.
 */
export async function GET(request: Request) {
  return rota(async () => {
    const user = await sozlesmeOkuyabilenKullanici();
    const url = new URL(request.url);
    const filtre: SozlesmeFiltresi = {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      brandId: url.searchParams.get("brandId") ?? undefined,
      expiringWithin: url.searchParams.has("expiringWithin")
        ? Number(url.searchParams.get("expiringWithin"))
        : undefined,
    };

    const satirlar = await sozlesmeCsvSatirlari(user, filtre);
    const sutunlar = sozlesmeCsvSutunlari(user.role).map((s) => ({
      baslik: s.baslik,
      deger: (satir: Record<string, unknown>) => satir[s.alan],
    }));
    const csv = csvOlustur(sutunlar, satirlar);

    await yonetimAuditYaz({
      eylem: "export",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "contract",
      etiket: `Sözleşme listesi CSV olarak dışa aktarıldı (${satirlar.length} kayıt)`,
      degisiklikler: { filtre, kayitSayisi: satirlar.length },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    const bugun = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": csvIndirmeBasligi(`sozlesmeler-${bugun}.csv`),
        "Cache-Control": "no-store",
      },
    });
  });
}

export const dynamic = "force-dynamic";
