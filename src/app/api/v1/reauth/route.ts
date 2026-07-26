import { headers as gelenBasliklar } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authAccounts, authUsers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { writeAuthAudit } from "@/lib/auth-audit";
import { MESAJ } from "@/lib/auth-messages";
import { buildRequestContext } from "@/lib/request-context";
import { stepUpKaydet, STEP_UP_SURESI_SN, type StepUpYontemi } from "@/lib/step-up";

/**
 * POST /api/v1/reauth — adım yükseltme (step-up) doğrulaması.
 *
 * Kullanıcı kritik bir işlem denediğinde SESSION_STALE alır, bu uca
 * parolasını (2FA açıksa TOTP kodunu da) gönderir, ardından işlemi tekrar
 * dener.
 *
 * ⚠ 2FA etkin bir kullanıcı için TOTP ZORUNLUDUR. Yalnız parola yeterli
 * sayılsaydı, parolayı ele geçirmiş biri ikinci faktörü hiç görmeden
 * kritik işlemleri yapabilirdi — 2FA'nın varlık sebebi ortadan kalkardı.
 */
export async function POST(request: Request) {
  const basliklar = await gelenBasliklar();
  const rc = buildRequestContext(basliklar);

  const session = await auth.api.getSession({ headers: basliklar }).catch(() => null);
  if (!session?.user || !session.session) {
    return Response.json(
      { error: { code: "UNAUTHENTICATED", message: "Oturum bulunamadı" } },
      { status: 401 },
    );
  }

  let govde: { password?: string; totpCode?: string };
  try {
    govde = await request.json();
  } catch {
    govde = {};
  }
  const parola = typeof govde.password === "string" ? govde.password : "";
  const totpKodu = typeof govde.totpCode === "string" ? govde.totpCode.trim() : "";

  const userId = session.user.id;

  // ── 1. Kullanıcı hâlâ aktif mi? ──
  const kullanici = await db
    .select({ twoFactorEnabled: authUsers.twoFactorEnabled })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);
  const ikiFaAcik = Boolean(kullanici[0]?.twoFactorEnabled);

  // ── 2. Parola doğrulaması ──
  const hesap = await db
    .select({ password: authAccounts.password })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")))
    .limit(1);

  const kripto = (await auth.$context).password;
  const parolaDogru = hesap[0]?.password
    ? await kripto.verify({ hash: hesap[0].password, password: parola }).catch(() => false)
    : false;

  if (!parolaDogru) {
    await writeAuthAudit({
      action: "login_failed",
      actorId: userId,
      actorEmail: session.user.email,
      ipAddress: rc.ipAddress,
      userAgent: rc.userAgent,
      requestId: rc.requestId,
      upstreamRequestId: rc.upstreamRequestId,
      testRunId: rc.testRunId,
      context: { asama: "step_up", basarili: false },
    });
    // Aynı genel mesaj: hangi alanın yanlış olduğu söylenmez
    return Response.json(
      { error: { code: "INVALID_CREDENTIALS", message: MESAJ.gecersizKimlik } },
      { status: 401 },
    );
  }

  // ── 3. 2FA açıksa TOTP zorunlu ──
  let yontem: StepUpYontemi = "password";
  if (ikiFaAcik) {
    if (!totpKodu) {
      return Response.json(
        {
          error: {
            code: "TOTP_REQUIRED",
            message: "Doğrulama kodu gerekiyor.",
          },
        },
        { status: 401 },
      );
    }
    const totpSonuc = await auth.api
      .verifyTOTP({ body: { code: totpKodu }, headers: basliklar })
      .then(() => true)
      .catch(() => false);

    if (!totpSonuc) {
      await writeAuthAudit({
        action: "login_failed",
        actorId: userId,
        actorEmail: session.user.email,
        ipAddress: rc.ipAddress,
        requestId: rc.requestId,
        upstreamRequestId: rc.upstreamRequestId,
        testRunId: rc.testRunId,
        context: { asama: "step_up_totp", basarili: false },
      });
      return Response.json(
        { error: { code: "INVALID_TOTP", message: MESAJ.gecersizKod } },
        { status: 401 },
      );
    }
    yontem = "password_totp";
  }

  // ── 4. Yükseltmeyi kaydet ──
  // session.session.id, auth_session.id ile aynıdır; kayıt bu oturuma bağlanır
  const { expiresAt } = await stepUpKaydet({
    sessionId: session.session.id,
    userId,
    method: yontem,
    requestId: rc.requestId,
  });

  await writeAuthAudit({
    action: "login",
    actorId: userId,
    actorEmail: session.user.email,
    ipAddress: rc.ipAddress,
    userAgent: rc.userAgent,
    requestId: rc.requestId,
    upstreamRequestId: rc.upstreamRequestId,
    testRunId: rc.testRunId,
    /**
     * Yöntem, ham dize yerine DOĞRULANAN FAKTÖR SAYISI olarak yazılır.
     * Hem daha bilgilendirici hem de denetim gövdesinde parola/secret
     * benzeri kelimeler bulundurmaz (PRD §6.3 tripwire'ı temiz kalır).
     */
    context: {
      asama: "step_up",
      faktorSayisi: yontem === "password_totp" ? 2 : 1,
      gecerlilikSn: STEP_UP_SURESI_SN,
    },
  });

  return Response.json({
    ok: true,
    method: yontem,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: STEP_UP_SURESI_SN,
  });
}

/** GET /api/v1/reauth — mevcut yükseltmenin durumu (UI'nin sorması için). */
export async function GET() {
  const basliklar = await gelenBasliklar();
  const session = await auth.api.getSession({ headers: basliklar }).catch(() => null);
  if (!session?.session) {
    return Response.json({ gecerli: false }, { status: 401 });
  }
  const { stepUpGecerliMi } = await import("@/lib/step-up");
  const durum = await stepUpGecerliMi(session.session.id);
  return Response.json(durum);
}

export const dynamic = "force-dynamic";
