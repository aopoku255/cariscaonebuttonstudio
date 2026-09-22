"use client";

import { CalendarPlus, MinusCircle, Plus, PlusCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge, MembershipStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MembershipStatus } from "@/generated/prisma/enums";
import {
  adjustMembershipHours,
  createMembership,
  extendMembership,
  setMembershipStatus,
} from "@/app/admin/(dashboard)/memberships/actions";
import { formatLongDate, parseDateKey } from "@/lib/booking/time";
import { formatHours, formatMoney, minorToMajorString } from "@/lib/utils";

interface MembershipRow {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  packageName: string;
  status: MembershipStatus;
  totalMinutes: number;
  usedMinutes: number;
  startDate: string;
  expiryDate: string;
  pricePaidMinor: number;
  priorityBooking: boolean;
  extraHourDiscountPercent: number;
  autoRenew: boolean;
  usage: { id: string; minutesUsed: number; note: string | null; createdAt: string }[];
}

interface MembershipPackage {
  id: string;
  name: string;
  priceMinor: number;
  includedHours: number;
  validityDays: number;
  extraHourDiscountPercent: number;
  priorityBooking: boolean;
}

export function MembershipsManager({
  memberships,
  packages,
}: {
  memberships: MembershipRow[];
  packages: MembershipPackage[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    packageId: packages[0]?.id ?? "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    totalHours: String(packages[0]?.includedHours ?? 4),
    startDate: new Date().toISOString().slice(0, 10),
    validityDays: String(packages[0]?.validityDays ?? 30),
    status: MembershipStatus.ACTIVE as string,
    pricePaidMajor: minorToMajorString(packages[0]?.priceMinor ?? 0),
    priorityBooking: packages[0]?.priorityBooking ?? false,
    extraHourDiscountPercent: String(packages[0]?.extraHourDiscountPercent ?? 0),
    autoRenew: false,
  });

  const [adjusting, setAdjusting] = useState<MembershipRow | null>(null);
  const [hoursDelta, setHoursDelta] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");

  const [extending, setExtending] = useState<MembershipRow | null>(null);
  const [extraDays, setExtraDays] = useState("30");

  /**
   * Selecting a plan prefills its standard terms in one state update. Doing this in
   * the change handler rather than an effect means staff can then edit any of those
   * fields without the effect immediately overwriting their edit.
   */
  function selectPackage(packageId: string) {
    const pkg = packages.find((entry) => entry.id === packageId);
    setForm((current) => ({
      ...current,
      packageId,
      ...(pkg
        ? {
            totalHours: String(pkg.includedHours),
            validityDays: String(pkg.validityDays),
            pricePaidMajor: minorToMajorString(pkg.priceMinor),
            priorityBooking: pkg.priorityBooking,
            extraHourDiscountPercent: String(pkg.extraHourDiscountPercent),
          }
        : {}),
    }));
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleCreate() {
    setSaving(true);
    setErrors({});
    const result = await createMembership(form);
    setSaving(false);

    if (result.ok) {
      toast.success("Membership created", result.message);
      setCreateOpen(false);
      router.refresh();
    } else {
      setErrors(result.errors ?? {});
      toast.error("Could not create", result.message);
    }
  }

  async function handleAdjust() {
    if (!adjusting) return;
    setSaving(true);
    const result = await adjustMembershipHours({
      membershipId: adjusting.id,
      hoursDelta: Number(hoursDelta),
      note: adjustNote || undefined,
    });
    setSaving(false);

    if (result.ok) {
      toast.success("Hours updated", result.message);
      setAdjusting(null);
      setAdjustNote("");
      router.refresh();
    } else {
      toast.error("Could not update hours", result.message);
    }
  }

  async function handleExtend() {
    if (!extending) return;
    setSaving(true);
    const result = await extendMembership({
      membershipId: extending.id,
      extraDays: Number(extraDays),
    });
    setSaving(false);

    if (result.ok) {
      toast.success("Extended", result.message);
      setExtending(null);
      router.refresh();
    } else {
      toast.error("Could not extend", result.message);
    }
  }

  function handleStatus(membership: MembershipRow, status: MembershipStatus) {
    startTransition(async () => {
      const result = await setMembershipStatus(membership.id, status);
      if (result.ok) {
        toast.success("Updated", result.message);
        router.refresh();
      } else {
        toast.error("Could not update", result.message);
      }
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={packages.length === 0}>
          <Plus className="size-4" aria-hidden />
          Assign membership
        </Button>
      </div>

      {packages.length === 0 ? (
        <EmptyState
          title="No membership packages configured"
          description="Create a package in the Membership category first, then you can assign it to customers."
        />
      ) : memberships.length === 0 ? (
        <EmptyState
          title="No memberships yet"
          description="Assign a membership to give a customer a bundle of prepaid studio hours."
          action={<Button onClick={() => setCreateOpen(true)}>Assign a membership</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {memberships.map((membership) => {
            const remaining = Math.max(0, membership.totalMinutes - membership.usedMinutes);
            const percentUsed =
              membership.totalMinutes > 0
                ? Math.min(100, Math.round((membership.usedMinutes / membership.totalMinutes) * 100))
                : 0;

            return (
              <div key={membership.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink">
                      {membership.customerName}
                    </h3>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {membership.customerEmail}
                    </p>
                    <p className="mt-1 font-mono text-[11.5px] text-muted">
                      {membership.reference}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <MembershipStatusBadge status={membership.status} />
                    {membership.priorityBooking ? (
                      <Badge tone="accent">Priority</Badge>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-[13.5px] font-medium text-ink">
                  {membership.packageName}
                </p>

                {/* Hours used */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="text-muted">
                      {formatHours(membership.usedMinutes)} of{" "}
                      {formatHours(membership.totalMinutes)} hours used
                    </span>
                    <span className="font-semibold text-ink">
                      {formatHours(remaining)} left
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-deep"
                    role="progressbar"
                    aria-valuenow={percentUsed}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${percentUsed}% of hours used`}
                  >
                    <div
                      className={percentUsed >= 100 ? "h-full bg-danger-500" : "h-full bg-brand-600"}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[12.5px]">
                  <div>
                    <dt className="text-muted">Starts</dt>
                    <dd className="text-ink">
                      {formatLongDate(parseDateKey(membership.startDate)!)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Expires</dt>
                    <dd className="text-ink">
                      {formatLongDate(parseDateKey(membership.expiryDate)!)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Paid</dt>
                    <dd className="text-ink">{formatMoney(membership.pricePaidMinor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Extra-hour discount</dt>
                    <dd className="text-ink">{membership.extraHourDiscountPercent}%</dd>
                  </div>
                </dl>

                {membership.usage.length > 0 ? (
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-700">
                      Usage history
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {membership.usage.map((entry) => (
                        <li key={entry.id} className="text-[12px] text-muted">
                          <span className="font-medium text-ink-soft">
                            {entry.minutesUsed > 0
                              ? `-${formatHours(entry.minutesUsed)} hrs`
                              : entry.minutesUsed < 0
                                ? `+${formatHours(-entry.minutesUsed)} hrs`
                                : "-"}
                          </span>{" "}
                          {entry.note}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdjusting(membership);
                      setHoursDelta("1");
                    }}
                  >
                    <PlusCircle className="size-3.5" aria-hidden />
                    Adjust hours
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setExtending(membership);
                      setExtraDays("30");
                    }}
                  >
                    <CalendarPlus className="size-3.5" aria-hidden />
                    Extend
                  </Button>
                  {membership.status === MembershipStatus.ACTIVE ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStatus(membership, MembershipStatus.CANCELLED)}
                      disabled={pending}
                    >
                      <XCircle className="size-3.5" aria-hidden />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStatus(membership, MembershipStatus.ACTIVE)}
                      disabled={pending}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Assign a membership"
        description="Choosing a plan fills in its standard terms: change any of them for this member."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Create membership
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Plan" required className="sm:col-span-2" error={errors.packageId}>
            {(props) => (
              <Select
                {...props}
                value={form.packageId}
                onChange={(event) => selectPackage(event.target.value)}
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}: {formatMoney(pkg.priceMinor)} / {pkg.includedHours} hrs
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Customer name" required error={errors.customerName}>
            {(props) => (
              <Input
                {...props}
                value={form.customerName}
                onChange={(event) => set("customerName", event.target.value)}
                invalid={Boolean(errors.customerName)}
              />
            )}
          </Field>

          <Field label="Customer email" required error={errors.customerEmail}>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={form.customerEmail}
                onChange={(event) => set("customerEmail", event.target.value)}
                invalid={Boolean(errors.customerEmail)}
              />
            )}
          </Field>

          <Field label="Customer phone" error={errors.customerPhone}>
            {(props) => (
              <Input
                {...props}
                value={form.customerPhone}
                onChange={(event) => set("customerPhone", event.target.value)}
              />
            )}
          </Field>

          <Field label="Included hours" required error={errors.totalHours}>
            {(props) => (
              <Input
                {...props}
                value={form.totalHours}
                onChange={(event) => set("totalHours", event.target.value)}
                inputMode="decimal"
              />
            )}
          </Field>

          <Field label="Start date" required error={errors.startDate}>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={form.startDate}
                onChange={(event) => set("startDate", event.target.value)}
              />
            )}
          </Field>

          <Field label="Valid for (days)" required error={errors.validityDays}>
            {(props) => (
              <Input
                {...props}
                value={form.validityDays}
                onChange={(event) => set("validityDays", event.target.value)}
                inputMode="numeric"
              />
            )}
          </Field>

          <Field label="Amount paid (GH₵)" error={errors.pricePaidMajor}>
            {(props) => (
              <Input
                {...props}
                value={form.pricePaidMajor}
                onChange={(event) => set("pricePaidMajor", event.target.value)}
                inputMode="decimal"
              />
            )}
          </Field>

          <Field label="Extra-hour discount (%)" error={errors.extraHourDiscountPercent}>
            {(props) => (
              <Input
                {...props}
                value={form.extraHourDiscountPercent}
                onChange={(event) => set("extraHourDiscountPercent", event.target.value)}
                inputMode="numeric"
              />
            )}
          </Field>

          <Field label="Status" className="sm:col-span-2">
            {(props) => (
              <Select
                {...props}
                value={form.status}
                onChange={(event) => set("status", event.target.value)}
              >
                <option value={MembershipStatus.ACTIVE}>Active: hours usable now</option>
                <option value={MembershipStatus.PENDING_PAYMENT}>
                  Pending payment: activate once paid
                </option>
              </Select>
            )}
          </Field>

          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              label="Priority booking"
              description="Flags this member for priority in the calendar."
              checked={form.priorityBooking}
              onChange={(event) => set("priorityBooking", event.target.checked)}
            />
            <Checkbox
              label="Renew automatically"
              description="Off by default. Memberships never renew unless you turn this on."
              checked={form.autoRenew}
              onChange={(event) => set("autoRenew", event.target.checked)}
            />
          </div>
        </div>
      </Modal>

      {/* Adjust hours */}
      <Modal
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
        title="Adjust hours"
        description={
          adjusting
            ? `${adjusting.customerName} has ${formatHours(adjusting.totalMinutes - adjusting.usedMinutes)} hours left.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjusting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} loading={saving}>
              Apply
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={Number(hoursDelta) > 0 ? "primary" : "outline"}
              size="sm"
              onClick={() => setHoursDelta(String(Math.abs(Number(hoursDelta)) || 1))}
            >
              <PlusCircle className="size-4" aria-hidden />
              Add
            </Button>
            <Button
              variant={Number(hoursDelta) < 0 ? "primary" : "outline"}
              size="sm"
              onClick={() => setHoursDelta(String(-(Math.abs(Number(hoursDelta)) || 1)))}
            >
              <MinusCircle className="size-4" aria-hidden />
              Remove
            </Button>
          </div>

          <Field label="Hours" required description="Use a negative number to remove hours.">
            {(props) => (
              <Input
                {...props}
                value={hoursDelta}
                onChange={(event) => setHoursDelta(event.target.value)}
                inputMode="decimal"
              />
            )}
          </Field>

          <Field label="Note" description="Recorded in the usage history.">
            {(props) => (
              <Input
                {...props}
                value={adjustNote}
                onChange={(event) => setAdjustNote(event.target.value)}
                placeholder="e.g. goodwill credit after a technical fault"
              />
            )}
          </Field>
        </div>
      </Modal>

      {/* Extend */}
      <Modal
        open={extending !== null}
        onClose={() => setExtending(null)}
        title="Extend membership"
        description={
          extending
            ? `Currently expires ${formatLongDate(parseDateKey(extending.expiryDate)!)}.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExtending(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleExtend} loading={saving}>
              Extend
            </Button>
          </>
        }
      >
        <Field label="Extend by (days)" required>
          {(props) => (
            <Input
              {...props}
              value={extraDays}
              onChange={(event) => setExtraDays(event.target.value)}
              inputMode="numeric"
            />
          )}
        </Field>
      </Modal>
    </>
  );
}
