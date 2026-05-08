// apps/landing/lib/db/index.ts — Database connection for landing app
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://shiftledger:shiftledger@localhost:5432/shiftledger";

const client = postgres(DATABASE_URL);
export const db = drizzle(client, { schema });
export { schema };
