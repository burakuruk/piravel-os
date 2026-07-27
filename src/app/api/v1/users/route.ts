import { headers as gelenBasliklar } from "next/headers";
import {
  govdeOku,
  hataYanit,
  okuyabilenKullanici,
  kritikIslemKapisi,
  rota,
  uygulamaOrigin,
  yazmaIstegiDogrula,
  yonetenKullanici,
} from "@/lib/api";
import { yonetimAuditYaz } from "@/lib/admin-audit";
import { isTwoFactorRequired } from "@/lib/auth-policy";
import { davetOlustur } from "@/lib/invitations";
import { buildRequestContext } from "@/lib/request-context";
import { bekleyenKullaniciOlustur, gecerliRolMu, kullanicilariListele } from "@/lib/user-admin";

/**
 * GET  /api/v1/users — rolün görebildiği alanlarla kullanıcı listesi
 * POST /api/v1/users — davet bekleyen kullanıcı oluşturur (yalnız SA)
 */

export async function GET() {
  return rota(async () => {
    const user = await okuyabilenKullanici();
    const users = await kullanicilariListele(user.role);
    return Response.json({ users });
  });
}

export async function POST(request: Request) {
  return rota(async () => {
    await yazmaIstegiDogrula(request);
    const user = await yonetenKullanici();
    const govde = await govdeOku<{ email?: string; fullName?: string; role?: string }>(request);

    const email = typeof govde.email === "string" ? govde.email.trim().toLowerCase() : "";
    const fullName = typeof govde.fullName === "string" ? govde.fullName.trim() : "";
    const role = govde.role;

    if (!email.includes("@") || fullName.length < 2 || !gecerliRolMu(role)) {
      return hataYanit("VALIDATION", "E-posta, ad ve rol geçerli olmalıdır", 400);
    }

    /**
     * Ayrıcalıklı rol (2FA zorunlu olanlar: SA/FIN) oluşturmak kritik işlemdir.
     * Ayrıcalıksız kullanıcı oluşturmak step-up istemez — günlük bir iş.
     */
    if (isTwoFactorRequired(role)) {
      await kritikIslemKapisi(user, "user.create_privileged");
    }

    const rc = buildRequestContext(await gelenBasliklar());
    const { userId } = await bekleyenKullaniciOlustur({
      email,
      fullName,
      role,
      aktorId: user.id,
    });

    const davet = await davetOlustur({
      userId,
      createdById: user.id,
      requestId: rc.requestId,
    });

    await yonetimAuditYaz({
      eylem: "create",
      aktor: { id: user.id, email: user.email },
      varlikTuru: "user",
      varlikId: userId,
      etiket: `Kullanıcı oluşturuldu: ${email}`,
      // ⚠ Ham token BURAYA YAZILMAZ — yalnız davetin varlığı ve süresi
      degisiklikler: { rol: role, davetSonGecerlilik: davet.expiresAt.toISOString() },
      rc,
    });

    /**
     * ⚠ Ham davet token'ı YALNIZ bu yanıtta, BİR KEZ döner. Liste, detay ve
     * davet durumu uçları onu asla içermez.
     */
    const url = `${await uygulamaOrigin()}/davet/${davet.token}`;
    return Response.json(
      {
        user: { id: userId, email, fullName, role },
        invitation: {
          token: davet.token,
          url,
          expiresAt: davet.expiresAt.toISOString(),
        },
      },
      { status: 201 },
    );
  });
}

export const dynamic = "force-dynamic";
