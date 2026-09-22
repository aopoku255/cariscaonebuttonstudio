import type { Metadata } from "next";

import { BookingLookupForm } from "@/components/booking/lookup-form";
import { Container } from "@/components/public/section";

export const metadata: Metadata = {
  title: "Find your booking",
  description:
    "Look up your One Button Studio booking using your booking reference and email address.",
  robots: { index: false, follow: false },
};

export default function BookingLookupPage() {
  return (
    <Container className="py-14 sm:py-20">
      <div className="mx-auto max-w-md">
        <header className="text-center">
          <h1 className="font-display text-[30px] leading-tight font-semibold tracking-tight text-ink">
            Find your booking
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Enter your booking reference and the email address you booked with, and we will
            open your booking.
          </p>
        </header>

        <div className="mt-8">
          <BookingLookupForm />
        </div>
      </div>
    </Container>
  );
}
