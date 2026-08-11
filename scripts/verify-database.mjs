import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Load the protected development secret before running this check.");
}

if (process.env.APP_ENV !== "development") {
  throw new Error("Refusing to verify a database unless APP_ENV=development.");
}

const target = new URL(databaseUrl);
if (!target.hostname.endsWith(".neon.tech")) {
  throw new Error("Refusing to connect because DATABASE_URL is not a Neon endpoint.");
}

const sql = neon(databaseUrl);
const [identity] = await sql`
  SELECT
    current_database() AS database_name,
    current_user AS database_user,
    current_setting('server_version') AS server_version
`;

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

console.log(JSON.stringify({
  connected: true,
  endpoint: target.hostname,
  database: identity.database_name,
  user: identity.database_user,
  serverVersion: identity.server_version,
  publicTableCount: tables.length,
}, null, 2));
