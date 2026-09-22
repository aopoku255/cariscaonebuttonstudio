# CARISCA Content Studio

A full-stack booking platform for the CARISCA Content Studio in Kumasi: a public
website for discovering packages and booking the studio online, and an admin
dashboard for staff to run it day to day.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, MySQL/MariaDB via
Prisma 7, and Paystack for payment.

---

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Paystack](#paystack)
- [Email](#email)
- [Scheduled jobs](#scheduled-jobs)
- [Project structure](#project-structure)
- [Key design decisions](#key-design-decisions)
- [Testing](#testing)
- [Deploying](#deploying)
- [Admin roles](#admin-roles)

---

## Quick start

Prerequisites: **Node.js 20.9+**, and a **MySQL 8+ or MariaDB 10.6+** server you can
connect to (local install, Docker, or a managed database).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env: see "Environment variables" below.
# At minimum, set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME and SESSION_SECRET
# to get the app running.

# 3. Set up the database: generate the client, run migrations, seed starter data
npm run setup

# 4. Start the dev server
npm run dev
```

Open **http://localhost:3000** for the public site.

The seed step creates a **Super Admin** account. If you didn't set `ADMIN_PASSWORD` in
`.env`, a strong password is generated and printed once in the terminal: copy it
before it scrolls away. Sign in at **http://localhost:3000/admin/login**.

Generate `SESSION_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### What the seed creates

- The exact starter catalogue from the brief: 4 studio rental packages, 3 creator
  memberships, 6 production add-ons, 8 equipment items, 9 FAQs.
- Operating hours: Mon–Fri 08:00–18:00, Sat 09:00–16:00, Sun closed.
- A 10% "Student & Researcher" discount rule.
- One Super Admin account.

Re-running `npm run db:seed` is safe: it upserts by slug/name rather than
duplicating rows.

---

## Environment variables

See `.env.example` for the full annotated list. The important ones:

| Variable | Required | Notes |
|---|---|---|
| `DB_HOST` | Yes | MySQL/MariaDB host. |
| `DB_PORT` | No | Defaults to 3306. |
| `DB_USER` | Yes | Database user. |
| `DB_PASSWORD` | Yes | Database password. Kept as its own field, not URL-encoded into a connection string. |
| `DB_NAME` | Yes | Database name. |
| `SESSION_SECRET` | Yes | Random 32+ byte string. Signs booking access tokens. |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL, no trailing slash. |
| `PAYSTACK_SECRET_KEY` | For payments | Server-only. Never exposed to the client. |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | For payments | Currently unused by the checkout flow (it redirects to Paystack's hosted page), kept for future inline-checkout use. |
| `PAYSTACK_CALLBACK_URL` | For payments | Where Paystack returns the customer. Must match `NEXT_PUBLIC_APP_URL`. |
| `EMAIL_SERVER` | For sending mail | SMTP connection string. Leave blank to log emails instead of sending. |
| `EMAIL_FROM` | No | Sender shown on outgoing emails. |
| `ADMIN_EMAIL` | No | Receives corporate enquiries and booking copies by default. |
| `CRON_SECRET` | For scheduled jobs | Bearer token for `POST /api/cron`. |

**Never commit `.env`.** It's git-ignored; `.env.example` is the template that *is*
committed.

If `PAYSTACK_SECRET_KEY` or `EMAIL_SERVER` are left blank, the app **does not break**
- it degrades honestly instead: bookings are still created and held, customers are
told online payment/email isn't available yet, and the studio can follow up manually.
Nothing is ever silently marked as paid or as sent.

---

## Database

Prisma 7 requires an explicit driver adapter for SQL databases; this project uses
`@prisma/adapter-mariadb`, which speaks the MySQL wire protocol and works against
both MySQL and MariaDB.

```bash
npm run db:migrate     # create/apply a migration in development
npm run db:deploy      # apply existing migrations (production)
npm run db:seed        # (re-)run the seed script
npm run db:studio      # Prisma Studio: browse/edit data visually
npm run db:reset       # ⚠️ drops and recreates the database, then reseeds
```

The schema (`prisma/schema.prisma`) models: `AdminUser`/`AdminSession`,
`Customer`/`CustomerSession`, `Package`/`PackageFeature`, `AddOn`, `Equipment`, `Faq`,
`DiscountRule`, `Booking`/`BookingAddOn`/`BookingSlot`, `Payment`,
`Membership`/`MembershipUsage`, `OperatingHour`/`BlockedDate`/`BlockedTime`,
`CorporateInquiry`, `Notification`, `StudioSetting`, and `AuditLog`.

**How double-booking is prevented:** every booking writes one row per 30-minute slot
it occupies into `BookingSlot`, under a **unique index on `(bookingDate,
slotMinute)`**. Two concurrent requests for the same time can both pass application
checks, but only one can win the database write: the loser gets a clear "someone
just booked that slot" error. This is verified by an automated concurrency test (see
[Testing](#testing)).

**Money** is stored as integer minor units (pesewas) throughout, never floats.

---

## Paystack

1. Get your API keys from the [Paystack dashboard](https://dashboard.paystack.com/#/settings/developers): use the `sk_test_...` / `pk_test_...` pair while developing.
2. Set `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, and `PAYSTACK_CALLBACK_URL` in `.env`.
3. In the Paystack dashboard, set your webhook URL to:
   ```
   <NEXT_PUBLIC_APP_URL>/api/payments/paystack/webhook
   ```
   This is the *authoritative* confirmation path: it fires even if a customer closes
   the tab after paying. The redirect-back callback page (`/booking/callback`) is a
   convenience for the customer, not a trust boundary: **both** paths call the same
   `settlePaymentByReference`, which re-verifies the transaction against Paystack's
   API before ever marking a booking paid, and checks the verified amount and
   currency against what the booking actually costs.
4. Test with Paystack's [test cards and Mobile Money numbers](https://paystack.com/docs/payments/test-payments/).

The webhook handler verifies the `x-paystack-signature` header (HMAC-SHA512 over the
raw request body, keyed on your secret key) before trusting anything in the payload -
covered by dedicated tests including tamper detection.

---

## Email

Any SMTP-compatible provider works: set `EMAIL_SERVER` to a connection string:

```
# Gmail (with an app password)
EMAIL_SERVER="smtps://user%40gmail.com:app-password@smtp.gmail.com:465"

# Resend's SMTP bridge
EMAIL_SERVER="smtp://resend:re_xxxxxxxx@smtp.resend.com:587"
```

Every message (sent or not) is recorded in the `Notification` table and visible
under **Admin → Notifications**, with the failure reason if delivery didn't happen.
Test your configuration from **Admin → Settings → Notifications → Test the mail
server** (this checks the connection only; it sends nothing).

---

## Scheduled jobs

`POST /api/cron` (with `Authorization: Bearer <CRON_SECRET>`) does four idempotent
things: releases unpaid bookings whose hold has expired, sends session reminders due
in the configured window, marks lapsed memberships as expired (nothing auto-renews),
and prunes expired sessions. Point your host's scheduler at it every few minutes -
e.g. a cron-capable platform, or a simple `curl` in a system cron job:

```
*/5 * * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron
```

Without `CRON_SECRET` set, the endpoint returns `503` rather than running unprotected.

---

## Project structure

```
src/
  app/
    (public)/          Public website: home, packages, book, faq, account, …
    admin/              Admin dashboard (route-grouped under (dashboard))
    api/                Route handlers: availability, quote, webhook, cron, …
  components/
    public/              Homepage sections, header/footer, booking-adjacent UI
    booking/             The multi-step booking flow and its pieces
    admin/               Dashboard shell, charts, resource managers
    ui/                  Design-system primitives (Button, Field, Modal, …)
  lib/
    booking/             Pricing engine, availability engine, time helpers, service
    payments/            Paystack client + payment orchestration
    email/               Templates + notification delivery/recording
    auth/                Password hashing, sessions, permissions, guards
    queries/             Read models for the public site and admin analytics
    validation/           Zod schemas (client input, never prices)
    db.ts, env.ts, settings.ts, audit.ts, rate-limit.ts
prisma/
  schema.prisma
  seed.ts
tests/
  pricing.test.ts        Pure pricing-engine unit tests
  booking.test.ts         Booking/availability integration tests (real DB)
  payments.test.ts        Payment-path integration tests
  webhook.test.ts          Signature verification unit tests
  smoke.test.ts            HTTP smoke tests across every route
```

Business logic lives in `src/lib`, not in components or pages: pages and Server
Actions call into it. `src/lib/booking/service.ts` is the single place a booking's
price and slot are decided; nothing upstream of it is trusted.

---

## Key design decisions

- **Server-authoritative pricing.** The client selects a package and add-ons; it
  never sends a price. `computeQuote` (pure, unit-tested) and `createBooking`
  (integration-tested against a real database) are the only places a booking's total
  is calculated, from catalogue rows read at write time.
- **Double-booking prevention is a database constraint**, not just an application
  check: see [Database](#database) above.
- **Payment is never trusted from the client or from a redirect.** Only a verified
  Paystack API response, matched on amount and currency, marks a booking paid.
- **Memberships are prepaid hour bundles, not subscriptions.** Nothing renews
  automatically; `autoRenew` exists on the schema for a future real-subscription
  path but is inert today.
- **Guest-first booking.** No account is required to book; a `Customer` row is
  created/matched by email, and a customer can optionally set a password later to
  claim it and see their history.
- **Booking links carry a signed access token** (`bookingAccessToken`), not just the
  human-readable reference: so a reference alone can't be used to browse someone
  else's booking.
- **RBAC is enforced server-side**, in every Server Action and route handler via
  `requireAdmin(permission)`/`requireAdminPage(permission)`: the sidebar hiding an
  item is cosmetic, not the security boundary.
- **The `proxy.ts` (formerly `middleware`) redirect for signed-out admin visitors is
  UX, not security**: it only improves the experience; every actual mutation
  re-checks the session and permission itself, since a Server Action can be POSTed
  directly without ever rendering a page.

---

## Testing

```bash
npm test              # run the full suite once
npm run test:watch    # watch mode
```

The suite runs against the real database configured by `DB_HOST`/`DB_PORT`/`DB_USER`/
`DB_PASSWORD`/`DB_NAME` (fixtures use recognisable prefixes and clean up after
themselves, so it's safe to run against your dev database). `smoke.test.ts`
additionally expects a running server: start
`npm run dev` (or `next start`) first; it skips itself gracefully if nothing is
listening.

What's covered: pricing (discounts, memberships, tax, add-on rules: 23 cases),
booking creation and double-booking prevention including a real concurrent-race test,
availability (operating hours, blocked dates/times, lead time), the pending-booking
expiry sweeper, payment initialisation and its failure paths, Paystack webhook
signature verification (including tamper detection), and an HTTP smoke pass over
every public and admin route plus API input validation.

Manually verified during development: the full booking flow end-to-end in a browser,
package CRUD through the live admin UI (create → edit → disable → delete), the
production build, mobile layouts at 390px across the public site and admin dashboard,
and that no secret values appear in any client-side JS bundle.

---

## Deploying

```bash
npm run build
npm start
```

Before going live:

1. Set real `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`, `SESSION_SECRET`,
   and production `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (switch
   from `sk_test_`/`pk_test_` to live keys).
2. Run `npm run db:deploy` against the production database, then `npm run db:seed`
   once to create packages/add-ons/FAQs and the first Super Admin: after that, manage
   the catalogue from the admin dashboard, not the seed script.
3. Point the Paystack webhook at your production URL.
4. Configure `EMAIL_SERVER` so confirmations and reminders actually send.
5. Schedule `POST /api/cron` to run every few minutes.
6. Change the Super Admin password (or set `ADMIN_PASSWORD` before seeding): don't
   run production on a generated password left in a terminal scrollback.

---

## Admin roles

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including settings and managing other admins. |
| **Studio Manager** | Bookings, customers, availability, catalogue, memberships, discounts, enquiries. |
| **Finance** | Payments, memberships, revenue analytics. |
| **Staff** | Day-to-day bookings and customer lookup. |

Full permission lists are shown on **Admin → Admin users**. Permissions are enforced
server-side (`src/lib/auth/permissions.ts`), not just hidden in the UI.
