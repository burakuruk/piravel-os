ALTER TABLE "auth_two_factor" ALTER COLUMN "verified" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "auth_two_factor" ALTER COLUMN "verified" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_two_factor" ADD COLUMN "failed_verification_count" integer DEFAULT 0;