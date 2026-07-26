/**
 * 2FA DOĞRULAMA — wireframe (06 §16.1)
 * Başlık "Güvenlik doğrulaması"; adım göstergesi ancak burada belirir çünkü
 * ikinci adım yalnızca 2FA gerekiyorsa vardır.
 */
import { AuthShell, Button, OtpInput } from "../_components";

export default function TotpWireframe() {
  return (
    <AuthShell
      step="2. ADIM"
      title="Güvenlik doğrulaması"
      footNote="Kod 30 saniyede bir yenilenir. Cihazınıza erişemiyorsanız kurtarma kodu kullanın."
    >
      <p className="mb-4 text-[13px] text-ink-600">
        Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.
      </p>

      <OtpInput value="4821" focusIndex={4} />

      <Button variant="primary" className="w-full">
        Doğrula
      </Button>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        <span className="cursor-pointer text-navy-500 underline underline-offset-2">
          Kurtarma kodu kullan
        </span>
        <span className="cursor-pointer text-ink-400">Geri</span>
      </div>
    </AuthShell>
  );
}
