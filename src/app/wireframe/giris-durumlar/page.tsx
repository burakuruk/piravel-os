/**
 * GİRİŞ — DURUM SAYFASI (wireframe)
 * Dört durum yan yana: Caps Lock uyarısı, şifre görünür, hata, yükleniyor.
 */
import { Button, EyeToggle, Notice, TextField } from "../_components";

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium tracking-widest text-shell-muted">{label}</div>
      <div className="w-[400px] rounded-md border border-line-200 bg-surface p-6 shadow-lg">
        <h2 className="mb-5 text-lg font-semibold text-ink-900">Giriş yap</h2>
        {children}
      </div>
    </div>
  );
}

export default function GirisDurumlariWireframe() {
  return (
    <div className="min-h-screen bg-navy-900 px-10 py-10">
      <h1 className="mb-8 font-display text-xl text-gold-500">Giriş ekranı — durumlar</h1>
      <div className="grid grid-cols-2 gap-x-10 gap-y-8">
        <Panel label="CAPS LOCK AÇIK">
          <TextField label="E-posta" name="e1" type="email" autoComplete="username" defaultValue="ahmetburak@piravel.com" />
          <TextField
            label="Şifre"
            name="p1"
            type="password"
            autoComplete="current-password"
            defaultValue="gizlisifre"
            trailing={<EyeToggle />}
            hint={
              <p className="mt-1 flex items-center gap-1 text-xs text-warning" role="status">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
                Caps Lock açık
              </p>
            }
          />
          <Button variant="primary" className="w-full">Giriş yap</Button>
        </Panel>

        <Panel label="ŞİFRE GÖRÜNÜR">
          <TextField label="E-posta" name="e2" type="email" autoComplete="username" defaultValue="ahmetburak@piravel.com" />
          <TextField
            label="Şifre"
            name="p2"
            type="text"
            autoComplete="current-password"
            defaultValue="Piravel2026!"
            trailing={<EyeToggle shown />}
          />
          <Button variant="primary" className="w-full">Giriş yap</Button>
        </Panel>

        <Panel label="HATA — HANGİ ALAN OLDUĞU SÖYLENMEZ">
          <Notice tone="danger">E-posta veya şifre hatalı. 3 deneme hakkınız kaldı.</Notice>
          <TextField label="E-posta" name="e3" type="email" autoComplete="username" defaultValue="ahmetburak@piravel.com" error />
          <TextField label="Şifre" name="p3" type="password" autoComplete="current-password" error trailing={<EyeToggle />} />
          <Button variant="primary" className="w-full">Giriş yap</Button>
        </Panel>

        <Panel label="YÜKLENİYOR">
          <TextField label="E-posta" name="e4" type="email" autoComplete="username" defaultValue="ahmetburak@piravel.com" />
          <TextField label="Şifre" name="p4" type="password" autoComplete="current-password" defaultValue="gizlisifre" trailing={<EyeToggle />} />
          <Button variant="primary" className="w-full opacity-70" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.2-8.6" />
            </svg>
            Giriş yapılıyor…
          </Button>
          <p className="mt-2 text-center text-xs text-ink-400">
            Form Enter ile de gönderilir; işlem sırasında alanlar kilitlenir.
          </p>
        </Panel>
      </div>

      <p className="mt-10 max-w-[900px] text-xs leading-5 text-shell-muted">
        Tüm durumlarda geçerli:{" "}
        <span className="font-mono text-shell-text">autocomplete=&quot;username&quot;</span> ·{" "}
        <span className="font-mono text-shell-text">autocomplete=&quot;current-password&quot;</span>{" "}
        · Enter ile gönderim · parola yöneticisi uyumu · işlem sırasında alanlar kilitlenir.
      </p>
    </div>
  );
}
