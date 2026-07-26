"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * Giriş formu — 06 §16.1 (onaylı wireframe).
 *
 * Gereksinimler: göster/gizle, Caps Lock uyarısı, loading, autocomplete,
 * Enter ile gönderim. Hata mesajı hangi alanın yanlış olduğunu SÖYLEMEZ.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const devam = params.get("devam") ?? "/";

  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const { data, error: err } = await authClient.signIn.email({ email, password });

    if (err) {
      // Hangi alanın yanlış olduğu SÖYLENMEZ (kullanıcı numaralandırma engeli)
      setError("E-posta veya şifre hatalı.");
      setLoading(false);
      return;
    }

    // 2FA etkinse Better Auth doğrulama adımına yönlendirir
    if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      router.push(`/giris/dogrulama?devam=${encodeURIComponent(devam)}`);
      return;
    }

    router.push(devam);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="email" className="mb-1 block text-[13px] text-ink-600">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={loading}
          className="h-9 w-full rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-900 outline-none disabled:opacity-60"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="password" className="mb-1 block text-[13px] text-ink-600">
          Şifre
        </label>
        <div className="flex h-9 items-center rounded-sm border border-line-300 bg-surface pl-3 pr-1">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={loading}
            onKeyUp={onKey}
            onKeyDown={onKey}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={showPassword}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-400 hover:bg-fill-100 hover:text-ink-600"
          >
            {showPassword ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 .9-.7 2.2-1.9 3.4M6.3 6.5C3.9 8 2 10.4 2 12c0 2.5 4 7 10 7 1.4 0 2.7-.3 3.8-.7" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            )}
          </button>
        </div>
        {capsLock && (
          <p role="status" className="mt-1 flex items-center gap-1 text-xs text-warning">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
            Caps Lock açık
          </p>
        )}
      </div>

      <Button variant="primary" type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.2-8.6" />
            </svg>
            Giriş yapılıyor…
          </>
        ) : (
          "Giriş yap"
        )}
      </Button>
    </form>
  );
}
