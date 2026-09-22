"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitCorporateInquiry } from "@/app/(public)/corporate/actions";

const EMPTY = {
  organisation: "",
  contactName: "",
  email: "",
  phone: "",
  sessionsRequired: "",
  estimatedHours: "",
  contentType: "",
  preferredStartDate: "",
  requirements: "",
};

export function CorporateForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const result = await submitCorporateInquiry({
      ...form,
      sessionsRequired: form.sessionsRequired || undefined,
      estimatedHours: form.estimatedHours || undefined,
    });

    setSubmitting(false);

    if (result.ok) {
      setDone(result.message ?? "Thanks: we have your request.");
      setForm(EMPTY);
    } else {
      setErrors(result.errors ?? {});
      setFormError(result.message ?? "Something went wrong. Please try again.");
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-success-100 bg-success-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success-700" aria-hidden />
        <h3 className="mt-3 text-[17px] font-semibold text-success-700">Request received</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-success-700">{done}</p>
        <Button variant="outline" className="mt-5" onClick={() => setDone(null)}>
          Send another request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
      <Field label="Organisation name" required error={errors.organisation} className="sm:col-span-2">
        {(props) => (
          <Input
            {...props}
            value={form.organisation}
            onChange={(event) => set("organisation", event.target.value)}
            invalid={Boolean(errors.organisation)}
            placeholder="KNUST School of Business"
            required
          />
        )}
      </Field>

      <Field label="Contact person" required error={errors.contactName}>
        {(props) => (
          <Input
            {...props}
            value={form.contactName}
            onChange={(event) => set("contactName", event.target.value)}
            invalid={Boolean(errors.contactName)}
            autoComplete="name"
            required
          />
        )}
      </Field>

      <Field label="Email" required error={errors.email}>
        {(props) => (
          <Input
            {...props}
            type="email"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            invalid={Boolean(errors.email)}
            autoComplete="email"
            required
          />
        )}
      </Field>

      <Field label="Phone" required error={errors.phone}>
        {(props) => (
          <Input
            {...props}
            type="tel"
            value={form.phone}
            onChange={(event) => set("phone", event.target.value)}
            invalid={Boolean(errors.phone)}
            autoComplete="tel"
            required
          />
        )}
      </Field>

      <Field label="Preferred start date" error={errors.preferredStartDate}>
        {(props) => (
          <Input
            {...props}
            type="date"
            value={form.preferredStartDate}
            onChange={(event) => set("preferredStartDate", event.target.value)}
          />
        )}
      </Field>

      <Field label="Number of sessions" error={errors.sessionsRequired}>
        {(props) => (
          <Input
            {...props}
            value={form.sessionsRequired}
            onChange={(event) => set("sessionsRequired", event.target.value)}
            inputMode="numeric"
            placeholder="e.g. 12"
          />
        )}
      </Field>

      <Field label="Estimated hours" error={errors.estimatedHours}>
        {(props) => (
          <Input
            {...props}
            value={form.estimatedHours}
            onChange={(event) => set("estimatedHours", event.target.value)}
            inputMode="numeric"
            placeholder="e.g. 36"
          />
        )}
      </Field>

      <Field label="Type of content" error={errors.contentType} className="sm:col-span-2">
        {(props) => (
          <Input
            {...props}
            value={form.contentType}
            onChange={(event) => set("contentType", event.target.value)}
            placeholder="e.g. a weekly research podcast and quarterly video reports"
          />
        )}
      </Field>

      <Field
        label="Additional requirements"
        error={errors.requirements}
        className="sm:col-span-2"
        description="Anything else we should know: deadlines, guests, editing needs, invoicing requirements."
      >
        {(props) => (
          <Textarea
            {...props}
            value={form.requirements}
            onChange={(event) => set("requirements", event.target.value)}
            rows={4}
          />
        )}
      </Field>

      {formError ? (
        <div className="sm:col-span-2">
          <Alert tone="danger">{formError}</Alert>
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" loading={submitting} size="lg" fullWidth>
          Send request
        </Button>
      </div>
    </form>
  );
}
