"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, LoadingLine } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { CustomerType } from "@/generated/prisma/enums";
import { createAdminBooking } from "@/app/admin/(dashboard)/bookings/actions";
import { CUSTOMER_TYPE_OPTIONS } from "@/lib/customer-types";
import { useJsonFetch } from "@/lib/hooks/use-json-fetch";
import { formatDuration, formatMoney } from "@/lib/utils";

interface PackageOption {
  id: string;
  name: string;
  priceMinor: number;
  durationMinutes: number;
  category: string;
}

interface AddOnOption {
  id: string;
  name: string;
  priceMinor: number;
  pricingUnit: string;
  maxQuantity: number;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string;
  phone: string;
  organisation: string | null;
  userType: string;
}

const PAYMENT_MODES = [
  { value: "PAY_LATER", label: "Pay later: confirm now, invoice after" },
  { value: "PAID_MANUAL", label: "Already paid: cash or bank transfer" },
  { value: "COMPLIMENTARY", label: "Complimentary: no charge" },
  { value: "PAYSTACK", label: "Send a Paystack payment link" },
];

interface QuoteView {
  packageName: string;
  durationMinutes: number;
  baseMinor: number;
  addOnLines: { addOnId: string; name: string; quantity: number; lineTotalMinor: number }[];
  subtotalMinor: number;
  discountMinor: number;
  discountLabel: string | null;
  taxMinor: number;
  totalMinor: number;
  currency: string;
}

export function AdminBookingForm({
  packages,
  addOns,
  customers,
}: {
  packages: PackageOption[];
  addOns: AddOnOption[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    packageId: packages[0]?.id ?? "",
    dateKey: "",
    startTime: "10:00",
    durationMinutes: String(packages[0]?.durationMinutes ?? 60),
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    organisation: "",
    userType: "CREATOR" as CustomerType,
    paymentMode: "PAY_LATER",
    useMembership: false,
    allowOutsideHours: false,
    purpose: "",
    internalNotes: "",
  });

  const [selections, setSelections] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /**
   * Choosing a package sets the duration to that package's length. Done here rather
   * than in an effect so it is a single state update, and so staff can still type a
   * different duration afterwards without it being overwritten.
   */
  function selectPackage(packageId: string) {
    const pkg = packages.find((entry) => entry.id === packageId);
    setForm((current) => ({
      ...current,
      packageId,
      durationMinutes: pkg ? String(pkg.durationMinutes) : current.durationMinutes,
    }));
  }

  const addOnSelections = useMemo(
    () => Object.entries(selections).map(([addOnId, quantity]) => ({ addOnId, quantity })),
    [selections],
  );

  // Live price, computed by the same server code the public flow uses.
  const { data: quoteResponse, loading: quoteLoading } = useJsonFetch<{ quote: QuoteView }>(
    form.packageId ? "/api/quote" : null,
    form.packageId
      ? {
          packageId: form.packageId,
          addOns: addOnSelections,
          userType: form.userType,
          email: form.customerEmail || undefined,
          useMembership: form.useMembership,
        }
      : undefined,
  );
  const quote = quoteResponse?.quote ?? null;

  function applyCustomer(customerId: string) {
    const customer = customers.find((entry) => entry.id === customerId);
    if (!customer) return;
    setForm((current) => ({
      ...current,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      organisation: customer.organisation ?? "",
      userType: customer.userType as CustomerType,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await createAdminBooking({ ...form, addOns: addOnSelections });

    setSaving(false);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      setFormError(result.message ?? "Could not create that booking.");
      toast.error("Booking not created", result.message);
      return;
    }

    toast.success("Booking created", result.message);
    router.push(`/admin/bookings/${result.data!.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Session" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Package" required error={errors.packageId} className="sm:col-span-2">
              {(props) => (
                <Select
                  {...props}
                  value={form.packageId}
                  onChange={(event) => selectPackage(event.target.value)}
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}: {formatMoney(pkg.priceMinor)} (
                      {formatDuration(pkg.durationMinutes)})
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Date" required error={errors.dateKey}>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={form.dateKey}
                  onChange={(event) => set("dateKey", event.target.value)}
                  invalid={Boolean(errors.dateKey)}
                  required
                />
              )}
            </Field>

            <Field
              label="Start time"
              required
              error={errors.startTime}
              description="On the half hour."
            >
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  step={1800}
                  value={form.startTime}
                  onChange={(event) => set("startTime", event.target.value)}
                  invalid={Boolean(errors.startTime)}
                  required
                />
              )}
            </Field>

            <Field
              label="Duration (minutes)"
              required
              error={errors.durationMinutes}
              description="Defaults to the package length; change it for a bespoke session."
            >
              {(props) => (
                <Input
                  {...props}
                  value={form.durationMinutes}
                  onChange={(event) => set("durationMinutes", event.target.value)}
                  inputMode="numeric"
                  invalid={Boolean(errors.durationMinutes)}
                />
              )}
            </Field>

            <div className="sm:col-span-2">
              <Checkbox
                label="Allow outside opening hours"
                description="Use when the studio is opening specially for this session."
                checked={form.allowOutsideHours}
                onChange={(event) => set("allowOutsideHours", event.target.checked)}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Customer"
            description="Pick an existing customer to fill this in, or type new details."
          />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            {customers.length > 0 ? (
              <Field label="Existing customer" className="sm:col-span-2">
                {(props) => (
                  <Select
                    {...props}
                    defaultValue=""
                    onChange={(event) => applyCustomer(event.target.value)}
                  >
                    <option value="">New customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} · {customer.email}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}

            <Field label="Full name" required error={errors.customerName}>
              {(props) => (
                <Input
                  {...props}
                  value={form.customerName}
                  onChange={(event) => set("customerName", event.target.value)}
                  invalid={Boolean(errors.customerName)}
                  required
                />
              )}
            </Field>

            <Field label="Organisation" error={errors.organisation}>
              {(props) => (
                <Input
                  {...props}
                  value={form.organisation}
                  onChange={(event) => set("organisation", event.target.value)}
                />
              )}
            </Field>

            <Field label="Email" required error={errors.customerEmail}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={form.customerEmail}
                  onChange={(event) => set("customerEmail", event.target.value)}
                  invalid={Boolean(errors.customerEmail)}
                  required
                />
              )}
            </Field>

            <Field label="Phone" required error={errors.customerPhone}>
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  value={form.customerPhone}
                  onChange={(event) => set("customerPhone", event.target.value)}
                  invalid={Boolean(errors.customerPhone)}
                  required
                />
              )}
            </Field>

            <Field label="Customer type" required error={errors.userType}>
              {(props) => (
                <Select
                  {...props}
                  value={form.userType}
                  onChange={(event) => set("userType", event.target.value as CustomerType)}
                >
                  {CUSTOMER_TYPE_OPTIONS.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="sm:col-span-2">
              <Checkbox
                label="Use the customer's membership hours"
                description="Draws on their prepaid hours if they have an active membership."
                checked={form.useMembership}
                onChange={(event) => set("useMembership", event.target.checked)}
              />
            </div>
          </CardBody>
        </Card>

        {addOns.length > 0 ? (
          <Card>
            <CardHeader title="Add-ons" />
            <CardBody className="space-y-2.5">
              {addOns.map((addOn) => {
                const quantity = selections[addOn.id];
                return (
                  <div key={addOn.id} className="flex items-center justify-between gap-3">
                    <Checkbox
                      label={addOn.name}
                      description={
                        addOn.pricingUnit === "CUSTOM"
                          ? "Custom pricing"
                          : `${formatMoney(addOn.priceMinor)} ${
                              addOn.pricingUnit === "PER_HOUR" ? "/ hour" : "per booking"
                            }`
                      }
                      checked={Boolean(quantity)}
                      onChange={(event) => {
                        const next = { ...selections };
                        if (event.target.checked) next[addOn.id] = 1;
                        else delete next[addOn.id];
                        setSelections(next);
                      }}
                    />
                    {quantity && addOn.maxQuantity > 1 ? (
                      <Input
                        value={String(quantity)}
                        onChange={(event) =>
                          setSelections({
                            ...selections,
                            [addOn.id]: Math.min(
                              Math.max(1, Number(event.target.value) || 1),
                              addOn.maxQuantity,
                            ),
                          })
                        }
                        className="w-16 shrink-0"
                        inputMode="numeric"
                        aria-label={`${addOn.name} quantity`}
                      />
                    ) : null}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Notes" />
          <CardBody className="space-y-5">
            <Field label="Purpose of booking">
              {(props) => (
                <Textarea
                  {...props}
                  value={form.purpose}
                  onChange={(event) => set("purpose", event.target.value)}
                  rows={2}
                />
              )}
            </Field>
            <Field label="Internal notes" description="Staff only: never shown to the customer.">
              {(props) => (
                <Textarea
                  {...props}
                  value={form.internalNotes}
                  onChange={(event) => set("internalNotes", event.target.value)}
                  rows={3}
                />
              )}
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* Summary */}
      <div className="space-y-5 lg:sticky lg:top-6">
        <Card>
          <CardHeader title="Payment" />
          <CardBody className="space-y-4">
            <Field label="How is this being paid?" required>
              {(props) => (
                <Select
                  {...props}
                  value={form.paymentMode}
                  onChange={(event) => set("paymentMode", event.target.value)}
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="border-t border-line pt-4">
              {quoteLoading ? (
                <LoadingLine label="Pricing…" />
              ) : quote ? (
                <div className="space-y-2">
                  <Row label={quote.packageName} value={formatMoney(quote.baseMinor)} />
                  {quote.addOnLines.map((line) => (
                    <Row
                      key={line.addOnId}
                      label={line.quantity > 1 ? `${line.name} ×${line.quantity}` : line.name}
                      value={formatMoney(line.lineTotalMinor)}
                      muted
                    />
                  ))}
                  {quote.discountMinor > 0 ? (
                    <Row
                      label={quote.discountLabel ?? "Discount"}
                      value={`−${formatMoney(quote.discountMinor)}`}
                      tone="success"
                    />
                  ) : null}
                  {quote.taxMinor > 0 ? (
                    <Row label="Service charge" value={formatMoney(quote.taxMinor)} muted />
                  ) : null}
                  <div className="flex items-baseline justify-between border-t border-line pt-2">
                    <span className="text-[14px] font-semibold text-ink">
                      {form.paymentMode === "COMPLIMENTARY" ? "Total (waived)" : "Total"}
                    </span>
                    <span className="font-display text-[22px] font-semibold text-ink">
                      {form.paymentMode === "COMPLIMENTARY"
                        ? formatMoney(0)
                        : formatMoney(quote.totalMinor)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-muted">Choose a package to see the price.</p>
              )}
            </div>
          </CardBody>
        </Card>

        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Button type="submit" loading={saving} fullWidth size="lg">
          Create booking
        </Button>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "success";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span
        className={
          tone === "success"
            ? "text-[13px] text-success-700"
            : muted
              ? "text-[13px] text-muted"
              : "text-[13.5px] text-ink-soft"
        }
      >
        {label}
      </span>
      <span
        className={
          tone === "success"
            ? "text-[13px] font-semibold whitespace-nowrap text-success-700"
            : muted
              ? "text-[13px] whitespace-nowrap text-muted"
              : "text-[13.5px] font-medium whitespace-nowrap text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
