/**
 * ZORUNLU 2FA KURULUMU — 1/2: uygulama bağlama (wireframe)
 * QR masaüstünde 150px; mobilde QR üstte, açıklama altında.
 */
import { AuthShell, Button, Notice, OtpInput } from "../_components";

function QrBox() {
  return (
    <div className="flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-sm border border-line-300 bg-fill-100 text-[11px] text-ink-400">
      QR kod 150×150
    </div>
  );
}

export default function KurulumWireframe() {
  return (
    <AuthShell step="GÜVENLİK KURULUMU — 1 / 2" title="Uygulamanızı bağlayın">
      <Notice tone="warning">
        Süper Yönetici ve Finans rolleri için iki aşamalı doğrulama zorunludur.
        Kurulum tamamlanmadan sisteme erişemezsiniz.
      </Notice>

      {/* Masaüstü: QR solda + açıklama sağda · Mobil: QR üstte, açıklama altta */}
      <div className="mb-4 flex gap-4 max-md:flex-col max-md:items-center max-md:text-center">
        <QrBox />
        <div className="min-w-0 text-[13px] text-ink-600">
          <p className="mb-3">
            Google Authenticator, 1Password veya benzeri bir uygulamayla QR kodu okutun.
          </p>
          <p className="mb-1 text-ink-400">QR okutamıyorsanız anahtarı elle girin:</p>
          <p className="mb-2 font-mono text-xs break-all text-ink-900">JBSW Y3DP EHPK 3PXP</p>
          <div className="flex flex-wrap gap-2 max-md:justify-center">
            <Button variant="secondary" size="table">Anahtarı kopyala</Button>
            <Button variant="ghost" size="table">QR kodu yenile</Button>
          </div>
        </div>
      </div>

      <p className="mb-4 flex items-start gap-1.5 text-xs text-warning">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px shrink-0">
          <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
        Bu anahtarı kimseyle paylaşmayın. Piravel OS ekibi dahil hiç kimse sizden
        bu anahtarı istemez.
      </p>

      <label className="mb-1 block text-[13px] text-ink-600">
        Uygulamadaki 6 haneli kod
      </label>
      <OtpInput value="482193" />

      <Button variant="primary" className="w-full">
        Devam et
      </Button>
      <p className="mt-2 text-center text-xs text-ink-400">
        Sonraki adım: kurtarma kodları
      </p>
    </AuthShell>
  );
}
