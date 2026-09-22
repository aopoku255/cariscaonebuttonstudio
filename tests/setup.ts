import "dotenv/config";

/**
 * Integration tests run against the database configured by `DB_HOST` / `DB_PORT` /
 * `DB_USER` / `DB_PASSWORD` / `DB_NAME`. They create their own fixtures with
 * recognisable prefixes and clean up after themselves, so they can run against a
 * development database without destroying seed data.
 */
const missingDbVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"].filter(
  (name) => !process.env[name],
);
if (missingDbVars.length) {
  throw new Error(
    `Missing ${missingDbVars.join(", ")}. Copy .env.example to .env before running the tests.`,
  );
}

// Keep a stable secret so booking access tokens are deterministic across test runs.
process.env.SESSION_SECRET ??= "test-session-secret-not-used-in-production";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
