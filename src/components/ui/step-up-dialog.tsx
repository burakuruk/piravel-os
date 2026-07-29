"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Step-up (yeniden doğrulama) penceresi.
 *
 * Kritik bir işlem SESSION_STALE dönerse açılır; kullanıcı parolasını (2FA
 * açıksa kodunu da) girer, `/api/v1/reauth` yükseltmeyi kaydeder ve işlem
 * yeniden denenir.
 *
 * ⚠ Parola state'te yalnız gönderim anına kadar tutulur ve hiçbir yere
 * loglanmaz. Pencere kapanınca alanlar temizlenir.
 */
export function StepUpDialog({
  onKapat,
  onBasarili,
}: {
  onKapat: () => void;
  onBasarili: () => void;
}) {
  /**
   * Bileşen yalnız pencere AÇIKKEN monte edilir (çağıran koşullu render eder).
   * Bu sayede alanları efektle sıfırlamaya gerek kalmaz — her açılış zaten
   * taze bir örnektir ve parola bir öncekinden taşınmaz.
   */
  const [parola, setParola] = useState("");
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [totpGerekli, setTotpGerekli] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);

  // Escape ile kapatma — odak tuzağı gerektirmeyen küçük pencere
  useEffect(() => {
    const kapat = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
    };
    document.addEventListener("keydown", kapat);
    return () => document.removeEventListener("keydown", kapat);
  }, [onKapat]);

  async function dogrula(e: React.FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    const res = await fetch("/api/v1/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: parola, ...(kod ? { totpCode: kod } : {}) }),
    });
    const json = await res.json().catch(() => null);
    setBekliyor(false);

    if (res.ok) {
      setParola("");
      setKod("");
      onBasarili();
      return;
    }
    if (json?.error?.code === "TOTP_REQUIRED") {
      setTotpGerekli(true);
      setHata("Doğrulama kodunuzu girin.");
      return;
    }
    setHata(json?.error?.message ?? "Doğrulama başarısız.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepup-baslik"
    >
      <div className="w-full max-w-[380px] rounded-md border border-line-200 bg-surface p-5 shadow-lg">
        <h2 id="stepup-baslik" className="mb-1 text-base font-semibold text-ink-900">
          Kimliğinizi doğrulayın
        </h2>
        <p className="mb-4 text-sm text-ink-600">
          Bu işlem hassastır. Devam etmek için parolanızı girin.
        </p>

        <form onSubmit={dogrula}>
          <label htmlFor="stepup-parola" className="mb-1 block text-sm text-ink-600">
            Parola
          </label>
          <input
            id="stepup-parola"
            autoFocus
            type="password"
            autoComplete="current-password"
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            className="mb-3 w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
          />

          {totpGerekli && (
            <>
              <label htmlFor="stepup-kod" className="mb-1 block text-sm text-ink-600">
                Doğrulama kodu
              </label>
              <input
                id="stepup-kod"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={kod}
                onChange={(e) => setKod(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mb-3 w-full rounded-sm border border-line-300 px-3 py-2 text-sm tracking-widest"
              />
            </>
          )}

          {hata && (
            <p role="alert" className="mb-3 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
              {hata}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" onClick={onKapat}>
              Vazgeç
            </Button>
            <Button type="submit" variant="primary" disabled={bekliyor || !parola}>
              {bekliyor ? "Doğrulanıyor…" : "Doğrula"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
