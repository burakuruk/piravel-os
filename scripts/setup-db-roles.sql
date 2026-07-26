-- ════════════════════════════════════════════════════════════════════════
-- Piravel OS — Uygulama DB rolü ve yetkileri
-- Şema v1.2, Karar 5: audit_logs append-only'dir ve bu, TRIGGER'A EK OLARAK
-- veritabanı yetki seviyesinde de zorlanır.
--
-- İki katmanlı koruma:
--   1) Rol yetkisi : piravel_app'in audit_logs üzerinde UPDATE/DELETE/TRUNCATE
--                    yetkisi YOKTUR → "permission denied" ile reddedilir
--   2) Trigger     : yetkili bir rol (owner) denese bile RAISE EXCEPTION eder
--
-- Çalıştırma: npm run db:roles   (owner/admin bağlantısıyla)
-- İdempotenttir; tekrar tekrar çalıştırılabilir.
-- Parola :app_password parametresiyle dışarıdan gelir (env: APP_DB_PASSWORD).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Rolü oluştur (yoksa) / parolayı güncelle ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'piravel_app') THEN
    EXECUTE format('CREATE ROLE piravel_app LOGIN PASSWORD %L', :'app_password');
  ELSE
    EXECUTE format('ALTER ROLE piravel_app LOGIN PASSWORD %L', :'app_password');
  END IF;
END $$;

-- Uygulama rolü şema/DDL sahibi DEĞİLDİR: tablo oluşturamaz, silemez.
ALTER ROLE piravel_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- ── 2. Bağlantı ve şema erişimi ──
GRANT CONNECT ON DATABASE piravel_os TO piravel_app;
GRANT USAGE ON SCHEMA public TO piravel_app;
-- Şemada yeni nesne yaratamaz (migration'lar owner ile koşar)
REVOKE CREATE ON SCHEMA public FROM piravel_app;

-- ── 3. İş tabloları: tam DML ──
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO piravel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO piravel_app;

-- ── 4. audit_logs: SADECE ekleme ve okuma ──
REVOKE ALL     ON TABLE audit_logs FROM piravel_app;
GRANT  INSERT, SELECT ON TABLE audit_logs TO piravel_app;
-- id bigserial olduğu için sequence'a erişim gerekir (INSERT için)
GRANT  USAGE, SELECT  ON SEQUENCE audit_logs_id_seq TO piravel_app;

-- ── 5. Gelecekte owner'ın oluşturacağı nesneler için varsayılan yetkiler ──
-- (yeni migration'lar tablo eklediğinde bu script'i tekrar çalıştırmak
--  gerekmesin; audit_logs istisnası 4. adımda açıkça korunur)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO piravel_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO piravel_app;

-- ── 6. View'lar salt okunur ──
GRANT SELECT ON v_receivable_totals, v_fx_differences, v_brand_payment_risk TO piravel_app;
