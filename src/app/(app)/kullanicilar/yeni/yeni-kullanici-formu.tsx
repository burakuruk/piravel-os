"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { USER_ROLES } from "@/lib/auth-policy";
import { ROL_ETIKET } from "../etiketler";
import { StepUpDialog } from "@/components/ui/step-up-dialog";
import { DavetBaglantisi } from "../davet-baglantisi";

/**
 * Yeni kullanıcı formu.
 *
 * SA/FIN gibi ayrıcalıklı roller step-up ister; uç SESSION_STALE dönerse
 * pencere açılır, doğrulama sonrası istek AYNI gövdeyle tekrar denenir.
 */
export function YeniKullaniciFormu() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("member");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [stepUpAcik, setStepUpAcik] = useState(false);
  const [sonuc, setSonuc] = useState<{ url: string; expiresAt: string; email: string } | null>(
    null,
  );

  async function olustur(): Promise<"tamam" | "stepup" | "hata"> {
    const res = await fetch("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, role }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      setSonuc({
        url: json.invitation.url,
        expiresAt: json.invitation.expiresAt,
        email: json.user.email,
      });
      return "tamam";
    }
    if (json?.error?.code === "SESSION_STALE") return "stepup";
    setHata(json?.error?.message ?? "Kullanıcı oluşturulamadı.");
    return "hata";
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    const durum = await olustur();
    setBekliyor(false);
    if (durum === "stepup") setStepUpAcik(true);
  }

  if (sonuc) {
    return (
      <DavetBaglantisi
        url={sonuc.url}
        expiresAt={sonuc.expiresAt}
        email={sonuc.email}
        geriHref="/kullanicilar"
      />
    );
  }

  return (
    <>
      <form onSubmit={gonder} className="rounded-md border border-line-200 bg-surface p-5">
        <div className="mb-4">
          <label htmlFor="yk-ad" className="mb-1 block text-sm text-ink-600">
            Ad soyad
          </label>
          <input
            id="yk-ad"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="yk-eposta" className="mb-1 block text-sm text-ink-600">
            E-posta
          </label>
          <input
            id="yk-eposta"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mb-5">
          <label htmlFor="yk-rol" className="mb-1 block text-sm text-ink-600">
            Rol
          </label>
          <select
            id="yk-rol"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-sm border border-line-300 bg-surface px-3 py-2 text-sm"
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROL_ETIKET[r]}
              </option>
            ))}
          </select>
          {(role === "super_admin" || role === "finance") && (
            <p className="mt-1 text-xs text-warning">
              Bu rol için iki aşamalı doğrulama zorunludur ve oluşturma sırasında
              kimliğiniz yeniden doğrulanır.
            </p>
          )}
        </div>

        {hata && (
          <p role="alert" className="mb-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
            {hata}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Link href="/kullanicilar">
            <Button type="button">Vazgeç</Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={bekliyor || !email.includes("@") || fullName.trim().length < 2}
          >
            {bekliyor ? "Oluşturuluyor…" : "Oluştur ve davet üret"}
          </Button>
        </div>
      </form>

      {stepUpAcik && (
        <StepUpDialog
          onKapat={() => setStepUpAcik(false)}
          onBasarili={async () => {
            setStepUpAcik(false);
            setBekliyor(true);
            await olustur();
            setBekliyor(false);
          }}
        />
      )}
    </>
  );
}
