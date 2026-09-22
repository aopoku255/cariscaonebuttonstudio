"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  saveSettings,
  testEmailConnection,
} from "@/app/admin/(dashboard)/settings/actions";
import type { SettingKey, StudioSettings } from "@/lib/settings";

/**
 * Settings screen.
 *
 * Every field maps to a key in the settings table. Booleans are stored as the strings
 * "true"/"false" so the whole store stays a simple key/value table.
 */
export function SettingsForm({
  settings,
  paystackConfigured,
  emailConfigured,
}: {
  settings: StudioSettings;
  paystackConfigured: boolean;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<Record<string, string>>({ ...settings });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const dirty = Object.keys(values).some(
    (key) => values[key] !== settings[key as SettingKey],
  );

  const set = (key: SettingKey, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setErrors({});
    const result = await saveSettings(values);
    setSaving(false);

    if (result.ok) {
      toast.success("Saved", result.message);
      router.refresh();
    } else {
      setErrors(result.errors ?? {});
      toast.error("Could not save", result.message);
    }
  }

  async function handleTestEmail() {
    setTesting(true);
    const result = await testEmailConnection();
    setTesting(false);
    if (result.ok) toast.success("Mail server reachable", result.message);
    else toast.error("Mail server check failed", result.message);
  }

  const text = (key: SettingKey, label: string, options: { description?: string; placeholder?: string; wide?: boolean } = {}) => (
    <Field
      key={key}
      label={label}
      description={options.description}
      error={errors[key]}
      className={options.wide ? "sm:col-span-2" : undefined}
    >
      {(props) => (
        <Input
          {...props}
          value={values[key] ?? ""}
          onChange={(event) => set(key, event.target.value)}
          placeholder={options.placeholder}
          invalid={Boolean(errors[key])}
        />
      )}
    </Field>
  );

  const area = (key: SettingKey, label: string, description?: string, rows = 3) => (
    <Field key={key} label={label} description={description} error={errors[key]} className="sm:col-span-2">
      {(props) => (
        <Textarea
          {...props}
          value={values[key] ?? ""}
          onChange={(event) => set(key, event.target.value)}
          rows={rows}
        />
      )}
    </Field>
  );

  const select = (
    key: SettingKey,
    label: string,
    choices: { value: string; label: string }[],
    options: { description?: string; wide?: boolean } = {},
  ) => (
    <Field
      key={key}
      label={label}
      description={options.description}
      error={errors[key]}
      className={options.wide ? "sm:col-span-2" : undefined}
    >
      {(props) => (
        <Select {...props} value={values[key] ?? ""} onChange={(event) => set(key, event.target.value)}>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  const toggle = (key: SettingKey, label: string, description?: string) => (
    <div key={key} className="sm:col-span-2">
      <Checkbox
        label={label}
        description={description}
        checked={values[key] === "true"}
        onChange={(event) => set(key, event.target.checked ? "true" : "false")}
      />
    </div>
  );

  return (
    <div className="space-y-5 pb-24">
      <Card>
        <CardHeader
          title="Studio"
          description="Shown across the website, in emails and on receipts."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("studio.name", "Studio name")}
          {text("studio.tagline", "Tagline", { placeholder: "Create. Record. Share." })}
          {text("studio.email", "Email address")}
          {text("studio.phone", "Phone number")}
          {text("studio.location", "Location", { wide: true })}
          {area("studio.description", "Description", "The one-paragraph summary used on the homepage and in the footer.")}
          {text("studio.heroImageUrl", "Hero image URL", {
            wide: true,
            description:
              "A photograph of the studio for the homepage hero. Leave blank to use the built-in illustration.",
            placeholder: "https://…",
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Booking rules"
          description="These govern which slots the calendar offers and how long a slot is held while someone pays."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("booking.intervalMinutes", "Booking interval (minutes)", {
            description: "Gap between the start times offered. Must be a multiple of 30.",
          })}
          {text("booking.minDurationMinutes", "Minimum booking length (minutes)")}
          {text("booking.maxDurationMinutes", "Maximum booking length (minutes)")}
          {text("booking.leadTimeHours", "Lead time (hours)", {
            description: "How far ahead of now the earliest bookable slot sits.",
          })}
          {text("booking.maxAdvanceDays", "Book up to (days ahead)")}
          {text("booking.pendingExpiryMinutes", "Hold unpaid bookings for (minutes)", {
            description: "After this, an unpaid booking is released and the slot is free again.",
          })}
          {toggle(
            "booking.requireApproval",
            "Require staff approval",
            "Paid bookings wait at 'Pending approval' until someone on the team confirms them.",
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pricing" description="Currency and any service charge." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("pricing.currency", "Currency code", {
            description: "GHS. Changing this does not convert existing prices.",
          })}
          {text("pricing.taxPercent", "Tax / service charge (%)", {
            description: "Applied to the discounted subtotal. Use 0 for none.",
          })}
          {text("pricing.taxLabel", "Charge label", {
            description: "What the charge is called on the summary and receipt.",
            wide: true,
          })}
          <Alert tone="info" className="sm:col-span-2">
            Student and researcher discounts are configured under{" "}
            <strong className="font-semibold">Discounts</strong>, where you can set the
            percentage, who qualifies, whether verification is needed and which packages
            it covers.
          </Alert>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Student verification"
          description="Controls who qualifies for Student Studio pricing on the booking flow."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {select(
            "student.verificationMethod",
            "Verification method",
            [
              { value: "EMAIL", label: "KNUST email only" },
              { value: "STUDENT_ID", label: "Student ID only (manual review)" },
              { value: "EITHER", label: "Either email or student ID" },
            ],
            {
              description:
                "Email matches are verified instantly. Student ID submissions hold the booking at Pending approval until a staff member verifies it.",
            },
          )}
          {text("student.knustEmailDomain", "KNUST email domain", {
            description: "An email ending in this domain is treated as an instant match.",
            placeholder: "knust.edu.gh",
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cancellation policy"
          description="Shown to customers on their booking page and used to work out refunds."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("cancellation.freeCancellationHours", "Free cancellation window (hours)", {
            description: "Cancel more than this far ahead for a full refund.",
          })}
          {text("cancellation.lateRefundPercent", "Late cancellation refund (%)", {
            description: "What is refunded inside the window. 0 means non-refundable.",
          })}
          {area(
            "cancellation.policyText",
            "Policy text",
            "The wording customers actually read.",
            4,
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notifications" description="Who gets told what, and when." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("notifications.adminEmail", "Admin email", {
            description: "Receives corporate enquiries and copies of confirmed bookings.",
            wide: true,
          })}
          {toggle(
            "notifications.sendBookingConfirmation",
            "Email customers when a booking is created",
          )}
          {toggle("notifications.sendReminders", "Send reminders before a session")}
          {text("notifications.reminderHoursBefore", "Send reminders (hours before)")}

          <div className="sm:col-span-2">
            {emailConfigured ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleTestEmail} loading={testing}>
                  Test the mail server
                </Button>
                <span className="text-[12.5px] text-muted">
                  Sends no email: just checks the connection works.
                </span>
              </div>
            ) : (
              <Alert tone="warning" title="Email is not configured">
                No <code className="font-mono text-[12px]">EMAIL_SERVER</code> is set, so
                messages are recorded under Notifications and logged to the server, but not
                delivered. Add an SMTP connection string to your environment to switch
                sending on.
              </Alert>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Payments"
          description="Paystack credentials live in environment variables, never in the database."
        />
        <CardBody>
          {paystackConfigured ? (
            <Alert tone="success" title="Paystack is configured">
              Customers can pay by Mobile Money, card and bank transfer. Remember to point
              your Paystack webhook at{" "}
              <code className="font-mono text-[12px]">/api/payments/paystack/webhook</code> so
              payments still confirm if a customer closes the tab.
            </Alert>
          ) : (
            <Alert tone="warning" title="Paystack is not configured">
              Set <code className="font-mono text-[12px]">PAYSTACK_SECRET_KEY</code> in your
              environment to take payments online. Until then, bookings are recorded and
              held, and the studio arranges payment directly.
            </Alert>
          )}
        </CardBody>
      </Card>

      {/* Sticky save bar so the button is always reachable on a long form */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md lg:left-64"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-[13px] text-muted">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <Button onClick={handleSave} loading={saving} disabled={!dirty}>
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
