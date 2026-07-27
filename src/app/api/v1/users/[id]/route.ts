import { eq } from "drizzle-orm";
import { headers as gelenBasliklar } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  govdeOku,
  hataYanit,
  okuyabilenKullanici,
  rota,
  yazmaIstegiDogrula,
  YOK,
  yonetenKullanici,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { buildRequestContext } from "@/lib/request-context";
import { kullaniciDetayi } from "@/lib/user-admin";

/**
 * GET   /api/v1/users/[id] — rolün görebildiği alanlarla kullanıcı detayı
 * PATCH /api/v1/users/[id] — temel bilgiler (ad, telefon)
 *
 * Temel bilgi güncellemesi kritik işlem DEĞİLDİR; rol, durum, 2FA ve oturum
 * işlemleri kendi alt uçlarındadır ve step-up ister.
 */

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    const user = await okuyabilenKullanici();
    const { id } = await params;
    const kayit = await kullaniciDetayi(id, user.role);
    if (!kayit) return YOK();
    return Response.json({ user: kayit });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await yonetenKullanici();
    const { id } = await params;
    const govde = await govdeOku<{ fullName?: string; phone?: string | null }>(request);

    const guncelleme: { fullName?: string; phone?: string | null } = {};
    if (typeof govde.fullName === "string") {
      const ad = govde.fullName.trim();
      if (ad.length < 2) return hataYanit("VALIDATION", "Ad en az 2 karakter olmalıdır", 400);
      guncelleme.fullName = ad;
    }
    if (govde.phone === null || typeof govde.phone === "string") {
      guncelleme.phone = govde.phone === null ? null : govde.phone.trim() || null;
    }
    if (Object.keys(guncelleme).length === 0) {
      return hataYanit("VALIDATION", "Güncellenecek alan yok", 400);
    }

    const mevcut = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!mevcut[0]) return YOK();

    await db
      .update(users)
      .set({ ...guncelleme, updatedById: user.id })
      .where(eq(users.id, id));

    await yonetimAuditYaz({
      eylem: "update",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user",
      varlikId: id,
      etiket: `Kullanıcı bilgileri güncellendi: ${mevcut[0].email}`,
      degisiklikler: { alanlar: Object.keys(guncelleme) },
      rc: buildRequestContext(await gelenBasliklar()),
    });

    const kayit = await kullaniciDetayi(id, user.role);
    return Response.json({ user: kayit });
  });
}

export const dynamic = "force-dynamic";
