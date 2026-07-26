import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "../_shell";
import { getCurrentUser } from "@/lib/authz";
import { LoginForm } from "./login-form";

/**
 * Giriş — 06 §16.1.
 * Adım göstergesi YOKTUR: 2FA yalnız SA/FIN için zorunlu olduğundan
 * her kullanıcı ikinci adıma gitmez; sistem tutamayacağı söz vermez.
 */
export default async function GirisPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustSetupTwoFactor ? "/guvenlik-kurulumu" : "/");

  return (
    <AuthShell title="Giriş yap">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <div className="mt-4 text-center">
        <span className="cursor-pointer text-[13px] text-navy-500 underline underline-offset-2">
          Şifremi unuttum
        </span>
      </div>
    </AuthShell>
  );
}
