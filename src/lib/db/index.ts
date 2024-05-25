import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";

import pg from "pg";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new pg.Pool({
  connectionString: process.env.DB_URL,
});

const db = drizzle(pool);

export default db;
