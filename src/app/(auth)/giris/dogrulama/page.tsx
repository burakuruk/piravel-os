import { Suspense } from "react";
import { AuthShell } from "../../_shell";
import { TotpForm } from "./totp-form";

/**
 * 2FA doğrulama — 06 §16.1.
 * Adım göstergesi ancak BURADA belirir; ikinci adım yalnız 2FA gerekiyorsa vardır.
 */
export default function DogrulamaPage() {
  return (
    <AuthShell
      step="2. ADIM"
      title="Güvenlik doğrulaması"
      footNote="Kod 30 saniyede bir yenilenir. Cihazınıza erişemiyorsanız kurtarma kodu kullanın."
    >
      <Suspense fallback={null}>
        <TotpForm />
      </Suspense>
    </AuthShell>
  );
}
