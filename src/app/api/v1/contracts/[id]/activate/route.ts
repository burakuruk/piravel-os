import { headers as gelenBasliklar } from "next/headers";
import {
  erisilebilirSozlesme,
  kritikIslemKapisi,
  rota,
  sozlesmeYonetenKullanici,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { sozlesmeAktiflestir } from "@/lib/contract-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * POST /api/v1/contracts/:id/activate — sözleşmeyi yürürlüğe alır (SA/FIN)
 *
 * STEP-UP ister: aktivasyon belgeyi yürürlüğe sokar, alanları kilitler ve
 * markanın durumunu değiştirebilir. Açık bırakılmış bir ekranın başındaki
 * biri bunu yapamamalı.
 *
 * ⚠ Tek transaction: durum + `activated_at` + (gerekiyorsa) marka durumu +
 * marka-hizmet bağlama. HİÇBİR alacak/şablon kaydı üretilmez.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await sozlesmeYonetenKullanici();
    const { id } = await ctx.params;
    await erisilebilirSozlesme(user, id);
    await kritikIslemKapisi(user, "contract.activate");

    const sonuc = await sozlesmeAktiflestir({ contractId: id, aktorId: user.id });
    const rc = buildRequestContext(await gelenBasliklar());
    const aktor = { id: user.id, email: user.email };

    await yonetimAuditYaz({
      eylem: "update",
      aktor,
      varlikTuru: "contract",
      varlikId: id,
      etiket: `Sözleşme yürürlüğe alındı: ${sonuc.contractNo}`,
      degisiklikler: { markaId: sonuc.brandId, durum: "active" },
      rc,
    });

    /**
     * Marka durumu değiştiyse AYRI denetim kaydı: "sözleşme aktive edildi" ile
     * "marka müşteriye çevrildi" iki farklı olaydır ve marka ekranının
     * tarihçesinde de görünmeli.
     */
    if (sonuc.markaAktiflestirildi) {
      await yonetimAuditYaz({
        eylem: "update",
        aktor,
        varlikTuru: "brand",
        varlikId: sonuc.brandId,
        etiket: "Marka aktif müşteriye çevrildi",
        degisiklikler: {
          markaId: sonuc.brandId,
          durum: "active",
          source: "contract_activation",
          contractNo: sonuc.contractNo,
        },
        rc,
      });
    }

    /**
     * Bağlanan her hizmet için ayrı kayıt.
     *
     * ⚠ `audit_action` enum'ına yeni değer EKLENMEDİ: yeni bağda `create`,
     * canlandırmada `restore` kullanılır; ayrım `entity_type` +
     * `changes.source` ile yapılır.
     */
    for (const h of sonuc.baglananHizmetler) {
      await yonetimAuditYaz({
        eylem: h.yeni ? "create" : "restore",
        aktor,
        varlikTuru: "brand_service",
        varlikId: h.brandServiceId,
        etiket: h.yeni
          ? "Sözleşme aktivasyonunda hizmet markaya eklendi"
          : "Sözleşme aktivasyonunda hizmet bağlantısı canlandırıldı",
        degisiklikler: {
          markaId: sonuc.brandId,
          serviceId: h.serviceId,
          source: "contract_activation",
          contractNo: sonuc.contractNo,
        },
        rc,
      });
    }

    return Response.json({
      contract: { id: sonuc.id, contractNo: sonuc.contractNo, status: "active" },
      markaAktiflestirildi: sonuc.markaAktiflestirildi,
      baglananHizmetSayisi: sonuc.baglananHizmetler.length,
      warnings: sonuc.warnings,
    });
  });
}

export const dynamic = "force-dynamic";
