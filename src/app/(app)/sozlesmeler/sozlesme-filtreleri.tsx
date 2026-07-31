"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DURUM_ETIKET, DURUMLAR } from "./etiketler";

/**
 * Arama + filtre şeridi.
 *
 * Marka modülüyle aynı ilke: durum URL'dedir, bileşen state'inde değil.
 * Kullanıcı filtrelediği listeyi paylaşabilir, geri tuşu çalışır ve CSV
 * bağlantısı aynı parametreleri taşıdığı için dosya ekranda görünenle birebir
 * aynı olur.
 */
export function SozlesmeFiltreleri({
  markalar,
}: {
  markalar: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const durum = params.get("durum") ?? "";
  const marka = params.get("marka") ?? "";
  const yenileme = params.get("yenileme") ?? "";

  function git(degisiklikler: Record<string, string>) {
    const yeni = new URLSearchParams(params.toString());
    for (const [alan, deger] of Object.entries(degisiklikler)) {
      if (deger) yeni.set(alan, deger);
      else yeni.delete(alan);
    }
    // Filtre değişince 7. sayfada kalmak anlamsızdır
    yeni.delete("sayfa");
    router.push(`/sozlesmeler${yeni.toString() ? `?${yeni}` : ""}`);
  }

  const filtreVar = Boolean(q || durum || marka || yenileme);

  return (
    <form
      className="mb-4 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const veri = new FormData(e.currentTarget);
        git({ q: String(veri.get("q") ?? "").trim() });
      }}
      role="search"
    >
      <label htmlFor="sozlesme-ara" className="sr-only">
        Sözleşme numarası veya başlıkta ara
      </label>
      <input
        id="sozlesme-ara"
        /* Kontrolsüz alan; key URL'deki terim — geri tuşu kutuyu da geri alır */
        key={q}
        name="q"
        defaultValue={q}
        placeholder="Sözleşme numarası veya başlıkta ara…"
        className="h-9 min-w-[240px] flex-1 rounded-sm border border-line-300 bg-surface px-3 text-sm max-sm:min-h-11"
      />

      <label htmlFor="sozlesme-durum" className="sr-only">
        Durum
      </label>
      <select
        id="sozlesme-durum"
        value={durum}
        onChange={(e) => git({ durum: e.target.value })}
        className="h-9 rounded-sm border border-line-300 bg-surface px-3 text-sm max-sm:min-h-11"
      >
        <option value="">Durum: Tümü</option>
        {DURUMLAR.map((d) => (
          <option key={d} value={d}>
            {DURUM_ETIKET[d]}
          </option>
        ))}
      </select>

      <label htmlFor="sozlesme-marka" className="sr-only">
        Marka
      </label>
      <select
        id="sozlesme-marka"
        value={marka}
        onChange={(e) => git({ marka: e.target.value })}
        className="h-9 rounded-sm border border-line-300 bg-surface px-3 text-sm max-sm:min-h-11"
      >
        <option value="">Marka: Tümü</option>
        {markalar.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <label htmlFor="sozlesme-yenileme" className="sr-only">
        Yenileme
      </label>
      <select
        id="sozlesme-yenileme"
        value={yenileme}
        onChange={(e) => git({ yenileme: e.target.value })}
        className="h-9 rounded-sm border border-line-300 bg-surface px-3 text-sm max-sm:min-h-11"
      >
        <option value="">Yenileme: Tümü</option>
        <option value="7">7 gün içinde</option>
        <option value="30">30 gün içinde</option>
        <option value="60">60 gün içinde</option>
      </select>

      <Button type="submit">Ara</Button>
      {filtreVar && (
        <Button type="button" onClick={() => router.push("/sozlesmeler")}>
          Filtreleri temizle
        </Button>
      )}
    </form>
  );
}
