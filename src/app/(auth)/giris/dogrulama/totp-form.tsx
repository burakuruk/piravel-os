"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { authClient } from "@/lib/auth-client";
import { MESAJ } from "@/lib/auth-messages";

export function TotpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const devam = params.get("devam") ?? "/";

  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code })
        : await authClient.twoFactor.verifyBackupCode({ code: recovery.trim() });

    if (res.error) {
      // Sayaç/kalan deneme bilgisi verilmez (C maddesi)
      setError(
        res.error.status === 429
          ? MESAJ.cokFazlaDeneme
          : mode === "totp"
            ? MESAJ.gecersizKod
            : MESAJ.gecersizKurtarmaKodu,
      );
      setCode("");
      setLoading(false);
      return;
    }

    router.push(devam);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </div>
      )}

      {mode === "totp" ? (
        <>
          <p className="mb-4 text-[13px] text-ink-600">
            Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.
          </p>
          <OtpInput value={code} onChange={setCode} disabled={loading} autoFocus />
        </>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-ink-600">
            Kurtarma kodlarınızdan birini girin. Her kod yalnız bir kez kullanılabilir.
          </p>
          <input
            aria-label="Kurtarma kodu"
            autoComplete="off"
            value={recovery}
            onChange={(e) => setRecovery(e.target.value)}
            disabled={loading}
            placeholder="xxxx-xxxx"
            className="mb-4 h-9 w-full rounded-sm border border-line-300 bg-surface px-3 font-mono text-sm text-ink-900 outline-none focus:border-navy-500"
          />
        </>
      )}

      <Button
        variant="primary"
        type="submit"
        className="w-full"
        disabled={loading || (mode === "totp" ? code.length < 6 : recovery.trim().length === 0)}
      >
        {loading ? "Doğrulanıyor…" : "Doğrula"}
      </Button>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "totp" ? "recovery" : "totp");
            setError(null);
          }}
          className="text-navy-500 underline underline-offset-2"
        >
          {mode === "totp" ? "Kurtarma kodu kullan" : "Doğrulama kodu kullan"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/giris")}
          className="text-ink-400"
        >
          Geri
        </button>
      </div>
    </form>
  );
}
