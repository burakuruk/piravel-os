/**
 * İlk Süper Yönetici kullanıcısını oluşturur (geliştirme ve ilk kurulum).
 *
 * Kullanım:
 *   npm run seed:admin -- --email admin@example.com --name "Ad Soyad"
 * Parola ADMIN_PASSWORD ortam değişkeninden okunur; verilmezse rastgele
 * üretilir ve BİR KEZ ekrana yazılır (loga değil, stdout'a).
 *
 * ⚠ Kayıt (sign-up) uygulamada kapalıdır; kullanıcılar yalnız bu script veya
 * Süper Yönetici arayüzü ile oluşur.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { authAccounts, authUsers, users } from "../src/db/schema";
import { auth } from "../src/lib/auth";
import { newId } from "../src/lib/ids";
import type { UserRole } from "../src/lib/auth-policy";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (!value && fallback === undefined) {
    console.error(`HATA: --${name} zorunludur`);
    process.exit(1);
  }
  return value ?? fallback!;
}

async function main() {
  const email = arg("email").toLowerCase();
  const fullName = arg("name", "Süper Yönetici");
  const role = arg("role", "super_admin") as UserRole;

  const password =
    process.env.ADMIN_PASSWORD ??
    Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) =>
      "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(b % 56),
    ).join("");

  if (password.length < 12) {
    console.error("HATA: parola en az 12 karakter olmalıdır");
    process.exit(1);
  }

  const existing = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);
  if (existing.length > 0) {
    console.log(`Kullanıcı zaten var: ${email} — işlem yapılmadı.`);
    process.exit(0);
  }

  // Better Auth'un kendi parola hash'leyicisi (scrypt)
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(password);

  const id = newId();
  await db.insert(authUsers).values({ id, name: fullName, email, emailVerified: true });
  await db.insert(authAccounts).values({
    id: newId(),
    userId: id,
    accountId: id,
    providerId: "credential",
    password: passwordHash,
  });
  await db.insert(users).values({ id, email, fullName, role });

  console.log("✓ Kullanıcı oluşturuldu");
  console.log(`  e-posta : ${email}`);
  console.log(`  rol     : ${role}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`  parola  : ${password}`);
    console.log("  ↑ Bu değer yalnız bir kez gösterilir. Parola yöneticinize kaydedin.");
  }
  console.log(
    role === "super_admin" || role === "finance"
      ? "\n2FA zorunludur: ilk girişte kurulum ekranı açılacaktır."
      : "\n2FA isteğe bağlıdır; Ayarlar'dan etkinleştirilebilir.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed başarısız:", err instanceof Error ? err.message : err);
  process.exit(1);
});
