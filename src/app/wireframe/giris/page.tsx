/**
 * GİRİŞ — wireframe (06 §16.1)
 * Revizyon: sabit "ADIM 1 / 2" kaldırıldı. 2FA yalnız gerekiyorsa ikinci ekranda
 * görünür; OPS/MEM rollerinde 2FA opsiyonel olduğu için ilk ekran adım sayısı vaat etmez.
 */
import { AuthShell, Button, EyeToggle, TextField } from "../_components";

export default function GirisWireframe() {
  return (
    <AuthShell title="Giriş yap">
      <TextField
        label="E-posta"
        name="email"
        type="email"
        autoComplete="username"
        defaultValue="ahmetburak@piravel.com"
      />
      <TextField
        label="Şifre"
        name="password"
        type="password"
        autoComplete="current-password"
        defaultValue="gizlisifre"
        trailing={<EyeToggle />}
      />
      <Button variant="primary" className="w-full">
        Giriş yap
      </Button>
      <div className="mt-4 text-center">
        <span className="cursor-pointer text-[13px] text-navy-500 underline underline-offset-2">
          Şifremi unuttum
        </span>
      </div>
    </AuthShell>
  );
}
