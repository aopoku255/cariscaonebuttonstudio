import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle, Clock } from "lucide-react";

import { Container } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { bookingPath } from "@/lib/booking/access";
import { PaymentError, settlePaymentByReference } from "@/lib/payments/service";

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where Paystack returns the customer after checkout.
 *
 * Landing here proves nothing on its own: the page calls Paystack's verify endpoint
 * server-side and only then treats the booking as paid. If verification says the
 * payment did not succeed, the customer is told so and the booking stays unpaid.
 */
export default async function PaymentCallbackPage({
  searchParams,
}: PageProps<"/booking/callback">) {
  const params = await searchParams;
  const reference =
    typeof params.reference === "string"
      ? params.reference
      : typeof params.trxref === "string"
        ? params.trxref
        : null;

  if (!reference) {
    return (
      <CallbackShell
        tone="danger"
        title="We could not identify that payment"
        message="The link you followed did not include a payment reference. If money has left your account, contact the studio with your booking reference and we will sort it out."
      />
    );
  }

  let result;
  try {
    result = await settlePaymentByReference(reference);
  } catch (error) {
    if (error instanceof PaymentError) {
      return (
        <CallbackShell
          tone="danger"
          title="There is a problem with this payment"
          message={error.message}
        />
      );
    }
    console.error("[payment callback] verification failed:", error);
    return (
      <CallbackShell
        tone="danger"
        title="We could not confirm your payment"
        message="Something went wrong while checking with Paystack. Your booking has not been lost: open it below, or contact the studio and we will confirm it manually."
      />
    );
  }

  if (result.status === "PAID" && result.bookingReference) {
    redirect(`${bookingPath(result.bookingReference)}&paid=1`);
  }

  if (result.status === "PENDING") {
    return (
      <CallbackShell
        tone="warning"
        title="Your payment has not completed yet"
        message={`${result.message} Your slot is still held for a short while: you can try paying again from your booking.`}
        bookingReference={result.bookingReference}
      />
    );
  }

  return (
    <CallbackShell
      tone="danger"
      title="Your payment was not successful"
      message={`${result.message} Nothing has been charged. Your slot is held for a little longer, so you can try again.`}
      bookingReference={result.bookingReference}
    />
  );
}

function CallbackShell({
  tone,
  title,
  message,
  bookingReference,
}: {
  tone: "warning" | "danger";
  title: string;
  message: string;
  bookingReference?: string | null;
}) {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-lg text-center">
        <span
          className={`mx-auto flex size-14 items-center justify-center rounded-full ${
            tone === "warning" ? "bg-warning-50 text-warning-700" : "bg-danger-50 text-danger-700"
          }`}
        >
          {tone === "warning" ? (
            <Clock className="size-6" aria-hidden />
          ) : (
            <AlertCircle className="size-6" aria-hidden />
          )}
        </span>

        <h1 className="font-display mt-6 text-[30px] leading-tight font-semibold tracking-tight text-ink">
          {title}
        </h1>

        <Alert tone={tone} className="mt-6 text-left">
          {message}
        </Alert>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {bookingReference ? (
            <ButtonLink href={bookingPath(bookingReference)}>Open your booking</ButtonLink>
          ) : (
            <ButtonLink href="/booking/lookup">Find your booking</ButtonLink>
          )}
          <ButtonLink href="/contact" variant="outline">
            Contact the studio
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
