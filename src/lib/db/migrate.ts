import { migrate } from "drizzle-orm/node-postgres/migrator";
import db from ".";

migrate(db, { migrationsFolder: "drizzle" });
