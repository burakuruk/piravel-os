import { redirect } from "next/navigation";
import { AuthShell } from "../_shell";
import { isTwoFactorRequired } from "@/lib/auth-policy";
import { requireUser } from "@/lib/authz";
import { SetupFlow } from "./setup-flow";

/**
 * 2FA kurulumu — 06 §16.1.
 *
 * SA/FIN buraya ZORUNLU yönlendirilir; OPS/MEM isteğe bağlı olarak gelir.
 * Kurulum akışı ve kurtarma kodu kapısı HER İKİ DURUMDA DA AYNIDIR:
 * rol yalnız zorunluluğu belirler, güvenliği gevşetmez.
 */
export default async function GuvenlikKurulumuPage() {
  const user = await requireUser();
  const zorunlu = isTwoFactorRequired(user.role);

  // 2FA zaten kuruluysa ve zorunluysa burada işi yok
  if (user.twoFactorEnabled && zorunlu) redirect("/");

  return (
    <AuthShell step="GÜVENLİK KURULUMU" title="İki aşamalı doğrulama">
      <SetupFlow zorunlu={zorunlu} />
    </AuthShell>
  );
}
