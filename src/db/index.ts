import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://piravel:piravel@localhost:5432/piravel_os",
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { schema };
