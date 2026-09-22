import "server-only";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 requires an explicit driver adapter for SQL databases. The MariaDB adapter
 * speaks the MySQL wire protocol and works against both MySQL and MariaDB servers.
 *
 * The client is cached on `globalThis` so Next.js hot reloads in development do not
 * open a new connection pool on every edit.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const { host, port, user, password, database } = readDbCredentials();

  const adapter = new PrismaMariaDb(
    { host, port, user, password, database },
    {
      // Paystack reconciliation and audit logs read back JSON columns; the text
      // protocol returns them consistently across MySQL and MariaDB.
      useTextProtocol: true,
    },
  );

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Credentials are kept as separate host/port/user/password/database fields rather than
 * a single connection string, so a password containing `@`, `:` or `/` never needs
 * URL-encoding.
 */
function readDbCredentials() {
  const missing = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"].filter(
    (name) => !process.env[name],
  );
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(", ")}. Copy .env.example to .env and point it at your MySQL server.`,
    );
  }

  return {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  };
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
