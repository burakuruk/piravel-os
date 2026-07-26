/**
 * GİRİŞ / 2FA WIREFRAME — ortak parçalar (06 §16.1)
 *
 * Bu dosyadaki her şey GÖRSEL ONAY İÇİN statik taslaktır.
 * Kimlik doğrulama mantığı, form gönderimi veya Better Auth bağlantısı YOKTUR.
 * Gerçek input öznitelikleri (autocomplete, inputMode) bilinçli olarak doğru
 * yazılmıştır — Sprint 1'de aynen taşınacaklar.
 */
import { Button } from "@/components/ui/button";

export function AuthShell({
  step,
  title,
  children,
  footNote,
}: {
  step?: string;
  title: string;
  children: React.ReactNode;
  footNote?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-4 py-10">
      <div className="mb-6 flex items-baseline">
        <span className="font-display text-2xl font-semibold tracking-wide text-gold-500">
          PIRAVEL
        </span>
        <span className="ml-1.5 text-2xl font-light text-shell-muted">OS</span>
      </div>

      <div className="w-full max-w-[400px] rounded-md border border-line-200 bg-surface p-6 shadow-lg">
        {step && (
          <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">{step}</div>
        )}
        <h1 className="mb-5 text-lg font-semibold text-ink-900">{title}</h1>
        {children}
      </div>

      <p className="mt-5 max-w-[400px] text-center text-xs text-shell-muted">
        {footNote ?? "Piravel OS — yalnızca yetkili kullanıcılar içindir."}
      </p>
    </div>
  );
}

/** Etiketli metin girişi — gerçek autocomplete öznitelikleriyle. */
export function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  placeholder,
  error,
  trailing,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
  error?: boolean;
  trailing?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="mb-1 block text-[13px] text-ink-600">
        {label}
      </label>
      <div
        className={`flex h-9 items-center rounded-sm border bg-surface pl-3 pr-1 ${
          error ? "border-danger" : "border-line-300"
        }`}
      >
        <input
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          placeholder={placeholder}
          readOnly
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
        />
        {trailing}
      </div>
      {hint}
    </div>
  );
}

/** Şifre alanı için göster/gizle düğmesi (yalnız görsel). */
export function EyeToggle({ shown = false }: { shown?: boolean }) {
  return (
    <button
      type="button"
      aria-label={shown ? "Şifreyi gizle" : "Şifreyi göster"}
      aria-pressed={shown}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-400 hover:bg-fill-100 hover:text-ink-600"
    >
      {shown ? (
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
  );
}

/** Uyarı / bilgi şeridi — sol 2px işlevsel çizgi. */
export function Notice({
  tone,
  children,
}: {
  tone: "danger" | "warning" | "info";
  children: React.ReactNode;
}) {
  const map = {
    danger: "border-danger bg-danger-bg text-danger",
    warning: "border-warning bg-warning-bg text-warning",
    info: "border-info bg-info-bg text-info",
  } as const;
  return (
    <div className={`mb-4 rounded-sm border-l-2 px-3 py-2 text-[13px] ${map[tone]}`}>{children}</div>
  );
}

/**
 * TOTP girişi — GÖRSEL olarak 6 kutu, TEKNİK olarak tek erişilebilir alan.
 * Sprint 1 davranış sözleşmesi (06 §16.1):
 *   · toplu yapıştırma (6 hane tek seferde dağıtılır)
 *   · autocomplete="one-time-code" → iOS/Android otomatik doldurma
 *   · inputMode="numeric" + pattern → mobilde rakam tuş takımı
 *   · Backspace boş kutuda bir öncekine atlar ve onu siler
 *   · role="group" + aria-label ile ekran okuyucuya tek alan olarak duyurulur
 */
export function OtpInput({ value = "", focusIndex }: { value?: string; focusIndex?: number }) {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  return (
    <div
      role="group"
      aria-label="6 haneli doğrulama kodu"
      className="mb-4 flex gap-2"
      data-otp-group
    >
      {digits.map((d, i) => (
        <input
          key={i}
          aria-label={`${i + 1}. hane`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          defaultValue={d}
          readOnly
          className={`h-11 w-full min-w-0 rounded-sm border bg-surface text-center text-lg font-semibold tnum text-ink-900 outline-none ${
            i === focusIndex
              ? "border-navy-500 ring-2 ring-navy-500/25"
              : "border-line-300"
          }`}
        />
      ))}
    </div>
  );
}

/** Kurtarma kodu listesi — masaüstü 2 kolon, mobil tek kolon. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-sm border border-line-200 bg-fill-100 p-3 font-mono text-xs text-ink-900 max-md:grid-cols-1">
      {codes.map((c) => (
        <span key={c}>{c}</span>
      ))}
    </div>
  );
}

export function Checkbox({ checked, children }: { checked?: boolean; children: React.ReactNode }) {
  return (
    <label className="mb-4 flex items-start gap-2 text-[13px] text-ink-600">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
          checked ? "border-navy-900 bg-navy-900 text-white" : "border-line-300 bg-surface"
        }`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      {children}
    </label>
  );
}

export { Button };
