"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * TOTP girişi — görsel olarak 6 kutu, TEKNİK olarak tek erişilebilir alan.
 * Davranış sözleşmesi: 06 §16.1.
 *
 *   · toplu yapıştırma (6 hane tek seferde dağıtılır)
 *   · autocomplete="one-time-code" → iOS/Android otomatik doldurma
 *   · inputMode="numeric" → mobilde rakam tuş takımı
 *   · Backspace: dolu kutuda siler, BOŞ kutuda bir öncekine atlar ve onu siler
 *   · role="group" + aria etiketleri → ekran okuyucuda tek alan
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  length?: number;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setAt(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  }

  function focusAt(index: number) {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  }

  function onInput(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    setAt(index, digit);
    if (index < length - 1) focusAt(index + 1);
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setAt(index, "");
      } else if (index > 0) {
        // Boş kutuda: bir öncekine atla VE onu sil
        const next = digits.slice();
        next[index - 1] = "";
        onChange(next.join(""));
        focusAt(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusAt(Math.min(pasted.length, length - 1));
  }

  return (
    <div role="group" aria-label={`${length} haneli doğrulama kodu`} className="mb-4 flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={`${i + 1}. hane`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          value={d}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-11 w-full min-w-0 rounded-sm border border-line-300 bg-surface text-center text-lg font-semibold tnum text-ink-900 outline-none",
            "focus:border-navy-500 focus:ring-2 focus:ring-navy-500/25 disabled:opacity-60",
          )}
        />
      ))}
    </div>
  );
}
