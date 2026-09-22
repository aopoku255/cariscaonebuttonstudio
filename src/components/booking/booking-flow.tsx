"use client";

import { ArrowLeft, ArrowRight, Check, Clock, Lock, Minus, Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { AvailabilityCalendar } from "@/components/booking/calendar";
import { SummaryPanel, type QuoteView } from "@/components/booking/summary-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CustomerType } from "@/generated/prisma/enums";
import type { DayAvailability } from "@/lib/booking/availability";
import { formatMinuteOfDay12, formatTimeRange } from "@/lib/booking/time";
import { BOOKING_CATEGORY_CHOICES, CUSTOMER_TYPE_LABELS } from "@/lib/customer-types";
import { useJsonFetch } from "@/lib/hooks/use-json-fetch";
import { cn, formatDuration, formatMoney } from "@/lib/utils";
import { submitBooking } from "@/app/(public)/book/actions";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface FlowPackage {
  id: string;
  name: string;
  summary: string | null;
  priceMinor: number;
  durationMinutes: number;
  category: string;
  isPopular: boolean;
  studentOnly: boolean;
  features: { id: string; label: string }[];
}

export interface FlowAddOn {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  pricingUnit: string;
  maxQuantity: number;
}

const STEPS = [
  { key: "who", label: "Who are you?" },
  { key: "package", label: "Package" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "addons", label: "Add-ons" },
  { key: "details", label: "Your details" },
  { key: "pay", label: "Review & pay" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function stepIndexOf(key: StepKey): number {
  return STEPS.findIndex((step) => step.key === key);
}

/* -------------------------------------------------------------------------- */
/* Flow                                                                        */
/* -------------------------------------------------------------------------- */

export function BookingFlow({
  packages,
  addOns,
  initialPackageId,
  initialAddOnSlug,
  initialCategory,
  addOnSlugToId,
  discountNote,
  paymentEnabled,
  studentVerificationMethod,
  knustEmailDomain,
}: {
  packages: FlowPackage[];
  addOns: FlowAddOn[];
  initialPackageId?: string;
  initialAddOnSlug?: string;
  /** Pre-selects a category (e.g. arriving from the Student Studio page) and skips step 0. */
  initialCategory?: CustomerType;
  addOnSlugToId: Record<string, string>;
  discountNote: string | null;
  paymentEnabled: boolean;
  studentVerificationMethod: "EMAIL" | "STUDENT_ID" | "EITHER";
  knustEmailDomain: string;
}) {
  const toast = useToast();

  const hasInitialCategory = Boolean(initialCategory);
  const [stepIndex, setStepIndex] = useState(
    initialPackageId
      ? stepIndexOf("date")
      : hasInitialCategory
        ? stepIndexOf("package")
        : stepIndexOf("who"),
  );
  const [categoryChosen, setCategoryChosen] = useState(hasInitialCategory);
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [packageId, setPackageId] = useState<string | null>(initialPackageId ?? null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<string, number>>(() => {
    const preset = initialAddOnSlug ? addOnSlugToId[initialAddOnSlug] : undefined;
    return preset ? { [preset]: 1 } : {};
  });

  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    organisation: "",
    userType: initialCategory ?? (CustomerType.CREATOR as CustomerType),
    studentIdRef: "",
  });
  const [purpose, setPurpose] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const headingRef = useRef<HTMLDivElement>(null);
  const step = STEPS[stepIndex];
  const isKnustStudent = customer.userType === CustomerType.KNUST_STUDENT;

  /**
   * Student-only packages never appear for anyone else, and for a KNUST student they
   * come first with the rest reachable behind "View all studio packages" rather than
   * hidden outright.
   */
  const visiblePackages = useMemo(() => {
    const nonStudent = packages.filter((pkg) => !pkg.studentOnly);
    if (!isKnustStudent) return nonStudent;

    const studentPackages = packages.filter((pkg) => pkg.studentOnly);
    if (showAllPackages) return [...studentPackages, ...nonStudent];
    return studentPackages;
  }, [packages, isKnustStudent, showAllPackages]);

  const selectedPackage = packages.find((pkg) => pkg.id === packageId) ?? null;

  const addOnSelections = useMemo(
    () =>
      Object.entries(selections).map(([addOnId, quantity]) => ({ addOnId, quantity })),
    [selections],
  );

  /* --- Pricing ------------------------------------------------------------ */
  // Re-priced on the server whenever the selection changes, so what the customer sees
  // is always what the server will charge.
  const { data: quoteResponse, loading: quoteLoading } = useJsonFetch<{ quote: QuoteView }>(
    packageId ? "/api/quote" : null,
    packageId
      ? {
          packageId,
          addOns: addOnSelections,
          userType: customer.userType,
          email: customer.email || undefined,
          useMembership: false,
        }
      : undefined,
  );
  const quote = quoteResponse?.quote ?? null;

  /* --- Day availability --------------------------------------------------- */
  const { data: dayResponse, loading: dayLoading } = useJsonFetch<{ day: DayAvailability }>(
    packageId && dateKey
      ? `/api/availability?date=${dateKey}&packageId=${encodeURIComponent(packageId)}`
      : null,
  );
  const day = dayResponse?.day ?? null;

  /**
   * A slot chosen earlier may have been taken while the customer was deciding, so the
   * selection is validated against the freshly loaded day rather than trusted. This is
   * derived during render instead of written back to state, so no extra render occurs.
   */
  const effectiveStartMinute =
    startMinute !== null &&
    (day === null ||
      day.slots.some((slot) => slot.startMinute === startMinute && slot.available))
      ? startMinute
      : null;

  /* --- Navigation --------------------------------------------------------- */
  const goTo = useCallback((index: number) => {
    setStepIndex(index);
    setFormError(null);
    // Move focus to the step heading so keyboard and screen-reader users land in
    // the right place rather than at the top of the document.
    requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  // Whether the studio can even attempt to verify a student right now, given what
  // they have entered so far and the studio's configured method.
  const emailLooksLikeKnust = customer.email.trim().toLowerCase().endsWith(`@${knustEmailDomain}`);
  const studentIdCollectible =
    studentVerificationMethod === "STUDENT_ID" || studentVerificationMethod === "EITHER";

  const canContinue = useMemo(() => {
    switch (step.key) {
      case "who":
        return categoryChosen;
      case "package":
        return Boolean(packageId);
      case "date":
        return Boolean(dateKey);
      case "time":
        return effectiveStartMinute !== null;
      case "addons":
        return true;
      case "details":
        return Boolean(customer.name && customer.email && customer.phone);
      default:
        return true;
    }
  }, [step.key, categoryChosen, packageId, dateKey, effectiveStartMinute, customer]);

  const furthestReachable = useMemo(() => {
    if (!categoryChosen) return stepIndexOf("who");
    if (!packageId) return stepIndexOf("package");
    if (!dateKey) return stepIndexOf("date");
    if (effectiveStartMinute === null) return stepIndexOf("time");
    if (!customer.name || !customer.email || !customer.phone) return stepIndexOf("details");
    return STEPS.length - 1;
  }, [categoryChosen, packageId, dateKey, effectiveStartMinute, customer]);

  /* --- Submit ------------------------------------------------------------- */
  async function handleSubmit() {
    if (!packageId || !dateKey || effectiveStartMinute === null) return;

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const result = await submitBooking({
      packageId,
      dateKey,
      startMinute: effectiveStartMinute,
      addOns: addOnSelections,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        organisation: customer.organisation || undefined,
        userType: customer.userType,
        studentIdRef: customer.studentIdRef || undefined,
      },
      purpose: purpose || undefined,
      specialRequirements: specialRequirements || undefined,
      useMembership: false,
    });

    if (!result.ok) {
      setSubmitting(false);
      setErrors(result.errors ?? {});
      setFormError(result.message ?? "We could not complete your booking.");
      toast.error("Booking not completed", result.message);

      // A lost slot means the availability on screen is stale: refresh it.
      if (result.message?.toLowerCase().includes("just booked")) {
        setStartMinute(null);
        goTo(stepIndexOf("time"));
      }
      return;
    }

    if (result.redirectUrl) {
      // Hand off to Paystack. The server verifies the outcome afterwards; returning
      // from this URL is never on its own treated as payment.
      window.location.href = result.redirectUrl;
      return;
    }

    setSubmitting(false);
    // The server returns a tokenised link, so the customer can open their booking
    // straight away without waiting for the confirmation email.
    window.location.href = result.bookingUrl ?? "/";
  }

  /* --- Render ------------------------------------------------------------- */
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start lg:gap-10">
      <div className="min-w-0">
        <Progress
          current={stepIndex}
          furthest={furthestReachable}
          onJump={(index) => index <= furthestReachable && goTo(index)}
        />

        <div
          ref={headingRef}
          tabIndex={-1}
          className="mt-8 outline-none"
          aria-live="polite"
        >
          {step.key === "who" ? (
            <StepWho
              selected={customer.userType}
              onSelect={(type) => {
                setCustomer((current) => ({ ...current, userType: type }));
                setCategoryChosen(true);
                setShowAllPackages(false);
                setPackageId(null);
                goTo(stepIndexOf("package"));
              }}
            />
          ) : null}

          {step.key === "package" ? (
            <StepPackage
              packages={visiblePackages}
              selected={packageId}
              onSelect={(id) => {
                setPackageId(id);
                setStartMinute(null);
                goTo(stepIndexOf("date"));
              }}
              discountNote={discountNote}
              isKnustStudent={isKnustStudent}
              showingAll={showAllPackages}
              onToggleShowAll={() => setShowAllPackages((value) => !value)}
              hasNonStudentPackages={packages.some((pkg) => !pkg.studentOnly)}
            />
          ) : null}

          {step.key === "date" ? (
            <StepDate
              packageId={packageId}
              selected={dateKey}
              onSelect={(key) => {
                setDateKey(key);
                setStartMinute(null);
                goTo(stepIndexOf("time"));
              }}
            />
          ) : null}

          {step.key === "time" ? (
            <StepTime
              day={day}
              loading={dayLoading}
              selected={effectiveStartMinute}
              durationMinutes={selectedPackage?.durationMinutes ?? 60}
              onSelect={(minute) => {
                setStartMinute(minute);
                goTo(stepIndexOf("addons"));
              }}
              onChangeDate={() => goTo(stepIndexOf("date"))}
            />
          ) : null}

          {step.key === "addons" ? (
            <StepAddOns
              addOns={addOns}
              selections={selections}
              onChange={setSelections}
              durationMinutes={selectedPackage?.durationMinutes ?? 60}
            />
          ) : null}

          {step.key === "details" ? (
            <StepDetails
              customer={customer}
              onChange={setCustomer}
              purpose={purpose}
              onPurposeChange={setPurpose}
              specialRequirements={specialRequirements}
              onSpecialRequirementsChange={setSpecialRequirements}
              errors={errors}
              isKnustStudent={isKnustStudent}
              studentVerificationMethod={studentVerificationMethod}
              knustEmailDomain={knustEmailDomain}
              emailLooksLikeKnust={emailLooksLikeKnust}
              studentIdCollectible={studentIdCollectible}
            />
          ) : null}

          {step.key === "pay" ? (
            <StepReview
              quote={quote}
              dateKey={dateKey}
              startMinute={effectiveStartMinute}
              customer={customer}
              purpose={purpose}
              specialRequirements={specialRequirements}
              paymentEnabled={paymentEnabled}
              onEdit={goTo}
            />
          ) : null}
        </div>

        {formError ? (
          <Alert tone="danger" className="mt-6">
            {formError}
          </Alert>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          <Button
            variant="ghost"
            onClick={() => goTo(Math.max(0, stepIndex - 1))}
            disabled={stepIndex === 0 || submitting}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>

          {step.key === "pay" ? (
            <Button onClick={handleSubmit} loading={submitting} size="lg">
              {!paymentEnabled
                ? "Confirm booking"
                : quote && quote.totalMinor > 0
                  ? `Pay ${formatMoney(quote.totalMinor, quote.currency)} with Paystack`
                  : "Confirm booking"}
            </Button>
          ) : step.key === "who" ? null : (
            <Button
              onClick={() => goTo(Math.min(STEPS.length - 1, stepIndex + 1))}
              disabled={!canContinue}
            >
              Continue
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* Summary: sticky beside the form on desktop, and reachable above the form on mobile. */}
      <aside className="lg:sticky lg:top-24">
        <SummaryPanel
          quote={quote}
          loading={quoteLoading}
          dateKey={dateKey}
          startMinute={effectiveStartMinute}
          packageName={selectedPackage?.name ?? null}
        />
        {paymentEnabled ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
            <Lock className="size-3" aria-hidden />
            Secured by Paystack · Mobile Money & card
          </p>
        ) : null}
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

function Progress({
  current,
  furthest,
  onJump,
}: {
  current: number;
  furthest: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const reachable = index <= furthest;

          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onJump(index)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex min-w-0 flex-1 flex-col gap-1.5 text-left",
                  reachable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors",
                    done || active ? "bg-brand-700" : "bg-line",
                  )}
                />
                <span
                  className={cn(
                    "hidden truncate text-[11.5px] font-semibold tracking-wide uppercase sm:block",
                    active ? "text-brand-800" : done ? "text-ink-soft" : "text-muted/70",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[12.5px] text-muted sm:hidden">
        Step {current + 1} of {STEPS.length} · {STEPS[current].label}
      </p>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h2 className="font-display text-[26px] leading-tight font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>
      ) : null}
    </header>
  );
}

function StepWho({
  selected,
  onSelect,
}: {
  selected: CustomerType;
  onSelect: (type: CustomerType) => void;
}) {
  return (
    <div>
      <StepHeading
        title="Who are you?"
        description="This decides which packages and rates we show you first. You can always browse everything else too."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {BOOKING_CATEGORY_CHOICES.map((choice) => {
          const isSelected = selected === choice.type;
          return (
            <button
              key={choice.type}
              type="button"
              onClick={() => onSelect(choice.type)}
              aria-pressed={isSelected}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150",
                isSelected
                  ? "border-brand-700 bg-brand-50/60 ring-2 ring-brand-700/15"
                  : "border-line bg-surface hover:border-line-strong hover:shadow-md hover:shadow-ink/5",
              )}
            >
              <span className="text-[26px] leading-none" aria-hidden>
                {choice.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-[15.5px] font-semibold text-ink">
                  {choice.label}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted">{choice.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPackage({
  packages,
  selected,
  onSelect,
  discountNote,
  isKnustStudent,
  showingAll,
  onToggleShowAll,
  hasNonStudentPackages,
}: {
  packages: FlowPackage[];
  selected: string | null;
  onSelect: (id: string) => void;
  discountNote: string | null;
  isKnustStudent: boolean;
  showingAll: boolean;
  onToggleShowAll: () => void;
  hasNonStudentPackages: boolean;
}) {
  return (
    <div>
      <StepHeading
        title={isKnustStudent && !showingAll ? "Choose your student package" : "Choose your package"}
        description="Every package includes the room, standard lighting and recording setup, Wi-Fi and air conditioning."
      />

      {isKnustStudent && hasNonStudentPackages ? (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="mb-5 text-[13.5px] font-semibold text-brand-700 underline underline-offset-4"
        >
          {showingAll ? "Show student packages only" : "View all studio packages"}
        </button>
      ) : null}

      {packages.length === 0 ? (
        <EmptyState
          title="No packages available"
          description="The studio has not published any bookable packages yet. Please check back shortly or contact us."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((pkg) => {
            const isSelected = selected === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => onSelect(pkg.id)}
                aria-pressed={isSelected}
                className={cn(
                  "group relative rounded-xl border p-5 text-left transition-all duration-150",
                  isSelected
                    ? "border-brand-700 bg-brand-50/60 ring-2 ring-brand-700/15"
                    : "border-line bg-surface hover:border-line-strong hover:shadow-md hover:shadow-ink/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-[19px] leading-tight font-semibold text-ink">
                        {pkg.name}
                      </h3>
                      {pkg.studentOnly ? <Badge tone="brand">KNUST Student</Badge> : null}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                      <Clock className="size-3.5" aria-hidden />
                      {formatDuration(pkg.durationMinutes)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-line-strong",
                    )}
                    aria-hidden
                  >
                    {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                </div>

                <p className="font-display mt-4 text-[26px] leading-none font-semibold text-ink">
                  {formatMoney(pkg.priceMinor)}
                </p>

                {pkg.summary ? (
                  <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{pkg.summary}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {discountNote ? (
        <Alert tone="info" className="mt-5">
          {discountNote}
        </Alert>
      ) : null}
    </div>
  );
}

function StepDate({
  packageId,
  selected,
  onSelect,
}: {
  packageId: string | null;
  selected: string | null;
  onSelect: (dateKey: string) => void;
}) {
  return (
    <div>
      <StepHeading
        title="Pick your date"
        description="Only dates the studio is genuinely free are selectable."
      />
      <div className="max-w-md">
        <AvailabilityCalendar
          packageId={packageId}
          selectedDate={selected}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function StepTime({
  day,
  loading,
  selected,
  durationMinutes,
  onSelect,
  onChangeDate,
}: {
  day: DayAvailability | null;
  loading: boolean;
  selected: number | null;
  durationMinutes: number;
  onSelect: (minute: number) => void;
  onChangeDate: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Choose a time"
        description={`Each slot covers your full ${formatDuration(durationMinutes)} session.`}
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !day ? (
        <EmptyState title="Choose a date first" description="Go back and pick a date to see times." />
      ) : day.slots.length === 0 ? (
        <EmptyState
          title={day.message ?? "No times available"}
          description="Try another date: the calendar shows which days still have space."
          action={
            <Button variant="outline" onClick={onChangeDate}>
              Choose another date
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {day.slots.map((slot) => {
              const isSelected = selected === slot.startMinute;
              return (
                <button
                  key={slot.startMinute}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onSelect(slot.startMinute)}
                  aria-pressed={isSelected}
                  title={slot.available ? undefined : slot.reason}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-center transition-all duration-150",
                    !slot.available
                      ? "cursor-not-allowed border-line bg-paper-deep text-muted/60"
                      : isSelected
                        ? "border-brand-700 bg-brand-700 text-white ring-2 ring-brand-700/20"
                        : "border-line bg-surface text-ink hover:border-brand-400 hover:bg-brand-50",
                  )}
                >
                  <span className="block text-[14px] font-semibold">
                    {formatMinuteOfDay12(slot.startMinute)}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[11.5px]",
                      isSelected ? "text-brand-100" : "text-muted",
                    )}
                  >
                    {slot.available ? `to ${formatMinuteOfDay12(slot.endMinute)}` : slot.reason}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onChangeDate}
            className="mt-5 text-[13.5px] font-semibold text-brand-700 underline underline-offset-4"
          >
            Choose a different date
          </button>
        </>
      )}
    </div>
  );
}

function StepAddOns({
  addOns,
  selections,
  onChange,
  durationMinutes,
}: {
  addOns: FlowAddOn[];
  selections: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  durationMinutes: number;
}) {
  const priceLabel = (addOn: FlowAddOn) => {
    switch (addOn.pricingUnit) {
      case "PER_HOUR": {
        const hours = Math.max(1, Math.ceil(durationMinutes / 60));
        return `${formatMoney(addOn.priceMinor)} / hour · ${formatMoney(addOn.priceMinor * hours)} for this session`;
      }
      case "CUSTOM":
        return "Custom pricing: we will quote you";
      default:
        return `${formatMoney(addOn.priceMinor)} per booking`;
    }
  };

  const toggle = (addOn: FlowAddOn) => {
    const next = { ...selections };
    if (next[addOn.id]) delete next[addOn.id];
    else next[addOn.id] = 1;
    onChange(next);
  };

  const setQuantity = (addOn: FlowAddOn, quantity: number) => {
    const clamped = Math.min(Math.max(1, quantity), addOn.maxQuantity);
    onChange({ ...selections, [addOn.id]: clamped });
  };

  return (
    <div>
      <StepHeading
        title="Add production services"
        description="Optional. Add the people and kit that turn a recording into finished content."
      />

      {addOns.length === 0 ? (
        <EmptyState
          title="No add-ons available"
          description="There are no optional services configured right now: continue to the next step."
        />
      ) : (
        <div className="space-y-2.5">
          {addOns.map((addOn) => {
            const quantity = selections[addOn.id];
            const isSelected = Boolean(quantity);

            return (
              <div
                key={addOn.id}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  isSelected ? "border-brand-700 bg-brand-50/50" : "border-line bg-surface",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(addOn)}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Add ${addOn.name}`}
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                      isSelected
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-line-strong bg-surface hover:border-muted",
                    )}
                  >
                    {isSelected ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggle(addOn)}
                      className="block text-left"
                    >
                      <span className="text-[15px] font-semibold text-ink">{addOn.name}</span>
                      {addOn.description ? (
                        <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
                          {addOn.description}
                        </span>
                      ) : null}
                      <span className="mt-1.5 block text-[13px] font-medium text-accent-700">
                        {priceLabel(addOn)}
                      </span>
                    </button>

                    {isSelected && addOn.maxQuantity > 1 ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[12.5px] font-medium text-muted">Quantity</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQuantity(addOn, quantity - 1)}
                            disabled={quantity <= 1}
                            className="rounded-md border border-line-strong p-1 text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-40"
                            aria-label={`Decrease ${addOn.name} quantity`}
                          >
                            <Minus className="size-3.5" aria-hidden />
                          </button>
                          <span className="w-7 text-center text-[14px] font-semibold text-ink">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity(addOn, quantity + 1)}
                            disabled={quantity >= addOn.maxQuantity}
                            className="rounded-md border border-line-strong p-1 text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-40"
                            aria-label={`Increase ${addOn.name} quantity`}
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CustomerState {
  name: string;
  email: string;
  phone: string;
  organisation: string;
  userType: CustomerType;
  studentIdRef: string;
}

function StepDetails({
  customer,
  onChange,
  purpose,
  onPurposeChange,
  specialRequirements,
  onSpecialRequirementsChange,
  errors,
  isKnustStudent,
  studentVerificationMethod,
  knustEmailDomain,
  emailLooksLikeKnust,
  studentIdCollectible,
}: {
  customer: CustomerState;
  onChange: (next: CustomerState) => void;
  purpose: string;
  onPurposeChange: (value: string) => void;
  specialRequirements: string;
  onSpecialRequirementsChange: (value: string) => void;
  errors: Record<string, string>;
  isKnustStudent: boolean;
  studentVerificationMethod: "EMAIL" | "STUDENT_ID" | "EITHER";
  knustEmailDomain: string;
  emailLooksLikeKnust: boolean;
  studentIdCollectible: boolean;
}) {
  const set = <K extends keyof CustomerState>(key: K, value: CustomerState[K]) =>
    onChange({ ...customer, [key]: value });

  return (
    <div>
      <StepHeading
        title="Your details"
        description="No account needed: just enough to confirm your booking and reach you on the day."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required error={errors["customer.name"]}>
          {(props) => (
            <Input
              {...props}
              value={customer.name}
              onChange={(event) => set("name", event.target.value)}
              autoComplete="name"
              placeholder="Ama Boateng"
              invalid={Boolean(errors["customer.name"])}
            />
          )}
        </Field>

        <Field label="Organisation" error={errors["customer.organisation"]}>
          {(props) => (
            <Input
              {...props}
              value={customer.organisation}
              onChange={(event) => set("organisation", event.target.value)}
              autoComplete="organization"
              placeholder="Optional"
            />
          )}
        </Field>

        <Field
          label="Email address"
          required
          error={errors["customer.email"]}
          description={
            isKnustStudent && studentVerificationMethod !== "STUDENT_ID"
              ? `Use your KNUST email (ending in @${knustEmailDomain}) to verify instantly.`
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              value={customer.email}
              onChange={(event) => set("email", event.target.value)}
              autoComplete="email"
              placeholder={isKnustStudent ? `you@${knustEmailDomain}` : "you@example.com"}
              invalid={Boolean(errors["customer.email"])}
            />
          )}
        </Field>

        <Field label="Phone number" required error={errors["customer.phone"]}>
          {(props) => (
            <Input
              {...props}
              type="tel"
              value={customer.phone}
              onChange={(event) => set("phone", event.target.value)}
              autoComplete="tel"
              placeholder="024 123 4567"
              invalid={Boolean(errors["customer.phone"])}
            />
          )}
        </Field>

        <div className="rounded-lg bg-paper-deep px-3.5 py-2.5 text-[13px] text-ink-soft sm:col-span-2">
          Booking as <span className="font-semibold text-ink">{CUSTOMER_TYPE_LABELS[customer.userType]}</span>.
          <button
            type="button"
            onClick={() => window.history.back()}
            className="ml-1.5 font-semibold text-brand-700 underline underline-offset-4"
          >
            Change
          </button>
        </div>

        {isKnustStudent && studentIdCollectible ? (
          <Field
            label="Student ID"
            className="sm:col-span-2"
            error={errors["customer.studentIdRef"]}
            description={
              emailLooksLikeKnust
                ? "Your KNUST email already verifies you instantly, so this is optional."
                : "We could not match a KNUST email, so we will verify your ID manually before your session is confirmed."
            }
          >
            {(props) => (
              <Input
                {...props}
                value={customer.studentIdRef}
                onChange={(event) => set("studentIdRef", event.target.value)}
                placeholder="e.g. 20482731"
              />
            )}
          </Field>
        ) : null}

        <Field label="Purpose of booking" className="sm:col-span-2">
          {(props) => (
            <Textarea
              {...props}
              value={purpose}
              onChange={(event) => onPurposeChange(event.target.value)}
              rows={2}
              placeholder="Optional: e.g. recording episode 4 of a research podcast"
            />
          )}
        </Field>

        <Field
          label="Special requirements"
          className="sm:col-span-2"
          description="Anything we should set up before you arrive: extra chairs, particular power, accessibility needs."
        >
          {(props) => (
            <Textarea
              {...props}
              value={specialRequirements}
              onChange={(event) => onSpecialRequirementsChange(event.target.value)}
              rows={3}
              placeholder="Optional"
            />
          )}
        </Field>
      </div>
    </div>
  );
}

function StepReview({
  quote,
  dateKey,
  startMinute,
  customer,
  purpose,
  specialRequirements,
  paymentEnabled,
  onEdit,
}: {
  quote: QuoteView | null;
  dateKey: string | null;
  startMinute: number | null;
  customer: CustomerState;
  purpose: string;
  specialRequirements: string;
  paymentEnabled: boolean;
  onEdit: (index: number) => void;
}) {
  const duration = quote?.durationMinutes ?? 0;

  const rows: { label: string; value: string; step: number }[] = [
    { label: "Booking as", value: CUSTOMER_TYPE_LABELS[customer.userType], step: stepIndexOf("who") },
    { label: "Package", value: quote?.packageName ?? "-", step: stepIndexOf("package") },
    {
      label: "Date",
      value: dateKey
        ? new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(
            new Date(
              Date.UTC(
                Number(dateKey.slice(0, 4)),
                Number(dateKey.slice(5, 7)) - 1,
                Number(dateKey.slice(8, 10)),
              ),
            ),
          )
        : "-",
      step: stepIndexOf("date"),
    },
    {
      label: "Time",
      value:
        startMinute !== null && duration
          ? `${formatTimeRange(startMinute, startMinute + duration)} (${formatDuration(duration)})`
          : "-",
      step: stepIndexOf("time"),
    },
    {
      label: "Add-ons",
      value: quote?.addOnLines.length
        ? quote.addOnLines
            .map((line) => (line.quantity > 1 ? `${line.name} ×${line.quantity}` : line.name))
            .join(", ")
        : "None",
      step: stepIndexOf("addons"),
    },
    { label: "Name", value: customer.name || "-", step: stepIndexOf("details") },
    { label: "Email", value: customer.email || "-", step: stepIndexOf("details") },
    { label: "Phone", value: customer.phone || "-", step: stepIndexOf("details") },
  ];

  if (customer.organisation) {
    rows.push({ label: "Organisation", value: customer.organisation, step: stepIndexOf("details") });
  }
  if (customer.studentIdRef) {
    rows.push({ label: "Student ID", value: customer.studentIdRef, step: stepIndexOf("details") });
  }
  if (purpose) rows.push({ label: "Purpose", value: purpose, step: stepIndexOf("details") });
  if (specialRequirements) {
    rows.push({
      label: "Special requirements",
      value: specialRequirements,
      step: stepIndexOf("details"),
    });
  }

  return (
    <div>
      <StepHeading
        title="Review your booking"
        description="Check everything is right, then continue to payment."
      />

      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-4 px-4 py-3">
            <dt className="w-36 shrink-0 text-[12.5px] font-semibold tracking-wide text-muted uppercase">
              {row.label}
            </dt>
            <dd className="min-w-0 flex-1 text-[14px] wrap-break-word text-ink">{row.value}</dd>
            <button
              type="button"
              onClick={() => onEdit(row.step)}
              className="shrink-0 text-[12.5px] font-semibold text-brand-700 underline underline-offset-4"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>

      {paymentEnabled ? (
        <Alert tone="info" className="mt-5" title="How payment works">
          You will be taken to Paystack to pay by Mobile Money, card or bank transfer. Your
          slot is held while you pay, and your booking is only confirmed once we have
          verified the payment with Paystack.
        </Alert>
      ) : (
        <Alert tone="warning" className="mt-5" title="Online payment is not set up yet">
          Your booking will be recorded and held, and the studio will contact you to arrange
          payment.
        </Alert>
      )}
    </div>
  );
}
