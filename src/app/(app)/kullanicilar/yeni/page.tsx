import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { kullaniciYonetebilirMi } from "@/lib/user-admin";
import { YeniKullaniciFormu } from "./yeni-kullanici-formu";

export const dynamic = "force-dynamic";

export default async function YeniKullaniciPage() {
  const user = await requireUser();
  if (!kullaniciYonetebilirMi(user.role)) notFound();

  return (
    <div className="max-w-[560px]">
      <h1 className="font-display text-2xl font-semibold text-ink-900">Yeni kullanıcı</h1>
      <div className="mt-1 h-0.5 w-10 bg-gold-500" />
      <p className="mt-2 mb-6 text-sm text-ink-400">
        Kullanıcı oluşturulunca parolasız ve pasif başlar; hesabı yalnız davet
        bağlantısını kullanarak kendisi aktifleştirir.
      </p>
      <YeniKullaniciFormu />
    </div>
  );
}
