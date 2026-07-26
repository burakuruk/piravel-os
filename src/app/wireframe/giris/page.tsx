/**
 * GİRİŞ / 2FA — WIREFRAME (06 §16.1)
 *
 * Bu sayfa GÖRSEL ONAY İÇİN statik bir taslaktır. Kimlik doğrulama mantığı,
 * form gönderimi veya Better Auth bağlantısı YOKTUR. Onaydan sonra Sprint 1'de
 * gerçek /giris rotasına dönüşecektir.
 *
 * Dört durum tek sayfada üst üste gösterilir ki akış bir bakışta görülsün.
 */
import { Button } from "@/components/ui/button";

function Shell({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-4 py-10">
      {/* Logo — altın imza (06 §3) */}
      <div className="mb-6 flex items-baseline">
        <span className="font-display text-2xl font-semibold tracking-wide text-gold-500">
          PIRAVEL
        </span>
        <span className="ml-1.5 text-2xl font-light text-shell-muted">OS</span>
      </div>

      <div className="w-full max-w-[400px] rounded-md border border-line-200 bg-surface p-6 shadow-lg">
        <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">{step}</div>
        <h1 className="mb-5 text-lg font-semibold text-ink-900">{title}</h1>
        {children}
      </div>

      <p className="mt-5 text-xs text-shell-muted">
        Piravel OS — yalnızca yetkili kullanıcılar içindir.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  type = "text",
  hint,
  error,
}: {
  label: string;
  value?: string;
  type?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-[13px] text-ink-600">{label}</label>
      <div
        className={`flex h-9 items-center rounded-sm border bg-surface px-3 text-sm ${
          error ? "border-danger" : "border-line-300"
        } ${value ? "text-ink-900" : "text-ink-400"}`}
      >
        {type === "password" && value ? "••••••••••" : (value ?? "")}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ── 1. Giriş ── */
function StepLogin() {
  return (
    <Shell step="ADIM 1 / 2" title="Giriş yap">
      <Field label="E-posta" value="ahmetburak@piravel.com" />
      <Field label="Şifre" type="password" value="x" />
      <Button variant="primary" className="w-full">
        Giriş yap
      </Button>
      <div className="mt-4 text-center">
        <span className="cursor-pointer text-[13px] text-navy-500 underline underline-offset-2">
          Şifremi unuttum
        </span>
      </div>
    </Shell>
  );
}

/* ── 1b. Giriş hatası — hangi alanın yanlış olduğu SÖYLENMEZ ── */
function StepLoginError() {
  return (
    <Shell step="ADIM 1 / 2" title="Giriş yap">
      <div className="mb-4 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger">
        E-posta veya şifre hatalı. 3 deneme hakkınız kaldı.
      </div>
      <Field label="E-posta" value="ahmetburak@piravel.com" error=" " />
      <Field label="Şifre" type="password" error=" " />
      <Button variant="primary" className="w-full">
        Giriş yap
      </Button>
      <div className="mt-4 text-center">
        <span className="cursor-pointer text-[13px] text-navy-500 underline underline-offset-2">
          Şifremi unuttum
        </span>
      </div>
    </Shell>
  );
}

/* ── 2. TOTP doğrulama ── */
function StepTotp() {
  return (
    <Shell step="ADIM 2 / 2" title="Doğrulama kodu">
      <p className="mb-4 text-[13px] text-ink-600">
        Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.
      </p>
      <div className="mb-4 flex gap-2">
        {["4", "8", "2", "1", "", ""].map((d, i) => (
          <div
            key={i}
            className={`flex h-11 flex-1 items-center justify-center rounded-sm border text-lg font-semibold tnum ${
              i === 4 ? "border-navy-500 ring-2 ring-navy-500/25" : "border-line-300"
            } ${d ? "text-ink-900" : "text-ink-400"}`}
          >
            {d}
          </div>
        ))}
      </div>
      <Button variant="primary" className="w-full">
        Doğrula
      </Button>
      <div className="mt-4 flex items-center justify-between text-[13px]">
        <span className="cursor-pointer text-navy-500 underline underline-offset-2">
          Kurtarma kodu kullan
        </span>
        <span className="cursor-pointer text-ink-400">Geri</span>
      </div>
    </Shell>
  );
}

/* ── 3. Zorunlu 2FA kurulumu (SA + FIN) ── */
function StepSetup() {
  return (
    <Shell step="GÜVENLİK KURULUMU" title="İki aşamalı doğrulama zorunlu">
      <div className="mb-4 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
        Süper Yönetici ve Finans rolleri için 2FA zorunludur. Kurulum
        tamamlanmadan sisteme erişemezsiniz.
      </div>

      <div className="mb-4 flex gap-4">
        {/* QR yer tutucu */}
        <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-sm border border-line-300 bg-fill-100 text-[10px] text-ink-400">
          QR kod
        </div>
        <div className="text-[13px] text-ink-600">
          <p className="mb-2">
            Google Authenticator veya benzeri bir uygulamayla QR kodu okutun.
          </p>
          <p className="text-ink-400">Elle giriş:</p>
          <p className="font-mono text-xs text-ink-900">JBSW Y3DP EHPK 3PXP</p>
        </div>
      </div>

      <Field label="Uygulamadaki 6 haneli kod" value="482 193" />

      {/* Kurtarma kodları — indirmeden devam edilemez */}
      <div className="mb-4 rounded-sm border border-line-200 bg-fill-100 p-3">
        <div className="mb-2 text-[13px] font-semibold text-ink-900">Kurtarma kodları</div>
        <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-ink-600">
          <span>4f2a-91bd</span>
          <span>7c05-3e8a</span>
          <span>b13e-6d47</span>
          <span>9a80-2fc1</span>
          <span>e574-0ba9</span>
          <span>2d6f-8471</span>
        </div>
        <p className="text-xs text-ink-400">
          Telefonunuzu kaybederseniz tek erişim yolunuz budur. Güvenli bir yerde saklayın.
        </p>
        <Button variant="secondary" size="table" className="mt-2">
          Kodları indir
        </Button>
      </div>

      <label className="mb-4 flex items-start gap-2 text-[13px] text-ink-600">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-line-300 bg-surface" />
        Kurtarma kodlarını indirdim ve güvenli bir yerde sakladım.
      </label>

      <Button variant="primary" className="w-full opacity-50">
        Kurulumu tamamla
      </Button>
      <p className="mt-2 text-center text-xs text-ink-400">
        Onay kutusu işaretlenene kadar pasiftir.
      </p>
    </Shell>
  );
}

export default function LoginWireframePage() {
  return (
    <>
      <StepLogin />
      <StepLoginError />
      <StepTotp />
      <StepSetup />
    </>
  );
}
