import { headers as gelenBasliklar } from "next/headers";
import { markaOkuyabilenKullanici, rota } from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { markaCsvSatirlari, markaCsvSutunlari } from "@/lib/brand-admin";
import { csvIndirmeBasligi, csvOlustur } from "@/lib/csv";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET /api/v1/brands/export?format=csv — filtreli marka listesi (CSV)
 *
 * Dört kural burada birleşir:
 *   1. KAPSAM — OPS yalnız atandığı markaları alır; süzme sorgunun içindedir,
 *      listeyle birebir aynı yoldan geçer.
 *   2. ALAN SÜZGECİ — OPS'un dosyasında vergi sütunları YOKTUR. Ekranda
 *      gizlenip dışa aktarmada çıkan alan, süzgecin en kolay atlandığı yerdir:
 *      dosya diske iner ve paylaşılır.
 *   3. FORMÜL ENJEKSİYONU + kaçış + BOM — `@/lib/csv`.
 *   4. DENETİM — dışa aktarma `export` olarak audit'e yazılır; kimin hangi
 *      filtreyle veri indirdiği sorusunun cevabı burada durur.
 *
 * Filtre listeyle AYNI parametrelerdir: kullanıcı ekranda ne görüyorsa
 * dosyada onu bulur.
 */
export async function GET(request: Request) {
  return rota(async () => {
    const user = await markaOkuyabilenKullanici();
    const url = new URL(request.url);
    const filtre = {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      industry: url.searchParams.get("industry") ?? undefined,
    };

    const satirlar = await markaCsvSatirlari(user, filtre);
    const sutunlar = markaCsvSutunlari(user.role).map((s) => ({
      baslik: s.baslik,
      deger: (satir: Record<string, unknown>) => satir[s.alan],
    }));
    const csv = csvOlustur(sutunlar, satirlar);

    await yonetimAuditYaz({
      eylem: "export",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand",
      etiket: `Marka listesi CSV olarak dışa aktarıldı (${satirlar.length} kayıt)`,
      degisiklikler: { filtre, kayitSayisi: satirlar.length },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    const bugun = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": csvIndirmeBasligi(`markalar-${bugun}.csv`),
        // Dosya bir kimlik bilgisi değil ama kullanıcıya özeldir; ara katmanlar önbelleğe almamalı
        "Cache-Control": "no-store",
      },
    });
  });
}

export const dynamic = "force-dynamic";
