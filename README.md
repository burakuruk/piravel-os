# Piravel OS

Ajans, finans, müşteri ve operasyon yönetim sistemi. Tek kiracı, iç kullanım.

**Durum:** Sprint 0 tamamlandı (altyapı + tasarım sistemi temeli).

## Kurulum

```bash
npm install
cp .env.example .env
docker compose up -d          # PostgreSQL 16
npm run db:migrate            # Şema v1.2 (idempotent)
npm run dev                   # http://localhost:3000
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm test` | Vitest birim testleri |
| `npm run typecheck` | TypeScript strict kontrolü |
| `npm run db:generate` | Şema değişikliğinden migration üret |
| `npm run db:migrate` | Migration'ları uygula |

## Dokümantasyon

Kod yazmadan önce ilgili dokümanı okuyun — tasarım kararları oradadır.

| Doküman | İçerik |
|---|---|
| [docs/00-PRD.md](docs/00-PRD.md) | Ürün gereksinimleri, kapsam, kabul kriterleri |
| [docs/01-veritabani-semasi.md](docs/01-veritabani-semasi.md) | Şema v1.2, tasarım kararları, senaryolar |
| [docs/02-yetki-matrisi.md](docs/02-yetki-matrisi.md) | Rol × kaynak × işlem |
| [docs/03-api-endpointleri.md](docs/03-api-endpointleri.md) | Endpoint sözleşmesi |
| [docs/04-sprint-plani.md](docs/04-sprint-plani.md) | Geliştirme sırası, test listesi |
| [docs/05-backlog.md](docs/05-backlog.md) | MVP dışı özellikler |
| [docs/06-ui-ux-tasarim-sistemi.md](docs/06-ui-ux-tasarim-sistemi.md) | Görsel yön, token'lar, ekran tasarımları |

## Pazarlıksız kurallar

1. **Tutar aritmetiği yalnızca `src/lib/money.ts`'te.** Float tutar yasak; her şey kuruş integer.
2. **ID'ler `newId()` (UUID v7) ile uygulamada üretilir.** DB default'una güvenilmez.
3. **Audit, iş işlemiyle aynı transaction'da yazılır.** `audit_logs` append-only (DB trigger'ı korur).
4. **Soft delete varsayılan filtre.** Finansal kayıtlar asla fiziksel silinmez.
5. **Yetki API katmanında.** UI gizlemesi yetki değildir.
6. **Allocation değişmez.** Düzeltme = reversal + yeni kayıt.
