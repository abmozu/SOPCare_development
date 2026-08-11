import { env } from "cloudflare:workers";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDb() {
  const databaseUrl = (env as unknown as { DATABASE_URL?: string }).DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is unavailable. Configure the Neon PostgreSQL connection string for this environment."
    );
  }

  return drizzle(neon(databaseUrl), { schema });
}
