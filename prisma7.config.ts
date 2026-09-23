// Prisma CLI configuration. `dotenv/config` is required because Prisma 7 no longer
// loads .env automatically.
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * The CLI (migrate, studio, db seed) still needs a connection-string URL, unlike the
 * app runtime in `src/lib/db.ts`, which connects with discrete host/port/user/password
 * fields. Built here from the same `DB_*` variables so there is one source of truth,
 * with the user and password percent-encoded in case either contains reserved URL
 * characters (`@`, `:`, `/`, `?`, `#`, etc).
 */
function cliDatabaseUrl(database: string | undefined): string | undefined {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !database) return undefined;

  const user = encodeURIComponent(DB_USER);
  const password = encodeURIComponent(DB_PASSWORD);
  const port = DB_PORT || "3306";
  return `mysql://${user}:${password}@${DB_HOST}:${port}/${database}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: cliDatabaseUrl(process.env.DB_NAME),
    // Shared hosting typically grants the app user rights on its own database only,
    // not global CREATE DATABASE — so `migrate dev` can't spin up a shadow database
    // on the fly. DB_SHADOW_NAME must point to a second, empty database that the same
    // user has been granted privileges on. See https://pris.ly/d/migrate-shadow.
    shadowDatabaseUrl: cliDatabaseUrl(process.env.DB_SHADOW_NAME),
  },
});
