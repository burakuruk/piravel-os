import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migration'lar OWNER ile koşar (DDL yetkisi gerekir).
    // Uygulama runtime'ı kısıtlı piravel_app rolünü kullanır (DATABASE_URL).
    url:
      process.env.DATABASE_ADMIN_URL ??
      "postgres://piravel:piravel@localhost:5432/piravel_os",
  },
  verbose: true,
  strict: true,
});
