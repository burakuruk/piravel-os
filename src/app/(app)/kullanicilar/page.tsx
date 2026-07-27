import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/authz";
import { kullanicilariListele, kullaniciYonetebilirMi } from "@/lib/user-admin";
import { DAVET_DURUM_ETIKET, DURUM_ETIKET, DURUM_TON, ROL_ETIKET } from "./etiketler";

/**
 * Kullanıcı listesi — SA/FIN/OPS görür, MEM 404 alır.
 *
 * ⚠ Alanlar sorgu katmanında süzülür (`kullanicilariListele`); burada yalnız
 * gelen alanlar gösterilir. Davet bağlantısı bu ekrana ASLA gelmez — yalnız
 * davetin durumu ve son geçerlilik tarihi.
 */
export const dynamic = "force-dynamic";

export default async function KullanicilarPage() {
  const user = await requireUser();
  if (user.role === "member") notFound();

  const kayitlar = (await kullanicilariListele(user.role)) as Array<Record<string, unknown>>;
  const yonetebilir = kullaniciYonetebilirMi(user.role);

  return (
    <PageShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Kullanıcılar</h1>
          <div className="mt-1 h-0.5 w-10 bg-gold-500" />
          <p className="mt-2 text-sm text-ink-400">
            {yonetebilir
              ? "Hesap oluşturun, rol ve erişim durumunu yönetin."
              : "Salt okuma görünümü."}
          </p>
        </div>
        {yonetebilir && (
          <Link href="/kullanicilar/yeni">
            <Button variant="primary">Yeni kullanıcı</Button>
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-line-200 bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line-200 text-left text-xs tracking-wide text-ink-400">
              <th className="px-4 py-3 font-medium">AD</th>
              {"email" in (kayitlar[0] ?? {}) && <th className="px-4 py-3 font-medium">E-POSTA</th>}
              <th className="px-4 py-3 font-medium">ROL</th>
              {"status" in (kayitlar[0] ?? {}) && <th className="px-4 py-3 font-medium">DURUM</th>}
              {yonetebilir && <th className="px-4 py-3 font-medium">DAVET</th>}
              {yonetebilir && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((k) => {
              const durum = k.status as keyof typeof DURUM_ETIKET | undefined;
              const davet = k.invitation as { durum: string; expiresAt: string } | null | undefined;
              return (
                <tr key={String(k.id)} className="border-b border-line-200 last:border-0">
                  <td className="px-4 py-3 text-ink-900">{String(k.fullName ?? "—")}</td>
                  {"email" in k && (
                    <td className="px-4 py-3 text-ink-600">{String(k.email ?? "—")}</td>
                  )}
                  <td className="px-4 py-3 text-ink-600">
                    {ROL_ETIKET[String(k.role) as keyof typeof ROL_ETIKET] ?? String(k.role)}
                  </td>
                  {durum && (
                    <td className="px-4 py-3">
                      <Badge variant={DURUM_TON[durum]}>{DURUM_ETIKET[durum]}</Badge>
                    </td>
                  )}
                  {yonetebilir && (
                    <td className="px-4 py-3 text-ink-400">
                      {davet ? (
                        <span className="text-xs">
                          {DAVET_DURUM_ETIKET[
                            davet.durum as keyof typeof DAVET_DURUM_ETIKET
                          ] ?? davet.durum}
                          {davet.durum === "pending" && (
                            <span className="ml-1 text-ink-400">
                              · {new Date(davet.expiresAt).toLocaleDateString("tr-TR")}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>
                  )}
                  {yonetebilir && (
                    <td className="px-4 py-3 text-right">
                      <Link href={`/kullanicilar/${String(k.id)}`}>
                        <Button size="table">Detay</Button>
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
