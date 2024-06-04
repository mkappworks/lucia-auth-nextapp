import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

const db = drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;

export default db;
