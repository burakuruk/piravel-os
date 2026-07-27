"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Tek seferlik davet bağlantısı gösterimi.
 *
 * ⚠ Bu bağlantı BİR KEZ gösterilir. Sunucu onu hiçbir okuma yanıtında
 * döndürmez (yalnız HMAC'i saklanır), bu yüzden sayfa kapanırsa bağlantı
 * geri getirilemez — yalnız yenisi üretilebilir.
 *
 * Bağlantı bir kimlik bilgisidir: kopyala düğmesi dışında hiçbir yere
 * gönderilmez, analitiğe veya log'a yazılmaz.
 */
export function DavetBaglantisi({
  url,
  expiresAt,
  email,
  geriHref,
  onKapat,
}: {
  url: string;
  expiresAt: string;
  email: string;
  geriHref?: string;
  onKapat?: () => void;
}) {
  const [kopyalandi, setKopyalandi] = useState(false);

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(url);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2500);
    } catch {
      /* Pano erişimi yoksa kullanıcı metni elle seçebilir */
    }
  }

  return (
    <div className="rounded-md border border-line-200 bg-surface p-5">
      <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">
        TEK SEFERLİK BAĞLANTI
      </div>
      <h2 className="mb-3 text-lg font-semibold text-ink-900">Davet bağlantısı hazır</h2>

      <p className="mb-4 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
        Bu bağlantı yalnız şimdi gösterilir. Sayfadan ayrılırsanız geri
        getirilemez; yalnız yeni bir davet üretebilirsiniz.
      </p>

      <p className="mb-1 text-sm text-ink-600">
        <span className="text-ink-400">Alıcı:</span> {email}
      </p>
      <p className="mb-4 text-sm text-ink-600">
        <span className="text-ink-400">Son geçerlilik:</span>{" "}
        {new Date(expiresAt).toLocaleString("tr-TR")}
      </p>

      <label htmlFor="davet-url" className="mb-1 block text-sm text-ink-600">
        Bağlantı
      </label>
      <textarea
        id="davet-url"
        readOnly
        rows={2}
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="mb-3 w-full rounded-sm border border-line-300 bg-fill-100 px-3 py-2 font-mono text-xs text-ink-600"
      />

      <div className="flex items-center justify-between">
        <Button onClick={kopyala}>{kopyalandi ? "✓ Kopyalandı" : "Bağlantıyı kopyala"}</Button>
        {geriHref ? (
          <Link href={geriHref}>
            <Button variant="primary">Kullanıcı listesine dön</Button>
          </Link>
        ) : (
          <Button variant="primary" onClick={onKapat}>
            Kapat
          </Button>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-400">
        Bağlantıyı yalnız alıcıya, güvenli bir kanaldan iletin. Piravel OS ekibi
        dahil hiç kimse sizden bu bağlantıyı istemez.
      </p>
    </div>
  );
}
