-- Şema v1.2 — Drizzle'ın ifade edemediği kısıtlar, trigger'lar, view'lar, seed

-- ══ CHECK kısıtları ══
ALTER TABLE "exchange_rates" ADD CONSTRAINT "chk_fx_rate_pos" CHECK (rate > 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "chk_service_prices" CHECK (
  list_price_minor >= 0 AND min_price_minor >= 0 AND est_cost_minor >= 0
  AND min_price_minor <= list_price_minor);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_amount" CHECK (amount_minor >= 0 AND discount_minor >= 0);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_dates" CHECK (end_date IS NULL OR end_date >= start_date);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_payment_day" CHECK (payment_day IS NULL OR payment_day BETWEEN 1 AND 31);--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "chk_rr_interval" CHECK (interval_count >= 1);--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "chk_rr_dom" CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31);--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "chk_rr_dates" CHECK (ends_on IS NULL OR ends_on >= starts_on);--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "chk_template_amount" CHECK (amount_minor > 0);--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "chk_receivable_needs_brand" CHECK (
  target_type <> 'receivable' OR brand_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "chk_payable_needs_category" CHECK (
  target_type <> 'payable' OR category_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "chk_recv_amount" CHECK (amount_minor > 0 AND paid_minor >= 0);--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "chk_pay_amount" CHECK (amount_minor > 0 AND paid_minor >= 0);--> statement-breakpoint
ALTER TABLE "tax_lines" ADD CONSTRAINT "chk_tax_one_target" CHECK (
  (receivable_id IS NOT NULL AND payable_id IS NULL) OR
  (receivable_id IS NULL AND payable_id IS NOT NULL));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "chk_tx_amount" CHECK (amount_minor > 0);--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "chk_alloc_amounts" CHECK (tx_amount_minor > 0 AND ob_amount_minor > 0);--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "chk_one_target" CHECK (
  (receivable_id IS NOT NULL AND payable_id IS NULL) OR
  (receivable_id IS NULL AND payable_id IS NOT NULL));--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "chk_reversal_complete" CHECK (
  (reversed_at IS NULL AND reversed_by_id IS NULL) OR
  (reversed_at IS NOT NULL AND reversed_by_id IS NOT NULL AND reversal_reason IS NOT NULL));--> statement-breakpoint

-- ══ Self-FK'ler ══
ALTER TABLE "transactions" ADD CONSTRAINT "fk_tx_transfer_pair"
  FOREIGN KEY (transfer_pair_id) REFERENCES transactions(id);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "fk_tx_refund_of"
  FOREIGN KEY (refund_of_transaction_id) REFERENCES transactions(id);--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "fk_expcat_parent"
  FOREIGN KEY (parent_id) REFERENCES expense_categories(id);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "fk_task_parent" FOREIGN KEY (parent_id) REFERENCES tasks(id);--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "fk_attachment_replaces"
  FOREIGN KEY (replaces_id) REFERENCES attachments(id);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "fk_users_brand" FOREIGN KEY (brand_id) REFERENCES brands(id);--> statement-breakpoint

-- ══ DB yedek default'u: manuel SQL için gen_random_uuid (uygulama daima v7 üretir) ══
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'exchange_rates','users','brands','brand_contacts','brand_users','services',
    'recurrence_rules','contracts','contract_items','recurring_templates',
    'expense_categories','vendors','receivables','payables','tax_lines',
    'bank_accounts','transactions','allocations','tasks','attachments','notifications']
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()', t);
  END LOOP;
END $$;--> statement-breakpoint

-- ══ updated_at trigger'ı (şema §16) ══
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','brands','brand_contacts','services','recurrence_rules','contracts',
    'contract_items','recurring_templates','vendors','receivables','payables',
    'bank_accounts','transactions','tasks']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_touch_%s BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      t, t);
  END LOOP;
END $$;--> statement-breakpoint

-- ══ Karar 7: hareket para birimi = hesap para birimi (şema §10.2) ══
CREATE OR REPLACE FUNCTION enforce_tx_currency() RETURNS trigger AS $$
DECLARE acct_currency char(3);
BEGIN
  SELECT currency_code INTO acct_currency FROM bank_accounts WHERE id = NEW.bank_account_id;
  IF NEW.currency_code <> acct_currency THEN
    RAISE EXCEPTION 'Hareket para birimi (%) hesap para birimiyle (%) uyuşmuyor',
      NEW.currency_code, acct_currency;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trg_tx_currency
  BEFORE INSERT OR UPDATE OF currency_code, bank_account_id ON transactions
  FOR EACH ROW EXECUTE FUNCTION enforce_tx_currency();--> statement-breakpoint

-- ══ Karar 5: audit_logs append-only (şema §14) ══
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_logs değiştirilemez (append-only)'; END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();--> statement-breakpoint

-- ══ View'lar (şema §9.1, §10.3, §5.1) ══
CREATE VIEW v_receivable_totals AS
SELECT
  r.id,
  r.amount_minor                                 AS net_minor,
  COALESCE(SUM(t.tax_minor), 0)                  AS tax_total_minor,
  r.amount_minor + COALESCE(SUM(t.tax_minor), 0) AS collectible_minor,
  r.paid_minor,
  r.amount_minor + COALESCE(SUM(t.tax_minor), 0) - r.paid_minor AS balance_minor
FROM receivables r
LEFT JOIN tax_lines t ON t.receivable_id = r.id
WHERE r.deleted_at IS NULL
GROUP BY r.id;--> statement-breakpoint
CREATE VIEW v_fx_differences AS
SELECT
  r.id AS receivable_id,
  r.brand_id,
  r.currency_code,
  r.paid_base_minor - ROUND(r.fx_rate * r.paid_minor) AS fx_diff_base_minor
FROM receivables r
WHERE r.currency_code <> 'TRY' AND r.paid_minor > 0 AND r.deleted_at IS NULL;--> statement-breakpoint
CREATE VIEW v_brand_payment_risk AS
SELECT
  r.brand_id,
  COUNT(*)                                     AS overdue_count,
  SUM(r.amount_base_minor - r.paid_base_minor) AS overdue_base_minor,
  MAX(CURRENT_DATE - r.due_date)               AS max_overdue_days,
  CASE
    WHEN MAX(CURRENT_DATE - r.due_date) > 60 THEN 'critical'
    WHEN MAX(CURRENT_DATE - r.due_date) > 30 THEN 'high'
    ELSE 'warning'
  END AS risk_level
FROM receivables r
WHERE r.due_date < CURRENT_DATE
  AND r.status IN ('pending', 'partially_paid', 'overdue')
  AND r.deleted_at IS NULL
GROUP BY r.brand_id;--> statement-breakpoint

-- ══ Seed: para birimleri + gider kategorileri + ayarlar ══
INSERT INTO currencies (code, name, symbol) VALUES
  ('TRY', 'Türk Lirası', '₺'), ('USD', 'Amerikan Doları', '$'), ('EUR', 'Euro', '€')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO expense_categories (id, code, name, is_direct_cost, sort_order) VALUES
  (gen_random_uuid(), 'personel', 'Personel', false, 1),
  (gen_random_uuid(), 'freelancer', 'Freelancer', true, 2),
  (gen_random_uuid(), 'yazilim_abonelik', 'Yazılım Abonelikleri', false, 3),
  (gen_random_uuid(), 'sunucu_domain_hosting', 'Sunucu / Domain / Hosting', true, 4),
  (gen_random_uuid(), 'reklam_harcamasi', 'Reklam Harcaması', true, 5),
  (gen_random_uuid(), 'ofis', 'Ofis', false, 6),
  (gen_random_uuid(), 'vergi', 'Vergiler', false, 7),
  (gen_random_uuid(), 'bagkur', 'Bağ-Kur', false, 8),
  (gen_random_uuid(), 'muhasebe', 'Muhasebe', false, 9),
  (gen_random_uuid(), 'iletisim', 'Telefon / İnternet', false, 10),
  (gen_random_uuid(), 'ekipman', 'Ekipman', false, 11),
  (gen_random_uuid(), 'ulasim', 'Ulaşım', false, 12),
  (gen_random_uuid(), 'yemek', 'Yemek', false, 13),
  (gen_random_uuid(), 'banka_masrafi', 'Banka Masrafları', false, 14),
  (gen_random_uuid(), 'diger', 'Diğer', false, 99)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO settings (key, value, description) VALUES
  ('base_currency', '"TRY"', 'Baz para birimi — MVP arayüzünden değiştirilemez'),
  ('recurrence_horizon_days', '90', 'Recurrence motoru ufuk penceresi (gün)'),
  ('vat_default_rate', '20', 'Varsayılan KDV oranı (%)'),
  ('notification_days', '{"receivable_due": [7,3,1], "receivable_overdue": [1,7,15,30], "payable_due": [3,1], "contract_expiring": [60,30,7]}', 'Bildirim eşikleri')
ON CONFLICT DO NOTHING;

-- NOT: "REVOKE UPDATE, DELETE ON audit_logs FROM <app_rolü>" deploy aşamasında,
-- uygulamaya özel DB rolü oluşturulduğunda uygulanır. Trigger koruması buradan aktiftir.