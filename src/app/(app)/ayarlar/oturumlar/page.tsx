import { PageShell } from "@/components/layout/page-shell";
import { requireUser } from "@/lib/authz";
import { oturumlariListele } from "@/lib/session-admin";
import { OturumListesi } from "./oturum-listesi";

/**
 * Ayarlar › Oturumlar — kullanıcının KENDİ açık oturumları.
 *
 * ⚠ Rol kapısı YOK: her kullanıcı kendi oturumlarını görür. Hedef her zaman
 * oturumdan türetilir, hiçbir yerde `userId` parametresi kabul edilmez.
 */
export const dynamic = "force-dynamic";

export default async function OturumlarPage() {
  const user = await requireUser();
  const oturumlar = await oturumlariListele(user.id, user.sessionId);

  return (
    <PageShell className="max-w-[860px]">
      <h1 className="font-display text-2xl font-semibold text-ink-900">Oturumlar</h1>
      <div className="mt-1 h-0.5 w-10 bg-gold-500" />
      <p className="mt-2 mb-6 text-sm text-ink-400">
        Hesabınızın açık olduğu cihazlar. Tanımadığınız bir oturum görürseniz
        kapatın ve parolanızı değiştirin.
      </p>

      <OturumListesi oturumlar={oturumlar} />
    </PageShell>
  );
}
