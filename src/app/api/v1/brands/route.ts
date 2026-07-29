import { headers as gelenBasliklar } from "next/headers";
import {
  govdeOku,
  markaOkuyabilenKullanici,
  markaYonetenKullanici,
  rota,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { markalariListele, markaOlustur } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET  /api/v1/brands — kapsam ve alan süzgeciyle marka listesi
 * POST /api/v1/brands — marka oluşturur (SA/FIN)
 *
 * ⚠ Kapsam ve alan süzgeci `brand-admin` içinde, SORGUNUN İÇİNDE uygulanır.
 * Bu dosya yalnız rol kapısını ve giriş/çıkış biçimini yönetir.
 */

export async function GET(request: Request) {
  return rota(async () => {
    const user = await markaOkuyabilenKullanici();
    const url = new URL(request.url);
    const brands = await markalariListele(user, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      industry: url.searchParams.get("industry") ?? undefined,
    });
    return Response.json({ brands });
  });
}

export async function POST(request: Request) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await markaYonetenKullanici();
    const govde = await govdeOku<Record<string, unknown>>(request);

    const { id, code } = await markaOlustur({
      code: String(govde.code ?? ""),
      name: String(govde.name ?? ""),
      legalName: govde.legalName as string | null,
      taxNumber: govde.taxNumber as string | null,
      taxOffice: govde.taxOffice as string | null,
      industry: govde.industry as string | null,
      email: govde.email as string | null,
      phone: govde.phone as string | null,
      website: govde.website as string | null,
      address: govde.address as string | null,
      notes: govde.notes as string | null,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "create",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "brand",
      varlikId: id,
      etiket: `Marka oluşturuldu: ${code}`,
      degisiklikler: { kod: code, ad: govde.name },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ brand: { id, code } }, { status: 201 });
  });
}

export const dynamic = "force-dynamic";
