"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DURUM_ETIKET, DURUMLAR } from "./etiketler";

/**
 * Arama + filtre şeridi.
 *
 * Durum URL'dedir, bileşen state'inde değil: kullanıcı filtrelediği listeyi
 * paylaşabilir, geri tuşu çalışır ve CSV bağlantısı aynı parametreleri
 * taşıdığı için dosya ekranda görünenle birebir aynı olur.
 *
 * Form gerçek bir `<form>`: JavaScript yüklenmeden önce de Enter ile arama
 * yapılabilir ve klavye kullanıcısı beklediği davranışı bulur.
 */
export function MarkaFiltreleri({ sektorler }: { sektorler: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  /**
   * Arama kutusu KONTROLSÜZ ve `key`'i URL'deki terim.
   *
   * State ile tutulup efektle URL'e senkronlanırsa geri/ileri tuşunda iki
   * doğruluk kaynağı oluşur ve efekt her gezinmede fazladan render tetikler.
   * `key` değişince React alanı yeniden kurar — geri tuşu kutuyu da geri alır.
   */
  const q = params.get("q") ?? "";
  const durum = params.get("durum") ?? "";
  const sektor = params.get("sektor") ?? "";

  /** Tek parametreyi değiştirip 1. sayfaya döner — filtre değişince 7. sayfada kalmak anlamsızdır. */
  function git(degisiklikler: Record<string, string>) {
    const yeni = new URLSearchParams(params.toString());
    for (const [alan, deger] of Object.entries(degisiklikler)) {
      if (deger) yeni.set(alan, deger);
      else yeni.delete(alan);
    }
    yeni.delete("sayfa");
    router.push(`/markalar${yeni.toString() ? `?${yeni}` : ""}`);
  }

  const filtreVar = Boolean(q || durum || sektor);

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
      <label htmlFor="marka-ara" className="sr-only">
        Marka adı veya kodunda ara
      </label>
      <input
        id="marka-ara"
        key={q}
        name="q"
        defaultValue={q}
        placeholder="Marka adı veya kodunda ara…"
        className="h-9 min-w-[240px] flex-1 rounded-sm border border-line-300 bg-surface px-3 text-sm"
      />

      <label htmlFor="marka-durum" className="sr-only">
        Durum
      </label>
      <select
        id="marka-durum"
        value={durum}
        onChange={(e) => git({ durum: e.target.value })}
        className="h-9 rounded-sm border border-line-300 bg-surface px-3 text-sm"
      >
        <option value="">Durum: Tümü</option>
        {DURUMLAR.map((d) => (
          <option key={d} value={d}>
            {DURUM_ETIKET[d]}
          </option>
        ))}
      </select>

      <label htmlFor="marka-sektor" className="sr-only">
        Sektör
      </label>
      <select
        id="marka-sektor"
        value={sektor}
        onChange={(e) => git({ sektor: e.target.value })}
        className="h-9 rounded-sm border border-line-300 bg-surface px-3 text-sm"
      >
        <option value="">Sektör: Tümü</option>
        {sektorler.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <Button type="submit">Ara</Button>
      {filtreVar && (
        <Button type="button" variant="ghost" onClick={() => router.push("/markalar")}>
          Filtreyi temizle
        </Button>
      )}
    </form>
  );
}
