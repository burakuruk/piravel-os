import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/authz";

/**
 * Uygulama kabuğu + yetki kapısı.
 *
 * İki kural burada zorlanır (docs/02 §6):
 *   1. Oturum yoksa → /giris
 *   2. SA/FIN olup 2FA kurmamışsa → /guvenlik-kurulumu
 *      (middleware yalnız çerez varlığına bakar; asıl karar burada)
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  if (user.mustSetupTwoFactor) redirect("/guvenlik-kurulumu");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} fullName={user.fullName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar breadcrumb="Genel Bakış" role={user.role} fullName={user.fullName} />
        {children}
      </div>
    </div>
  );
}
