/**
 * Uygulama ekranları için DÜŞÜK/ORTA DETAYLI wireframe iskeleti (06 §16.2).
 *
 * Amaç bilgi mimarisini ve akışı tartışmaya açmak; nihai görsel dil değil.
 * Gerçek bileşenler yerine sade kutular kullanılır ki tartışma "bu buton ne
 * renk olsun" değil "bu ekranda hangi bilgi olmalı" üzerinden yürüsün.
 *
 * ⚠ PRD §6.3: Tüm veriler açıkça sahtedir (`Sahte *`, `example.com`).
 */

export const SAHTE_MARKALAR = [
  { kod: "SVZ", ad: "Sahte Vize A.Ş.", sektor: "Danışmanlık", durum: "Aktif", ton: "success", yetkili: "Sahte Yetkili", hizmet: 3, ekip: 2 },
  { kod: "TKL", ad: "Test Klinik", sektor: "Sağlık", durum: "Aktif", ton: "success", yetkili: "Test Kişi", hizmet: 2, ekip: 1 },
  { kod: "SAJ", ad: "Sahte Ajans", sektor: "Pazarlama", durum: "Aday", ton: "info", yetkili: "—", hizmet: 0, ekip: 0 },
  { kod: "ORN", ad: "Örnek Mimarlık", sektor: "Mimarlık", durum: "Pasif", ton: "muted", yetkili: "Örnek Kişi", hizmet: 1, ekip: 1 },
];

export const SAHTE_HIZMETLER = [
  { kod: "SM", ad: "Sosyal medya yönetimi", birim: "Aylık", aktif: true, marka: 3 },
  { kod: "SEO", ad: "Arama motoru optimizasyonu", birim: "Aylık", aktif: true, marka: 2 },
  { kod: "PR", ad: "Basın ilişkileri", birim: "Aylık", aktif: true, marka: 1 },
  { kod: "PROD", ad: "İçerik prodüksiyon", birim: "Proje", aktif: false, marka: 0 },
];

const TON: Record<string, string> = {
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  muted: "bg-fill-100 text-ink-400",
};

export function Rozet({ ton = "muted", children }: { ton?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-sm px-1.5 text-xs font-medium ${TON[ton] ?? TON.muted}`}>
      {children}
    </span>
  );
}

export function Dugme({
  tur = "ikincil",
  children,
}: {
  tur?: "birincil" | "ikincil" | "yikici";
  children: React.ReactNode;
}) {
  const sinif =
    tur === "birincil"
      ? "bg-navy-900 text-white"
      : tur === "yikici"
        ? "bg-danger text-white"
        : "border border-line-300 bg-surface text-navy-900";
  return (
    <span className={`inline-flex h-9 items-center rounded-sm px-4 text-sm font-medium ${sinif}`}>
      {children}
    </span>
  );
}

/**
 * SALT OKUNUR bilgi satırı — düz metin, kutu YOK.
 *
 * Detay ekranında değerler input gibi görünmez: çerçeveli bir kutu kullanıcıya
 * "buraya yazabilirim" der ve tıklayınca hiçbir şey olmaz. Girdi, seçim ve
 * form alanları yalnız "Düzenle" modunda çıkar. `Alan` (kutulu) bu yüzden
 * yalnız form ekranlarında kullanılır.
 */
export function Bilgi({ etiket, deger, genis }: { etiket: string; deger?: string; genis?: boolean }) {
  return (
    <div className={genis ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-ink-400">{etiket}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{deger ?? "—"}</dd>
    </div>
  );
}

export function Alan({ etiket, deger, genis }: { etiket: string; deger?: string; genis?: boolean }) {
  return (
    <div className={genis ? "col-span-2" : ""}>
      <div className="mb-1 text-sm text-ink-600">{etiket}</div>
      <div className="flex h-9 items-center rounded-sm border border-line-300 bg-surface px-3 text-sm text-ink-400">
        {deger ?? "—"}
      </div>
    </div>
  );
}

export function Kart({
  baslik,
  eylem,
  children,
}: {
  baslik: string;
  eylem?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-line-200 bg-surface">
      <div className="flex items-center justify-between border-b border-line-200 px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">{baslik}</h2>
        {eylem}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Sahte sidebar + topbar; gerçek navigasyonun yerini tutar. */
export function AppWire({
  baslik,
  aciklama,
  aktif = "Markalar",
  ustEylem,
  children,
}: {
  baslik: string;
  aciklama?: string;
  aktif?: string;
  ustEylem?: React.ReactNode;
  children: React.ReactNode;
}) {
  const menu = [
    ["GENEL", ["Dashboard"]],
    ["MÜŞTERİ", ["Markalar", "Hizmetler", "Sözleşmeler"]],
    ["FİNANS", ["Alacaklar", "Giderler"]],
    ["SİSTEM", ["Kullanıcılar", "Oturumlarım"]],
  ] as const;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-[248px] shrink-0 flex-col bg-navy-900 max-lg:hidden">
        <div className="flex items-baseline px-5 py-5">
          <span className="font-display text-lg font-semibold tracking-wide text-gold-500">
            PIRAVEL
          </span>
          <span className="ml-1.5 text-lg font-light text-shell-muted">OS</span>
        </div>
        <nav className="px-2">
          {menu.map(([grup, ogeler]) => (
            <div key={grup} className="mb-4">
              <div className="px-3 pb-1 text-[11px] tracking-widest text-shell-muted">{grup}</div>
              {ogeler.map((o) => (
                <div
                  key={o}
                  className={`rounded-sm px-3 py-2 text-sm ${
                    o === aktif ? "bg-navy-800 text-white" : "text-shell-text"
                  }`}
                >
                  {o}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-line-200 bg-surface px-6">
          <span className="text-sm text-ink-600">{baslik}</span>
          <span className="h-8 w-56 rounded-sm border border-line-300 bg-fill-100" />
        </div>

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-6 lg:px-8">
          {/*
            Mobilde başlık ve işlem butonları AYNI SATIRA sıkıştırılmaz: başlık
            üstte tam genişlikte, butonlar altında ayrı satırda. 375 px'te
            "Sahte Vize A.Ş." + Düzenle + Pasifleştir yan yana sığmıyor ve
            başlık kırpılıyordu.
          */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-900">{baslik}</h1>
              <div className="mt-1 h-0.5 w-10 bg-gold-500" />
              {aciklama && <p className="mt-2 max-w-[68ch] text-sm text-ink-400">{aciklama}</p>}
            </div>
            {ustEylem && <div className="flex flex-wrap gap-2">{ustEylem}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
