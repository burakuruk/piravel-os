"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MIN_PAROLA_UZUNLUGU } from "@/lib/invitation-sabitler";

/**
 * Davet kabul formu.
 *
 * ⚠ Ham token bu bileşene HİÇ ULAŞMAZ — istek yalnız HttpOnly çerezle
 * kimliklenir. Bu yüzden token istemci paketine, React sunucu yükene veya
 * ekran görüntüsüne giremez.
 */
export function DavetFormu({ email, fullName }: { email: string; fullName: string }) {
  const [parola, setParola] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const kisa = parola.length > 0 && parola.length < MIN_PAROLA_UZUNLUGU;
  const uyusmuyor = tekrar.length > 0 && parola !== tekrar;
  const gonderilebilir =
    parola.length >= MIN_PAROLA_UZUNLUGU && parola === tekrar && !gonderiliyor;

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!gonderilebilir) return;
    setGonderiliyor(true);
    setHata(null);
    try {
      const res = await fetch("/api/v1/davet/kabul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: parola }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setHata(json?.error?.message ?? "Bu davet bağlantısı kullanılamıyor.");
        setGonderiliyor(false);
        return;
      }
      // SA/FIN zorunlu 2FA kurulumuna, diğerleri panoya
      window.location.href = json?.next ?? "/";
    } catch {
      setHata("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
      setGonderiliyor(false);
    }
  }

  return (
    <form onSubmit={gonder} noValidate>
      <div className="mb-4">
        <label htmlFor="davet-eposta" className="mb-1 block text-sm text-ink-600">
          E-posta
        </label>
        {/*
          Salt okunur: davet bu adrese üretildi. `readOnly` + `aria-readonly`
          birlikte verilir; `disabled` KULLANILMAZ çünkü ekran okuyucular
          devre dışı alanları atlayabilir ve kullanıcı hangi hesabı
          oluşturduğunu duymaz.
        */}
        <input
          id="davet-eposta"
          type="email"
          value={email}
          readOnly
          aria-readonly="true"
          className="w-full rounded-sm border border-line-300 bg-fill-100 px-3 py-2 text-sm text-ink-600"
        />
        <p className="mt-1 text-xs text-ink-400">
          {fullName} adına oluşturuldu. E-posta değiştirilemez.
        </p>
      </div>

      <div className="mb-4">
        <label htmlFor="davet-parola" className="mb-1 block text-sm text-ink-600">
          Parola
        </label>
        <input
          id="davet-parola"
          type="password"
          autoComplete="new-password"
          value={parola}
          onChange={(e) => setParola(e.target.value)}
          aria-invalid={kisa}
          aria-describedby="davet-parola-yardim"
          className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
        />
        <p id="davet-parola-yardim" className="mt-1 text-xs text-ink-400">
          En az {MIN_PAROLA_UZUNLUGU} karakter.
        </p>
      </div>

      <div className="mb-5">
        <label htmlFor="davet-tekrar" className="mb-1 block text-sm text-ink-600">
          Parola (tekrar)
        </label>
        <input
          id="davet-tekrar"
          type="password"
          autoComplete="new-password"
          value={tekrar}
          onChange={(e) => setTekrar(e.target.value)}
          aria-invalid={uyusmuyor}
          className="w-full rounded-sm border border-line-300 px-3 py-2 text-sm"
        />
        {uyusmuyor && (
          <p className="mt-1 text-xs text-danger">Parolalar eşleşmiyor.</p>
        )}
      </div>

      {hata && (
        <p role="alert" className="mb-4 rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={!gonderilebilir}>
        {gonderiliyor ? "Hesap oluşturuluyor…" : "Hesabımı oluştur"}
      </Button>
    </form>
  );
}
