import { headers as gelenBasliklar } from "next/headers";
import {
  govdeOku,
  hizmetYonetenKullanici,
  markaOkuyabilenKullanici,
  rota,
  yazmaIstegiDogrula,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { hizmetleriListele, hizmetOlustur } from "@/lib/brand-admin";
import { buildRequestContext } from "@/lib/request-context";

/**
 * GET  /api/v1/services — hizmet kataloğu
 * POST /api/v1/services — hizmet tanımlar (SA/FIN)
 *
 * ⚠ OPS için FİYAT ve MALİYET alanları yanıta hiç girmez (docs/02 §3.2).
 * Hizmet SİLİNMEZ, pasifleştirilir — geçmiş sözleşmeler ona referans verir.
 */

export async function GET() {
  return rota(async () => {
    const user = await markaOkuyabilenKullanici();
    return Response.json({ services: await hizmetleriListele(user.role) });
  });
}

export async function POST(request: Request) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await hizmetYonetenKullanici();
    const govde = await govdeOku<Record<string, unknown>>(request);

    const { id, code } = await hizmetOlustur({
      code: String(govde.code ?? ""),
      name: String(govde.name ?? ""),
      category: govde.category as string | null,
      description: govde.description as string | null,
      defaultUnit: govde.defaultUnit as string | null,
      aktorId: user.id,
    });

    await yonetimAuditYaz({
      eylem: "create",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "service",
      varlikId: id,
      etiket: `Hizmet tanımlandı: ${code}`,
      degisiklikler: { kod: code, ad: govde.name },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    return Response.json({ service: { id, code } }, { status: 201 });
  });
}

export const dynamic = "force-dynamic";
