"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { authClient } from "@/lib/auth-client";
import {
  canCompleteTwoFactorSetup,
  normalizeRecoveryCode,
  pickChallengeIndex,
} from "@/lib/auth-policy";

/**
 * 2FA kurulum akışı — iki adım (06 §16.1).
 *
 * 1/2 Uygulamayı bağlama : parola doğrulaması → QR + anahtar → TOTP onayı
 * 2/2 Kurtarma kodları   : kopyala VEYA indir → onay → RASTGELE kod doğrulaması
 *
 * ⚠ Kurtarma kodu kapısı TÜM roller için aynıdır. Rol yalnız 2FA'nın zorunlu
 * olup olmadığını belirler; kuruluma başlayan herkes üç kapıyı da geçer.
 *
 * ⚠ PRD §6.3: totpURI ve kurtarma kodları yalnız bileşen state'inde yaşar;
 * loglanmaz, dışarı gönderilmez, kurulum bitince state ile birlikte kaybolur.
 */
type Adim = "parola" | "qr" | "kodlar" | "bitti";

export function SetupFlow({ zorunlu }: { zorunlu: boolean }) {
  const router = useRouter();
  const [adim, setAdim] = useState<Adim>("parola");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [otp, setOtp] = useState("");


  // Kurtarma kodu kapısı
  const [copiedOrDownloaded, setCopiedOrDownloaded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [challenge, setChallenge] = useState("");
  const challengeIndex = useMemo(
    () => (codes.length > 0 ? pickChallengeIndex(codes.length) : 0),
    [codes.length],
  );
  const challengePassed =
    codes.length > 0 &&
    normalizeRecoveryCode(challenge) === normalizeRecoveryCode(codes[challengeIndex] ?? "");

  const gateOpen = canCompleteTwoFactorSetup({
    copiedOrDownloaded,
    acknowledged,
    challengePassed,
  });

  /** Anahtarı otpauth URI'sinden çıkarır (elle giriş için gösterilir). */
  const manualKey = useMemo(() => {
    if (!totpUri) return null;
    const secret = new URL(totpUri).searchParams.get("secret") ?? "";
    return secret.replace(/(.{4})/g, "$1 ").trim();
  }, [totpUri]);

  async function baslat() {
    setError(null);
    setLoading(true);
    const res = await authClient.twoFactor.enable({ password });
    if (res.error) {
      setError("Parola doğrulanamadı.");
      setLoading(false);
      return;
    }
    // QR kodu TARAYICIDA üretilir — otpauth:// URI'si hiçbir harici servise
    // gönderilmez (PRD §6.3). Sonuç yalnız bir data: URL'dir.
    const qr = await QRCode.toDataURL(res.data.totpURI, { width: 300, margin: 1 });

    setTotpUri(res.data.totpURI);
    setQrDataUrl(qr);
    setCodes(res.data.backupCodes);
    setAdim("qr");
    setLoading(false);
  }

  async function qrOnayla() {
    setError(null);
    setLoading(true);
    const res = await authClient.twoFactor.verifyTotp({ code: otp });
    if (res.error) {
      setError("Kod geçersiz. Uygulamanızdaki güncel kodu girin.");
      setOtp("");
      setLoading(false);
      return;
    }
    setAdim("kodlar");
    setLoading(false);
  }

  function kopyala() {
    void navigator.clipboard.writeText(codes.join("\n"));
    setCopiedOrDownloaded(true);
  }

  function indir() {
    const blob = new Blob([`Piravel OS — kurtarma kodları\n\n${codes.join("\n")}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "piravel-os-kurtarma-kodlari.txt";
    a.click();
    URL.revokeObjectURL(url);
    setCopiedOrDownloaded(true);
  }

  function tamamla() {
    if (!gateOpen) return;
    // Sırlar state'ten silinir
    setCodes([]);
    setTotpUri(null);
    setAdim("bitti");
    router.push("/");
    router.refresh();
  }

  // ── 1. Parola doğrulaması ──
  if (adim === "parola") {
    return (
      <div>
        {zorunlu && (
          <div className="mb-4 rounded-sm border-l-2 border-warning bg-warning-bg px-3 py-2 text-[13px] text-warning">
            Rolünüz için iki aşamalı doğrulama zorunludur. Kurulum tamamlanmadan
            sisteme erişemezsiniz.
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}
        <label htmlFor="pw" className="mb-1 block text-[13px] text-ink-600">
          Devam etmek için şifrenizi girin
        </label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className="mb-4 h-9 w-full rounded-sm border border-line-300 bg-surface px-3 text-sm outline-none focus:border-navy-500"
        />
        <Button variant="primary" className="w-full" onClick={baslat} disabled={loading || !password}>
          {loading ? "Doğrulanıyor…" : "Kuruluma başla"}
        </Button>
      </div>
    );
  }

  // ── 2. QR + TOTP onayı ──
  if (adim === "qr") {
    return (
      <div>
        <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">1 / 2</div>
        <h2 className="mb-4 text-base font-semibold text-ink-900">Uygulamanızı bağlayın</h2>
        {error && (
          <div role="alert" className="mb-4 rounded-sm border-l-2 border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}

        <div className="mb-4 flex gap-4 max-md:flex-col max-md:items-center max-md:text-center">
          {/* QR yerel olarak üretilir; hiçbir harici isteğe konu olmaz */}
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, optimize edilemez ve edilmemeli
            <img
              src={qrDataUrl}
              alt="TOTP QR kodu"
              width={150}
              height={150}
              className="h-[150px] w-[150px] shrink-0 rounded-sm border border-line-300"
            />
          ) : (
            <div className="h-[150px] w-[150px] shrink-0 rounded-sm border border-line-300 bg-fill-100" />
          )}
          <div className="min-w-0 text-[13px] text-ink-600">
            <p className="mb-3">
              Google Authenticator, 1Password veya benzeri bir uygulamayla QR kodu okutun.
            </p>
            <p className="mb-1 text-ink-400">QR okutamıyorsanız anahtarı elle girin:</p>
            <p className="mb-2 font-mono text-xs break-all text-ink-900">{manualKey}</p>
            <div className="flex flex-wrap gap-2 max-md:justify-center">
              <Button
                variant="secondary"
                size="table"
                onClick={() => manualKey && navigator.clipboard.writeText(manualKey.replace(/\s/g, ""))}
              >
                Anahtarı kopyala
              </Button>
            </div>
          </div>
        </div>

        <p className="mb-4 flex items-start gap-1.5 text-xs text-warning">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px shrink-0">
            <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
          Bu anahtarı kimseyle paylaşmayın. Piravel OS ekibi dahil hiç kimse
          sizden bu anahtarı istemez.
        </p>

        <label className="mb-1 block text-[13px] text-ink-600">Uygulamadaki 6 haneli kod</label>
        <OtpInput value={otp} onChange={setOtp} disabled={loading} />

        <Button variant="primary" className="w-full" onClick={qrOnayla} disabled={loading || otp.length < 6}>
          {loading ? "Doğrulanıyor…" : "Devam et"}
        </Button>
        <p className="mt-2 text-center text-xs text-ink-400">Sonraki adım: kurtarma kodları</p>
      </div>
    );
  }

  // ── 3. Kurtarma kodları + üç kapı ──
  return (
    <div>
      <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">2 / 2</div>
      <h2 className="mb-4 text-base font-semibold text-ink-900">Kurtarma kodlarınız</h2>

      <div className="mb-4 rounded-sm border-l-2 border-info bg-info-bg px-3 py-2 text-[13px] text-info">
        Telefonunuzu kaybederseniz hesabınıza tek erişim yolunuz bu kodlardır.
        Her kod bir kez kullanılabilir.
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-sm border border-line-200 bg-fill-100 p-3 font-mono text-xs text-ink-900 max-md:grid-cols-1">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>

      {/* KAPI 1: kopyala VEYA indir */}
      <div className="mb-4 flex gap-2 max-md:flex-col">
        <Button
          variant="secondary"
          className={`flex-1 ${copiedOrDownloaded ? "border-success text-success" : ""}`}
          onClick={kopyala}
        >
          {copiedOrDownloaded ? "Kopyalandı" : "Kodları kopyala"}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={indir}>
          Dosya olarak indir
        </Button>
      </div>

      {/* KAPI 2: onay */}
      <label className="mb-4 flex items-start gap-2 text-[13px] text-ink-600">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          disabled={!copiedOrDownloaded}
          className="mt-0.5 h-4 w-4 shrink-0 accent-navy-900 disabled:opacity-40"
        />
        Kurtarma kodlarını güvenli bir yere kaydettim.
      </label>

      {/* KAPI 3: rastgele kod doğrulaması — TÜM roller için */}
      <div className="mb-4 rounded-sm border border-line-200 bg-fill-100 p-3">
        <label htmlFor="rc" className="mb-1 block text-[13px] font-semibold text-ink-900">
          Doğrulama:{" "}
          <span className="font-normal">{challengeIndex + 1}. kurtarma kodunu girin</span>
        </label>
        <p className="mb-2 text-xs text-ink-400">
          Kodları gerçekten kaydettiğinizden emin olmak için rastgele biri sorulur.
        </p>
        <input
          id="rc"
          autoComplete="off"
          placeholder="xxxx-xxxx"
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
          disabled={!acknowledged}
          className="h-9 w-full rounded-sm border border-line-300 bg-surface px-3 font-mono text-sm outline-none focus:border-navy-500 disabled:opacity-50"
        />
        {challenge.length > 0 && !challengePassed && (
          <p className="mt-1 text-xs text-danger">Kod eşleşmiyor.</p>
        )}
      </div>

      <Button
        variant="primary"
        className={`w-full ${gateOpen ? "" : "opacity-50"}`}
        onClick={tamamla}
        disabled={!gateOpen}
      >
        Kurulumu tamamla
      </Button>
      {!gateOpen && (
        <p className="mt-2 text-center text-xs text-ink-400">
          Kodları kaydedip doğrulama kodunu girene kadar pasiftir.
        </p>
      )}

      <p className="mt-4 border-t border-line-200 pt-3 text-xs text-ink-400">
        Bu kodlar bir daha gösterilmez. Kaybederseniz yeni kod üretebilirsiniz;
        yeni kodlar üretildiğinde eskiler geçersiz olur.
      </p>
    </div>
  );
}
