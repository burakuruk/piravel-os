import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { newId } from "@/lib/ids";
import { writeAuthAudit } from "@/lib/auth-audit";
import {
  ikinciAdimOncesi,
  ikinciAdimSonrasi,
  parolaGirisiOncesi,
  parolaGirisiSonrasi,
} from "@/lib/auth-guards";
import { parolaSifirlamaSonrasiTemizle } from "@/lib/auth-lockout";
import { betterAuthSecret } from "@/lib/env";
import { stepUpGecersizKil } from "@/lib/step-up";

/**
 * Better Auth yapılandırması — PRD §7, docs/03 §2 (Kimlik doğrulama sınırı).
 *
 * Better Auth yönetir : oturum, parola hash'i, TOTP, kurtarma kodları
 * Biz yönetiriz       : rol, marka kapsamı, audit köprüsü, zorunlu 2FA kuralı
 *
 * ⚠ Rol ASLA session'dan okunmaz — her istekte `users` tablosundan doğrulanır
 * (docs/02 §6). Session'a yazılan bir rol, oturum yenilenene kadar eskir ve
 * yetki yükseltme yüzeyi oluşturur.
 */
export const auth = betterAuth({
  appName: "Piravel OS",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  // Modül gövdesinde çağrılır: sır eksik/zayıfsa sunucu ilk isteği almadan düşer.
  secret: betterAuthSecret(),

  /**
   * CSRF koruması: yalnız bu origin'lerden gelen istekler kabul edilir.
   *
   * Varsayılan olarak baseURL güvenilir. Ek origin'ler
   * BETTER_AUTH_TRUSTED_ORIGINS ile (virgülle ayrılmış) verilir — ters proxy
   * arkasında veya otomasyon (Playwright IPv4 kullanmak zorunda) için gerekir.
   * Geliştirmede yerel adresler zaten eklenir.
   */
  trustedOrigins: [
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"]),
  ],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.authUsers,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
      twoFactor: schema.authTwoFactors,
      // rateLimit.modelName ile aynı anahtar olmalı
      auth_rate_limit: schema.authRateLimit,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    // Kayıt açık değildir: kullanıcılar yalnız Süper Yönetici tarafından oluşturulur
    disableSignUp: true,
  },

  session: {
    expiresIn: 60 * 60 * 12, // 12 saat (PRD §6.3)
    updateAge: 60 * 60,
    // Hassas işlemlerde "taze oturum" eşiği: 15 dakika
    freshAge: 60 * 15,
  },

  /**
   * IP bazlı rate limit — hesap kilidinden BAĞIMSIZ ilk katman.
   *
   * Kurallar açıkça yazılır; varsayılana güvenilmez. Depo DB'dir: bellek
   * deposu çok instance'lı üretimde her instance'ta ayrı sayar ve limiti
   * fiilen instance sayısı kadar çarpar.
   */
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "auth_rate_limit",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/forget-password": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },

  advanced: {
    database: { generateId: () => newId() },
  },

  plugins: [
    twoFactor({
      issuer: "Piravel OS",
      // Kurtarma kodları Better Auth tarafından şifreli saklanır ve
      // kurulumdan sonra bir daha gösterilmez (PRD §6.3)
      backupCodeOptions: { amount: 6, length: 8 },
    }),
  ],

  /**
   * Audit köprüsü: giriş, başarısız giriş ve çıkış olayları `audit_logs`'a
   * yazılır (docs/02 §6). Sır içeren gövde ASLA kaydedilmez.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const path = ctx.path;

      /**
       * Parola girişi. Kilit durumu ancak parola DOĞRUYSA ele verilir;
       * yanlış parolada kilitli hesap da bilinmeyen hesapla aynı 401'i alır
       * (enumeration engeli). Karar için parola doğrulaması burada yapılır,
       * bu yüzden Better Auth'un kripto fonksiyonları guard'a geçirilir.
       */
      if (path.startsWith("/sign-in/email")) {
        const body = ctx.body as { email?: string; password?: string } | undefined;
        const kripto = (await auth.$context).password;
        await parolaGirisiOncesi(body?.email ?? "", body?.password ?? "", ctx.headers, {
          hash: kripto.hash,
          verify: kripto.verify,
        });
        return;
      }

      // İkinci adım: TOTP/kurtarma kodu kilidi
      if (path.startsWith("/two-factor/verify")) {
        const session = await auth.api
          .getSession({ headers: ctx.headers ?? new Headers() })
          .catch(() => null);
        await ikinciAdimOncesi(session?.user?.id ?? null, ctx.headers);
        return;
      }

      /**
       * Çıkış audit'i BEFORE'da yazılır: after çalıştığında oturum silinmiş
       * olur ve kimin çıktığı artık bilinemez.
       */
      if (path.startsWith("/sign-out")) {
        const session = await auth.api
          .getSession({ headers: ctx.headers ?? new Headers() })
          .catch(() => null);
        if (session?.user) {
          await writeAuthAudit({
            action: "logout",
            actorId: session.user.id,
            actorEmail: session.user.email,
            ipAddress: ctx.headers?.get("x-forwarded-for") ?? null,
            userAgent: ctx.headers?.get("user-agent") ?? null,
          });
        }
      }
    }),

    after: createAuthMiddleware(async (ctx) => {
      const path = ctx.path;

      if (path.startsWith("/sign-in/email")) {
        const email = (ctx.body as { email?: string } | undefined)?.email ?? "";
        const user = ctx.context.newSession?.user;
        // 2FA'lı hesapta oturum henüz açılmaz ama PAROLA doğrudur:
        // twoFactorRedirect yanıtı başarı sayılır.
        const iki = (ctx.context.returned as { twoFactorRedirect?: boolean } | undefined)
          ?.twoFactorRedirect;
        const basarili = Boolean(user) || Boolean(iki);
        await parolaGirisiSonrasi(email, basarili, user?.id ?? null, ctx.headers);
        return;
      }

      if (path.startsWith("/two-factor/verify")) {
        const user = ctx.context.newSession?.user;
        const tur = path.includes("backup-code") ? "recovery_code" : "totp";
        await ikinciAdimSonrasi(
          user?.id ?? ctx.context.session?.user?.id ?? null,
          user?.email ?? "",
          tur,
          Boolean(user),
          ctx.headers,
        );
        return;
      }

      /**
       * 2FA devre dışı bırakıldıysa / sıfırlandıysa step-up geçersizdir:
       * kanıtın dayandığı ikinci faktör artık aynı değil.
       */
      if (path.startsWith("/two-factor/disable") || path.startsWith("/two-factor/enable")) {
        const session = await auth.api
          .getSession({ headers: ctx.headers ?? new Headers() })
          .catch(() => null);
        if (session?.user) await stepUpGecersizKil(session.user.id);
        return;
      }

      // Parola sıfırlandıysa parola kilidi ve sayacı temizlenir
      if (path.startsWith("/reset-password")) {
        const session = await auth.api
          .getSession({ headers: ctx.headers ?? new Headers() })
          .catch(() => null);
        if (session?.user) {
          await parolaSifirlamaSonrasiTemizle(session.user.id);
          // Parola değiştiyse eski step-up kanıtı da geçersizdir:
          // yükseltme "bu parolayı bilen kişi buradaydı" demektir.
          await stepUpGecersizKil(session.user.id);
          await writeAuthAudit({
            action: "security_counter_reset",
            actorId: session.user.id,
            actorEmail: session.user.email,
            context: { sayac: "giris", neden: "sifirlama", stepUp: "gecersiz" },
          });
        }
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        // auth_user ile iş tablomuz users arasında 1:1 eşleme kurulur.
        after: async (user) => {
          const existing = await db
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.id, user.id))
            .limit(1);
          if (existing.length === 0) {
            await db.insert(schema.users).values({
              id: user.id,
              email: user.email,
              fullName: user.name,
              role: "member", // yükseltme yalnız SA tarafından yapılır
            });
          }
        },
      },
    },
  },
});

export type Auth = typeof auth;
