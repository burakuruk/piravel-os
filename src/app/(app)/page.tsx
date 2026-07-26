import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canSeeAmounts } from "@/lib/auth-policy";
import { requireUser } from "@/lib/authz";
import { cn } from "@/lib/utils";

/** Placeholder işaretleri yalnız geliştirmede görünür; gerçek veri bağlanınca kalkar. */
const isDev = process.env.NODE_ENV === "development";

/**
 * Dashboard — DÜŞÜK DETAYLI TASLAK WIREFRAME (Sprint 0 çıktısı, 06 §16.2).
 * Veriler örnek/placeholder'dır; gerçek agregasyon Sprint 6'da bağlanır.
 * Layout: metrik şeridi (kart DEĞİL, çizgiyle ayrılmış) → dikkat listesi +
 * banka özeti → grafik alanı.
 */

const metrics = [
  { label: "Beklenen (bu ay)", value: "86.000,00 ₺", tone: "" },
  { label: "Tahsil edilen", value: "52.000,00 ₺", tone: "" },
  { label: "Gecikmiş alacak", value: "17.500,00 ₺", tone: "text-danger" },
  { label: "Net nakit", value: "+18.400,00 ₺", tone: "" },
];

const attention = [
  { text: "Vis Vize — Ağustos tahsilatı 5 gün gecikti", badge: "Gecikti", variant: "danger" as const },
  { text: "Halkalı Doktor sözleşmesi 22 gün sonra bitiyor", badge: "Sözleşme", variant: "warning" as const },
  { text: "Adobe CC ödemesi yarın", badge: "Ödeme", variant: "warning" as const },
  { text: "Eylül içerik planı görevi teslim tarihini geçti", badge: "Görev", variant: "danger" as const },
];

const accounts = [
  { name: "Garanti TL Vadesiz", balance: "142.350,00 ₺" },
  { name: "İş Bankası USD", balance: "3.120,00 $" },
  { name: "Nakit Kasa", balance: "4.500,00 ₺" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  /**
   * Finans bölümleri OPS/MEM için HİÇ RENDER EDİLMEZ (docs/02 §5).
   * Gizlemek değil, sunucudan hiç göndermemek esastır — HTML kaynağında bile
   * tutar bulunmaz.
   */
  const finansGorunur = canSeeAmounts(user.role);

  return (
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-6">
          {/* Sayfa başlığı: tek display, altında ince altın çizgi (06 §3) */}
          <div className="mb-6">
            <h1 className="font-display text-[28px] leading-[34px] font-medium text-ink-900">
              Genel Bakış
            </h1>
            <div className="mt-2 h-px w-10 bg-gold-500" />
          </div>

          {/* Metrik şeridi — kart değil, çizgiyle ayrılmış sade sayılar.
              Mobilde 2×2 ve kompakt: dikey padding düşer, satır boşluğu yerine
              hafif yatay ayraç kullanılır. Tutar boyutu korunur. */}
          {finansGorunur && (
          <Card className="mb-6">
            <div className="grid grid-cols-4 divide-x divide-line-200 max-md:grid-cols-2 max-md:divide-x-0">
              {metrics.map((m, i) => (
                <div
                  key={m.label}
                  className={cn(
                    "px-5 py-4 max-md:px-4 max-md:py-2.5",
                    i >= 2 && "max-md:border-t max-md:border-line-200",
                  )}
                >
                  <div className="text-xs font-medium tracking-wide text-ink-600">{m.label}</div>
                  {/* Tutarlar asla satır sarmaz (06 §10) */}
                  <div
                    className={cn(
                      "mt-1 whitespace-nowrap text-[22px] leading-7 font-semibold tnum max-md:text-[19px]",
                      m.tone,
                    )}
                    data-amount
                  >
                    {m.value}
                  </div>
                  {isDev && <div className="mt-0.5 text-xs text-ink-400">örnek veri</div>}
                </div>
              ))}
            </div>
          </Card>
          )}

          <div className="grid grid-cols-12 gap-6">
            {/* Dikkat gerektirenler — önem sıralı tek birleşik liste.
                OPS/MEM yalnız kendi işlerini görür (Sprint 6'da gerçek veriye bağlanır). */}
            <Card className={cn(finansGorunur ? "col-span-7" : "col-span-12", "max-lg:col-span-12")}>
              <CardHeader>
                <CardTitle>Dikkat gerektirenler</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <ul className="divide-y divide-line-200">
                  {attention.map((item) => (
                    <li key={item.text} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <Badge variant={item.variant}>{item.badge}</Badge>
                      <span className="text-ink-900">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Banka özeti — yalnız finans rolleri */}
            {finansGorunur && (
            <Card className="col-span-5 max-lg:col-span-12">
              <CardHeader>
                <CardTitle>Banka & Kasa</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <ul className="divide-y divide-line-200">
                  {accounts.map((a) => (
                    <li key={a.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <span className="text-ink-600">{a.name}</span>
                      <span className="font-semibold tnum" data-amount>
                        {a.balance}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Toplam satırı: üstte 2px koyu çizgi — muhasebe geleneği (06 §9) */}
                <div className="flex items-center justify-between border-t-2 border-ink-900 px-5 py-2.5 text-sm font-semibold">
                  <span>Toplam (₺ karşılığı)</span>
                  <span className="tnum" data-amount>
                    257.050,00 ₺
                  </span>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Nakit akışı grafiği — Sprint 6'da Recharts ile bağlanır */}
            {finansGorunur && (
            <Card className="col-span-12">
              <CardHeader>
                <CardTitle>Nakit akışı (90 gün)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-44 items-center justify-center rounded-sm border border-dashed border-line-300 bg-fill-100 text-sm text-ink-400">
                  Grafik alanı — gerçekleşen (düz) + beklenen (kesikli) çizgi · Sprint 6
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </main>
  );
}
