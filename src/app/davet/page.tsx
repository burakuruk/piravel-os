import { cookies } from "next/headers";
import { AuthShell } from "@/app/(auth)/_shell";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  cerezGecerliMi,
  davetiCerezIleBul,
  DAVET_CEREZ_ADI,
  DAVET_HATA_MESAJI,
  kabulEdilebilirMi,
} from "@/lib/invitations";
import { DavetFormu } from "./davet-formu";

/**
 * Davet kabul ekranı — TEMİZ URL.
 *
 * Buraya `/davet/<token>` üzerinden gelinir; o rota token'ı doğrulayıp çerez
 * yazar ve buraya yönlendirir. Bu sayfa token'ı hiç görmez, yalnız çerezi.
 *
 * ⚠ E-posta SALT OKUNURDUR: davet belirli bir hesap için üretilmiştir; başka
 * bir adres girilebilseydi davet, istenen kişiden başkasına hesap açardı.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Davet — Piravel OS",
  // Davet sayfası arama motorlarına ve önizleme botlarına kapalı
  robots: { index: false, follow: false },
};

export default async function DavetPage() {
  const cerezDeposu = await cookies();
  const cerezKimligi = cerezDeposu.get(DAVET_CEREZ_ADI)?.value ?? "";

  const davet = cerezKimligi ? await davetiCerezIleBul(cerezKimligi) : null;
  const gecerli = davet !== null && cerezGecerliMi(davet) && kabulEdilebilirMi(davet);

  if (!davet || !gecerli) {
    /**
     * Tek tip mesaj: bağlantının geçersiz mi, süresi mi dolmuş, iptal mi
     * edilmiş yoksa kullanılmış mı olduğu SÖYLENMEZ.
     */
    return (
      <AuthShell title="Davet bağlantısı">
        <p className="text-sm text-ink-600">{DAVET_HATA_MESAJI}</p>
        <a
          href="/giris"
          className="mt-5 inline-block text-sm font-medium text-navy-500 hover:underline"
        >
          Giriş ekranına dön
        </a>
      </AuthShell>
    );
  }

  const kayit = await db
    .select({ email: users.email, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, davet.userId))
    .limit(1);

  if (!kayit[0]) {
    return (
      <AuthShell title="Davet bağlantısı">
        <p className="text-sm text-ink-600">{DAVET_HATA_MESAJI}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      step="HESABINIZI OLUŞTURUN"
      title="Parolanızı belirleyin"
      footNote="Bu bağlantı yalnız size özeldir; kimseyle paylaşmayın."
    >
      <DavetFormu email={kayit[0].email} fullName={kayit[0].fullName} />
    </AuthShell>
  );
}
