import { and, eq, inArray, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { brandUsers, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isTwoFactorRequired, type UserRole } from "@/lib/auth-policy";

/**
 * Yetkilendirme yardımcıları — docs/02 (yetki matrisi).
 *
 * İlke: yetki API katmanında zorlanır. UI'da butonu gizlemek yetki değildir.
 * Rol her istekte DB'den okunur; session'daki değere güvenilmez.
 */

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  /** SA/FIN olup 2FA kurmamış kullanıcı: yalnız kurulum sayfalarına erişebilir */
  mustSetupTwoFactor: boolean;
  /**
   * Bu isteğin oturum kimliği (auth_session.id).
   *
   * Step-up kayıtları oturuma bağlıdır; kritik işlem uçları `requireStepUp`'a
   * bunu verir. Kullanıcı kimliğiyle çalışılsaydı, bir oturumda alınan
   * yükseltme aynı kullanıcının BAŞKA bir oturumunda da geçerli olurdu.
   */
  sessionId: string;
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Oturum bulunamadı");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Bu işlem için yetkiniz yok") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Oturumdaki kullanıcıyı DB'den taze okur. Oturum yoksa null döner. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !session.session) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      totpEnabledAt: users.totpEnabledAt,
    })
    .from(users)
    .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) return null;

  const twoFactorEnabled = Boolean(
    (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? row.totpEnabledAt,
  );

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    twoFactorEnabled,
    mustSetupTwoFactor: isTwoFactorRequired(row.role) && !twoFactorEnabled,
    sessionId: session.session.id,
  };
}

/** Oturum zorunlu. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/** Belirli rollerden biri zorunlu. */
export async function requireRole(...allowed: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}

/**
 * Kullanıcının erişebildiği marka id'leri.
 * SA/FIN: null döner (kapsam yok, tümü).
 * OPS   : brand_users ataması.
 * MEM   : boş dizi (marka listesine erişimi yok).
 */
export async function accessibleBrandIds(user: CurrentUser): Promise<string[] | null> {
  if (user.role === "super_admin" || user.role === "finance") return null;
  if (user.role === "member") return [];
  const rows = await db
    .select({ brandId: brandUsers.brandId })
    .from(brandUsers)
    .where(eq(brandUsers.userId, user.id));
  return rows.map((r) => r.brandId);
}

/** Bir markaya erişim kontrolü; kapsam dışıysa 404 gibi davranılır (varlık sızdırılmaz). */
export async function canAccessBrand(user: CurrentUser, brandId: string): Promise<boolean> {
  const ids = await accessibleBrandIds(user);
  if (ids === null) return true;
  return ids.includes(brandId);
}

/** Marka kapsamlı sorgular için WHERE parçası. null → filtre gerekmiyor. */
export function brandScopeFilter(
  brandIds: string[] | null,
  column: Parameters<typeof inArray>[0],
) {
  if (brandIds === null) return undefined;
  return inArray(column, brandIds.length > 0 ? brandIds : ["00000000-0000-0000-0000-000000000000"]);
}
