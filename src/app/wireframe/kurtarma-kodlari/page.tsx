/**
 * ZORUNLU 2FA KURULUMU — 2/2: kurtarma kodları (wireframe)
 *
 * Kapı mantığı — 2FA kuran HER kullanıcı için aynıdır (rol farkı yoktur):
 *   1) Kullanıcı KOPYALA veya İNDİR işlemlerinden en az birini yapar
 *   2) "Güvenli bir yere kaydettim" onayını verir
 *   3) Sistemin rastgele seçtiği bir kurtarma kodu tekrar girilir
 *   → üçü tamamlanmadan "Kurulumu tamamla" pasiftir
 *
 * Rol yalnızca 2FA'nın ZORUNLU olup olmadığını belirler (SA/FIN zorunlu,
 * OPS/MEM isteğe bağlı); kuruluma başlayan herkes aynı güvenli akışı tamamlar.
 *
 * Ekranda gösterilen an: kodlar kopyalanmış, onay verilmiş, doğrulama bekleniyor.
 * Kodlar açıkça sahtedir (PRD §6.3).
 */
import { AuthShell, Button, Checkbox, Notice, RecoveryCodes, SAHTE } from "../_components";

const CODES = SAHTE.kurtarmaKodlari;

export default function KurtarmaKodlariWireframe() {
  return (
    <AuthShell step="GÜVENLİK KURULUMU — 2 / 2" title="Kurtarma kodlarınız">
      <Notice tone="info">
        Telefonunuzu kaybederseniz hesabınıza tek erişim yolunuz bu kodlardır.
        Her kod bir kez kullanılabilir.
      </Notice>

      <RecoveryCodes codes={[...CODES]} />

      {/* Kopyala VEYA indir — en az biri */}
      <div className="mb-4 flex gap-2 max-md:flex-col">
        <Button variant="secondary" className="flex-1 border-success text-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Kopyalandı
        </Button>
        <Button variant="secondary" className="flex-1">
          Dosya olarak indir
        </Button>
      </div>

      <Checkbox checked>Kurtarma kodlarını güvenli bir yere kaydettim.</Checkbox>

      {/* Rastgele kod doğrulaması — 2FA kuran TÜM kullanıcılar için */}
      <div className="mb-4 rounded-sm border border-line-200 bg-fill-100 p-3">
        <label htmlFor="rc-challenge" className="mb-1 block text-[13px] font-semibold text-ink-900">
          Doğrulama: <span className="font-normal">3. kurtarma kodunu girin</span>
        </label>
        <p className="mb-2 text-xs text-ink-400">
          Kodları gerçekten kaydettiğinizden emin olmak için rastgele biri sorulur.
        </p>
        <input
          id="rc-challenge"
          name="recovery-code"
          autoComplete="off"
          placeholder="xxxx-xxxx"
          readOnly
          className="h-9 w-full rounded-sm border border-navy-500 bg-surface px-3 font-mono text-sm text-ink-900 outline-none ring-2 ring-navy-500/25 placeholder:text-ink-400"
        />
      </div>

      <Button variant="primary" className="w-full opacity-50">
        Kurulumu tamamla
      </Button>
      <p className="mt-2 text-center text-xs text-ink-400">
        Kod doğrulanana kadar pasiftir.
      </p>

      <p className="mt-4 border-t border-line-200 pt-3 text-xs text-ink-400">
        Bu kodlar bir daha gösterilmez. Kaybederseniz yeni kod üretebilirsiniz;
        yeni kodlar üretildiğinde eskiler geçersiz olur.
      </p>
    </AuthShell>
  );
}
