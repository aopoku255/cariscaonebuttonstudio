"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { lookupBooking } from "@/app/(public)/booking/actions";

export function BookingLookupForm() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await lookupBooking({ reference, email });

    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }

    setLoading(false);
    setError(result.message);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label="Booking reference"
        required
        description="It looks like CAR-STU-20260922-001 and is in your confirmation email."
      >
        {(props) => (
          <Input
            {...props}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="CAR-STU-…"
            autoComplete="off"
            required
          />
        )}
      </Field>

      <Field label="Email address" required>
        {(props) => (
          <Input
            {...props}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        )}
      </Field>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" loading={loading} fullWidth size="lg">
        Find my booking
      </Button>
    </form>
  );
}
