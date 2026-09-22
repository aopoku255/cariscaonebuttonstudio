import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/booking/print-button";
import { Container } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";
import { PaymentStatus } from "@/generated/prisma/enums";
import { verifyBookingAccessToken } from "@/lib/booking/access";
import { formatDateTime, formatLongDate, formatTimeRange } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { getStudioProfile } from "@/lib/queries/public";
import { formatDuration, formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Printable receipt. Rendered as a normal page with print styles, so "Download
 * Receipt" is the browser's own Save-as-PDF: no PDF dependency, and it prints
 * correctly from every device.
 */
export default async function ReceiptPage({
  params,
  searchParams,
}: PageProps<"/booking/[reference]/receipt">) {
  const { reference } = await params;
  const query = await searchParams;
  const decoded = decodeURIComponent(reference);

  if (!verifyBookingAccessToken(decoded, typeof query.t === "string" ? query.t : null)) {
    notFound();
  }

  const [booking, studio] = await Promise.all([
    prisma.booking.findUnique({
      where: { reference: decoded },
      include: {
        customer: true,
        addOns: true,
        payments: { where: { status: PaymentStatus.PAID }, orderBy: { paidAt: "desc" } },
      },
    }),
    getStudioProfile(),
  ]);

  if (!booking) notFound();

  const payment = booking.payments[0];

  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3">
          <ButtonLink
            href={`/booking/${encodeURIComponent(booking.reference)}?t=${typeof query.t === "string" ? query.t : ""}`}
            variant="ghost"
            size="sm"
          >
            ← Back to booking
          </ButtonLink>
          <PrintButton />
        </div>

        <article className="print-sheet rounded-2xl border border-line bg-surface p-7 sm:p-10">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="text-[11.5px] font-semibold tracking-[0.16em] text-accent-600 uppercase">
                Receipt
              </p>
              <h1 className="font-display mt-2 text-[26px] leading-tight font-semibold text-ink">
                {studio.name}
              </h1>
              <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-muted">
                {studio.location}
                <br />
                {studio.phone} · {studio.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                Reference
              </p>
              <p className="mt-1 font-mono text-[15px] font-semibold text-ink">
                {booking.reference}
              </p>
              <p className="mt-3 text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                Issued
              </p>
              <p className="mt-1 text-[13px] text-ink">
                {formatDateTime(payment?.paidAt ?? booking.createdAt)}
              </p>
            </div>
          </header>

          <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
            <div>
              <h2 className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                Billed to
              </h2>
              <p className="mt-2 text-[14px] font-semibold text-ink">{booking.customer.name}</p>
              {booking.customer.organisation ? (
                <p className="text-[13px] text-ink-soft">{booking.customer.organisation}</p>
              ) : null}
              <p className="text-[13px] text-muted">{booking.customer.email}</p>
              <p className="text-[13px] text-muted">{booking.customer.phone}</p>
            </div>
            <div>
              <h2 className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                Session
              </h2>
              <p className="mt-2 text-[14px] text-ink">{formatLongDate(booking.bookingDate)}</p>
              <p className="text-[13px] text-ink-soft">
                {formatTimeRange(booking.startMinute, booking.endMinute)}
              </p>
              <p className="text-[13px] text-muted">
                {formatDuration(booking.durationMinutes)}
              </p>
            </div>
          </section>

          <section className="py-6">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="pb-2 text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                    Item
                  </th>
                  <th className="pb-2 text-right text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-3 text-[14px] text-ink">
                    {booking.packageNameSnapshot ?? "Studio session"}
                  </td>
                  <td className="py-3 text-right text-[14px] text-ink">
                    {formatMoney(
                      booking.subtotalMinor -
                        booking.addOns.reduce((sum, a) => sum + a.lineTotalMinor, 0),
                      booking.currency,
                    )}
                  </td>
                </tr>
                {booking.addOns.map((addOn) => (
                  <tr key={addOn.id}>
                    <td className="py-3 text-[14px] text-ink-soft">
                      {addOn.nameSnapshot}
                      {addOn.quantity > 1 ? ` ×${addOn.quantity}` : ""}
                    </td>
                    <td className="py-3 text-right text-[14px] text-ink-soft">
                      {formatMoney(addOn.lineTotalMinor, booking.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line">
                  <td className="pt-3 text-[13.5px] text-muted">Subtotal</td>
                  <td className="pt-3 text-right text-[13.5px] text-muted">
                    {formatMoney(booking.subtotalMinor, booking.currency)}
                  </td>
                </tr>
                {booking.discountMinor > 0 ? (
                  <tr>
                    <td className="pt-1.5 text-[13.5px] text-success-700">
                      {booking.discountLabel ?? "Discount"}
                    </td>
                    <td className="pt-1.5 text-right text-[13.5px] text-success-700">
                      −{formatMoney(booking.discountMinor, booking.currency)}
                    </td>
                  </tr>
                ) : null}
                {booking.taxMinor > 0 ? (
                  <tr>
                    <td className="pt-1.5 text-[13.5px] text-muted">Service charge</td>
                    <td className="pt-1.5 text-right text-[13.5px] text-muted">
                      {formatMoney(booking.taxMinor, booking.currency)}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td className="pt-3 text-[15px] font-semibold text-ink">Total</td>
                  <td className="pt-3 text-right text-[18px] font-semibold text-ink">
                    {formatMoney(booking.totalMinor, booking.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <footer className="border-t border-line pt-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                  Payment status
                </dt>
                <dd className="mt-1 text-[13.5px] font-medium text-ink">
                  {booking.paymentStatus === PaymentStatus.PAID ? "Paid" : booking.paymentStatus}
                </dd>
              </div>
              {payment ? (
                <>
                  <div>
                    <dt className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                      Method
                    </dt>
                    <dd className="mt-1 text-[13.5px] text-ink">
                      {payment.channel ?? payment.provider}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                      Payment reference
                    </dt>
                    <dd className="mt-1 truncate font-mono text-[12px] text-ink">
                      {payment.providerReference ?? payment.reference}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>

            <p className="mt-7 text-[12px] leading-relaxed text-muted">
              Thank you for booking with {studio.name}. This receipt was generated
              automatically; keep it for your records. For questions about this payment,
              quote reference {booking.reference}.
            </p>
          </footer>
        </article>
      </div>
    </Container>
  );
}
