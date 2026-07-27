import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/authz";
import { kullaniciDetayi, kullaniciYonetebilirMi } from "@/lib/user-admin";
import { DAVET_DURUM_ETIKET, DURUM_ETIKET, DURUM_TON, ROL_ETIKET } from "../etiketler";
import { KullaniciEylemleri } from "./kullanici-eylemleri";

/**
 * Kullanıcı detayı.
 *
 * ⚠ Davet bölümünde yalnız DURUM ve son geçerlilik tarihi gösterilir. Ham
 * bağlantı bu ekrana hiç gelmez — sunucu onu yalnız oluşturma/yenileme
 * yanıtında bir kez döner.
 */
export const dynamic = "force-dynamic";

export default async function KullaniciDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role === "member") notFound();

  const { id } = await params;
  const kayit = (await kullaniciDetayi(id, user.role)) as Record<string, unknown> | null;
  if (!kayit) notFound();

  const yonetebilir = kullaniciYonetebilirMi(user.role);
  const durum = kayit.status as keyof typeof DURUM_ETIKET | undefined;
  const davet = kayit.invitation as { durum: string; expiresAt: string } | null | undefined;
  const kendisi = String(kayit.id) === user.id;

  return (
    <PageShell className="max-w-[860px]">
      <Link href="/kullanicilar" className="text-sm text-navy-500 hover:underline">
        ← Kullanıcılar
      </Link>

      <div className="mt-3 mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {String(kayit.fullName ?? "—")}
          </h1>
          <div className="mt-1 h-0.5 w-10 bg-gold-500" />
          {"email" in kayit && (
            <p className="mt-2 text-sm text-ink-600">{String(kayit.email)}</p>
          )}
        </div>
        {durum && <Badge variant={DURUM_TON[durum]}>{DURUM_ETIKET[durum]}</Badge>}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-4 rounded-md border border-line-200 bg-surface p-5 text-sm">
        <div>
          <dt className="text-ink-400">Rol</dt>
          <dd className="mt-0.5 text-ink-900">
            {ROL_ETIKET[String(kayit.role) as keyof typeof ROL_ETIKET] ?? String(kayit.role)}
          </dd>
        </div>
        {"phone" in kayit && (
          <div>
            <dt className="text-ink-400">Telefon</dt>
            <dd className="mt-0.5 text-ink-900">{String(kayit.phone ?? "—")}</dd>
          </div>
        )}
        {"twoFactorEnabled" in kayit && (
          <div>
            <dt className="text-ink-400">İki aşamalı doğrulama</dt>
            <dd className="mt-0.5 text-ink-900">
              {kayit.twoFactorEnabled ? "Kurulu" : "Kurulu değil"}
            </dd>
          </div>
        )}
        {"lastLoginAt" in kayit && (
          <div>
            <dt className="text-ink-400">Son giriş</dt>
            <dd className="mt-0.5 text-ink-900">
              {kayit.lastLoginAt
                ? new Date(String(kayit.lastLoginAt)).toLocaleString("tr-TR")
                : "Hiç giriş yapmadı"}
            </dd>
          </div>
        )}
        {yonetebilir && (
          <div className="col-span-2">
            <dt className="text-ink-400">Davet</dt>
            <dd className="mt-0.5 text-ink-900">
              {davet ? (
                <>
                  {DAVET_DURUM_ETIKET[davet.durum as keyof typeof DAVET_DURUM_ETIKET] ??
                    davet.durum}
                  {davet.durum === "pending" && (
                    <span className="ml-2 text-ink-400">
                      · son geçerlilik {new Date(davet.expiresAt).toLocaleString("tr-TR")}
                    </span>
                  )}
                </>
              ) : (
                "Açık davet yok"
              )}
            </dd>
          </div>
        )}
      </dl>

      {yonetebilir && (
        <KullaniciEylemleri
          userId={String(kayit.id)}
          email={String(kayit.email ?? "")}
          rol={String(kayit.role)}
          aktif={Boolean(kayit.isActive)}
          durum={String(kayit.status ?? "")}
          kendisi={kendisi}
        />
      )}
    </PageShell>
  );
}
