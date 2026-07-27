"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { USER_ROLES } from "@/lib/auth-policy";
import { DavetBaglantisi } from "../davet-baglantisi";
import { ROL_ETIKET } from "../etiketler";
import { StepUpDialog } from "../step-up-dialog";

/**
 * Kullanıcı yönetim işlemleri.
 *
 * Kritik işlemler SESSION_STALE dönerse step-up penceresi açılır ve doğrulama
 * sonrası AYNI işlem tekrar denenir. Bekleyen işlem bir kapanış (closure)
 * olarak tutulur; parola veya token hiçbir yerde saklanmaz.
 */
export function KullaniciEylemleri({
  userId,
  email,
  rol,
  aktif,
  durum,
  kendisi,
}: {
  userId: string;
  email: string;
  rol: string;
  aktif: boolean;
  durum: string;
  kendisi: boolean;
}) {
  const router = useRouter();
  const [yeniRol, setYeniRol] = useState(rol);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [stepUpAcik, setStepUpAcik] = useState(false);
  const [bekleyenIslem, setBekleyenIslem] = useState<(() => Promise<void>) | null>(null);
  const [davet, setDavet] = useState<{ url: string; expiresAt: string } | null>(null);

  /** Kritik işlemleri saran ortak akış: 403 SESSION_STALE → pencere → tekrar. */
  async function calistir(islem: () => Promise<Response>, basariMesaji: string) {
    setBekliyor(true);
    setHata(null);
    setMesaj(null);
    const res = await islem();
    const json = await res.json().catch(() => null);
    setBekliyor(false);

    if (res.ok) {
      setMesaj(basariMesaji);
      router.refresh();
      return;
    }
    if (json?.error?.code === "SESSION_STALE") {
      setBekleyenIslem(() => async () => {
        await calistir(islem, basariMesaji);
      });
      setStepUpAcik(true);
      return;
    }
    setHata(json?.error?.message ?? "İşlem tamamlanamadı.");
  }

  const jsonIstek = (url: string, metod: string, govde?: unknown) =>
    fetch(url, {
      method: metod,
      headers: { "Content-Type": "application/json" },
      ...(govde === undefined ? {} : { body: JSON.stringify(govde) }),
    });

  return (
    <div className="space-y-4">
      {mesaj && (
        <p role="status" className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
          {mesaj}
        </p>
      )}
      {hata && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}

      {davet && (
        <DavetBaglantisi
          url={davet.url}
          expiresAt={davet.expiresAt}
          email={email}
          onKapat={() => {
            setDavet(null);
            router.refresh();
          }}
        />
      )}

      {/* ── Rol ── */}
      <section className="rounded-md border border-line-200 bg-surface p-5">
        <h2 className="mb-1 text-base font-semibold text-ink-900">Rol</h2>
        <p className="mb-3 text-sm text-ink-400">
          Rol değişimi kullanıcının tüm oturumlarını kapatır ve kimlik
          doğrulaması ister.
        </p>
        <div className="flex items-center gap-2">
          <select
            aria-label="Rol"
            value={yeniRol}
            onChange={(e) => setYeniRol(e.target.value)}
            disabled={kendisi}
            className="rounded-sm border border-line-300 bg-surface px-3 py-2 text-sm disabled:opacity-50"
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROL_ETIKET[r]}
              </option>
            ))}
          </select>
          <Button
            disabled={bekliyor || kendisi || yeniRol === rol}
            onClick={() =>
              calistir(
                () => jsonIstek(`/api/v1/users/${userId}/role`, "PATCH", { role: yeniRol }),
                "Rol güncellendi ve oturumlar kapatıldı.",
              )
            }
          >
            Rolü değiştir
          </Button>
        </div>
        {kendisi && (
          <p className="mt-2 text-xs text-ink-400">Kendi rolünüzü değiştiremezsiniz.</p>
        )}
      </section>

      {/* ── Erişim durumu ── */}
      <section className="rounded-md border border-line-200 bg-surface p-5">
        <h2 className="mb-1 text-base font-semibold text-ink-900">Erişim durumu</h2>
        <p className="mb-3 text-sm text-ink-400">
          Pasifleştirilen kullanıcının tüm oturumları anında kapanır ve yeniden
          giriş yapamaz.
        </p>
        <Button
          variant={aktif ? "destructive" : "primary"}
          disabled={bekliyor || (aktif && kendisi)}
          onClick={() =>
            calistir(
              () =>
                jsonIstek(`/api/v1/users/${userId}/status`, "PATCH", { isActive: !aktif }),
              aktif ? "Kullanıcı pasifleştirildi." : "Kullanıcı aktifleştirildi.",
            )
          }
        >
          {aktif ? "Pasifleştir" : "Aktifleştir"}
        </Button>
        {aktif && kendisi && (
          <p className="mt-2 text-xs text-ink-400">Kendinizi pasifleştiremezsiniz.</p>
        )}
      </section>

      {/* ── Davet ── */}
      <section className="rounded-md border border-line-200 bg-surface p-5">
        <h2 className="mb-1 text-base font-semibold text-ink-900">Davet</h2>
        <p className="mb-3 text-sm text-ink-400">
          Yeni davet üretmek önceki bağlantıyı anında geçersiz kılar. Bağlantı
          yalnız üretildiği anda bir kez gösterilir.
        </p>
        <div className="flex gap-2">
          <Button
            disabled={bekliyor}
            onClick={async () => {
              setBekliyor(true);
              setHata(null);
              setMesaj(null);
              const res = await jsonIstek(`/api/v1/users/${userId}/invitations`, "POST", {});
              const json = await res.json().catch(() => null);
              setBekliyor(false);
              if (res.ok) setDavet(json.invitation);
              else setHata(json?.error?.message ?? "Davet üretilemedi.");
            }}
          >
            {durum === "pending" ? "Daveti yenile" : "Yeni davet üret"}
          </Button>
          <Button
            variant="destructive"
            disabled={bekliyor}
            onClick={() =>
              calistir(
                () => fetch(`/api/v1/users/${userId}/invitations`, { method: "DELETE" }),
                "Davet iptal edildi.",
              )
            }
          >
            Daveti iptal et
          </Button>
        </div>
      </section>

      {/* ── Güvenlik ── */}
      <section className="rounded-md border border-line-200 bg-surface p-5">
        <h2 className="mb-1 text-base font-semibold text-ink-900">Güvenlik</h2>
        <p className="mb-3 text-sm text-ink-400">
          Her iki işlem de kimlik doğrulaması ister ve kullanıcının açık
          oturumlarını kapatır.
        </p>
        <div className="flex gap-2">
          <Button
            disabled={bekliyor}
            onClick={() =>
              calistir(
                () => fetch(`/api/v1/users/${userId}/two-factor`, { method: "DELETE" }),
                "İki aşamalı doğrulama sıfırlandı.",
              )
            }
          >
            2FA&apos;yı sıfırla
          </Button>
          <Button
            disabled={bekliyor}
            onClick={() =>
              calistir(
                () => fetch(`/api/v1/users/${userId}/sessions`, { method: "DELETE" }),
                "Tüm oturumlar kapatıldı.",
              )
            }
          >
            Tüm oturumları kapat
          </Button>
        </div>
      </section>

      {stepUpAcik && (
        <StepUpDialog
          onKapat={() => {
            setStepUpAcik(false);
            setBekleyenIslem(null);
          }}
          onBasarili={async () => {
            setStepUpAcik(false);
            const islem = bekleyenIslem;
            setBekleyenIslem(null);
            if (islem) await islem();
          }}
        />
      )}
    </div>
  );
}
