import "server-only";

/**
 * Server-side environment access.
 *
 * Values are read lazily so that a missing optional variable never breaks the build -
 * it only fails when a feature that genuinely needs it is used. Anything secret must be
 * read through here and never re-exported to a Client Component.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const serverEnv = {
  get dbHost() {
    return required("DB_HOST");
  },
  get dbPort() {
    return Number(optional("DB_PORT", "3306"));
  },
  get dbUser() {
    return required("DB_USER");
  },
  get dbPassword() {
    return required("DB_PASSWORD");
  },
  get dbName() {
    return required("DB_NAME");
  },
  get paystackSecretKey() {
    return required("PAYSTACK_SECRET_KEY");
  },
  get paystackCallbackUrl() {
    return optional("PAYSTACK_CALLBACK_URL", `${appUrl()}/booking/callback`);
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get adminEmail() {
    return optional("ADMIN_EMAIL", "studio@carisca.org");
  },
  get emailFrom() {
    return optional("EMAIL_FROM", "One Button Studio <studio@carisca.org>");
  },
  get emailServer() {
    return optional("EMAIL_SERVER");
  },
  get cronSecret() {
    return optional("CRON_SECRET");
  },
};

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** True when Paystack credentials are present, so the UI can degrade gracefully. */
export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/** True when an SMTP connection string is configured. Otherwise mail is logged only. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER);
}
