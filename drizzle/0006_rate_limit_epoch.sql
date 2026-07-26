-- Better Auth rate limit deposu `last_request` alanında EPOCH MİLİSANİYE
-- (sayı) tutar, zaman damgası değil. timestamptz -> bigint dönüşümü örtük
-- yapılamaz; açık USING ifadesi gerekir.
ALTER TABLE "auth_rate_limit"
  ALTER COLUMN "last_request" SET DATA TYPE bigint
  USING (EXTRACT(EPOCH FROM "last_request") * 1000)::bigint;
