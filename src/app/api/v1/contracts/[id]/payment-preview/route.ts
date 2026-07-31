import { erisilebilirSozlesme, finansOkuyabilenKullanici, rota } from "@/lib/api";
import { sozlesmeOdemePlani } from "@/lib/contract-admin";

/**
 * GET /api/v1/contracts/:id/payment-preview — ödeme planı ÖNİZLEMESİ (SA/FIN)
 *
 * ⚠ HİÇBİR KAYIT ÜRETMEZ. Ne `receivables`, ne `recurring_templates`, ne de
 * başka bir satır. Vadeler yalnız hesaplanır ve döner.
 *
 * OPS burada 404 alır (403 değil): uç tamamen finansaldır ve varlığı da
 * OPS'a kapalıdır.
 *
 * 120 satırı aşan yapılandırma `422 PREVIEW_TOO_LONG` ile reddedilir — liste
 * KISALTILMAZ. Kısaltılmış bir plan toplamı sözleşme tutarından küçük
 * gösterir ve yanlış bir rakam konuşulur.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await finansOkuyabilenKullanici();
    const { id } = await ctx.params;
    await erisilebilirSozlesme(user, id);

    const plan = await sozlesmeOdemePlani(user, id);
    return Response.json({
      satirlar: plan.satirlar,
      toplam: plan.toplam,
      currencyCode: plan.currencyCode,
      sinirliOnizleme: plan.sinirliOnizleme,
      /** Ekranın bastığı ibare sunucudan gelir; iki yerde ayrışmasın. */
      not: "Bu önizleme kayıt oluşturmaz.",
    });
  });
}

export const dynamic = "force-dynamic";
