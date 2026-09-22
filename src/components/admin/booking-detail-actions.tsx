"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Copy,
  StickyNote,
  Undo2,
  UserX,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";
import {
  markBookingPaid,
  rescheduleBooking,
  saveBookingNotes,
  updateBookingStatus,
} from "@/app/admin/(dashboard)/bookings/actions";

/** Everything an admin can do to a single booking. */
export function BookingDetailActions({
  bookingId,
  reference,
  status,
  paymentStatus,
  internalNotes,
  dateKey,
  startTime,
  durationMinutes,
  customerLink,
  canWrite,
  canManagePayments,
}: {
  bookingId: string;
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  internalNotes: string;
  dateKey: string;
  startTime: string;
  durationMinutes: number;
  customerLink: string;
  canWrite: boolean;
  canManagePayments: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [notes, setNotes] = useState(internalNotes);
  const [savingNotes, setSavingNotes] = useState(false);

  const [statusModal, setStatusModal] = useState<BookingStatus | null>(null);
  const [reason, setReason] = useState("");

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reschedule, setReschedule] = useState({
    dateKey,
    startTime,
    durationMinutes: String(durationMinutes),
    allowOutsideHours: false,
  });
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const isClosed =
    status === BookingStatus.CANCELLED ||
    status === BookingStatus.REFUNDED ||
    status === BookingStatus.NO_SHOW;

  function changeStatus(next: BookingStatus, withReason = false) {
    if (withReason) {
      setReason("");
      setStatusModal(next);
      return;
    }
    applyStatus(next);
  }

  function applyStatus(next: BookingStatus, note?: string) {
    startTransition(async () => {
      const result = await updateBookingStatus({
        bookingId,
        status: next,
        reason: note || undefined,
      });
      if (result.ok) {
        toast.success("Updated", result.message);
        setStatusModal(null);
        router.refresh();
      } else {
        toast.error("Could not update", result.message);
      }
    });
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    const result = await saveBookingNotes({ bookingId, internalNotes: notes });
    setSavingNotes(false);
    if (result.ok) {
      toast.success("Notes saved");
      router.refresh();
    } else {
      toast.error("Could not save notes", result.message);
    }
  }

  async function handleReschedule() {
    setRescheduling(true);
    setRescheduleError(null);
    const result = await rescheduleBooking({ bookingId, ...reschedule });
    setRescheduling(false);

    if (result.ok) {
      toast.success("Rescheduled", result.message);
      setRescheduleOpen(false);
      router.refresh();
    } else {
      setRescheduleError(result.message ?? "Could not reschedule.");
    }
  }

  function handleMarkPaid() {
    startTransition(async () => {
      const result = await markBookingPaid(bookingId);
      if (result.ok) {
        toast.success("Payment recorded", result.message);
        router.refresh();
      } else {
        toast.error("Could not record payment", result.message);
      }
    });
  }

  async function copyCustomerLink() {
    const url = `${window.location.origin}${customerLink}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", "Send this to the customer to open their booking.");
    } catch {
      toast.error("Could not copy", url);
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Actions" />
        <CardBody className="space-y-2">
          {canWrite ? (
            <>
              {status === BookingStatus.PENDING_APPROVAL ? (
                <ActionButton
                  icon={<BadgeCheck className="size-4" aria-hidden />}
                  label="Approve booking"
                  onClick={() => changeStatus(BookingStatus.CONFIRMED)}
                  disabled={pending}
                />
              ) : null}

              {status === BookingStatus.PENDING_PAYMENT ? (
                <ActionButton
                  icon={<CheckCircle2 className="size-4" aria-hidden />}
                  label="Confirm without payment"
                  onClick={() => changeStatus(BookingStatus.CONFIRMED)}
                  disabled={pending}
                />
              ) : null}

              {status === BookingStatus.CONFIRMED ? (
                <ActionButton
                  icon={<CheckCircle2 className="size-4" aria-hidden />}
                  label="Mark in progress"
                  onClick={() => changeStatus(BookingStatus.IN_PROGRESS)}
                  disabled={pending}
                />
              ) : null}

              {status === BookingStatus.CONFIRMED || status === BookingStatus.IN_PROGRESS ? (
                <>
                  <ActionButton
                    icon={<CheckCircle2 className="size-4" aria-hidden />}
                    label="Mark completed"
                    onClick={() => changeStatus(BookingStatus.COMPLETED)}
                    disabled={pending}
                  />
                  <ActionButton
                    icon={<UserX className="size-4" aria-hidden />}
                    label="Mark as no show"
                    onClick={() => changeStatus(BookingStatus.NO_SHOW, true)}
                    disabled={pending}
                  />
                </>
              ) : null}

              {!isClosed ? (
                <>
                  <ActionButton
                    icon={<CalendarClock className="size-4" aria-hidden />}
                    label="Reschedule"
                    onClick={() => setRescheduleOpen(true)}
                    disabled={pending}
                  />
                  <ActionButton
                    icon={<XCircle className="size-4" aria-hidden />}
                    label="Cancel booking"
                    onClick={() => changeStatus(BookingStatus.CANCELLED, true)}
                    disabled={pending}
                    danger
                  />
                </>
              ) : null}
            </>
          ) : null}

          {canManagePayments ? (
            <>
              {paymentStatus === PaymentStatus.PENDING ? (
                <ActionButton
                  icon={<BadgeCheck className="size-4" aria-hidden />}
                  label="Record manual payment"
                  onClick={handleMarkPaid}
                  disabled={pending}
                />
              ) : null}

              {paymentStatus === PaymentStatus.PAID && status !== BookingStatus.REFUNDED ? (
                <ActionButton
                  icon={<Undo2 className="size-4" aria-hidden />}
                  label="Mark as refunded"
                  onClick={() => changeStatus(BookingStatus.REFUNDED, true)}
                  disabled={pending}
                  danger
                />
              ) : null}
            </>
          ) : null}

          <ActionButton
            icon={<Copy className="size-4" aria-hidden />}
            label="Copy customer link"
            onClick={copyCustomerLink}
          />
        </CardBody>
      </Card>

      {canWrite ? (
        <Card>
          <CardHeader
            title="Internal notes"
            description="Only staff see these: never the customer."
          />
          <CardBody className="space-y-3">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="e.g. guest arriving separately, needs two extra chairs"
              aria-label="Internal notes"
            />
            <Button
              onClick={handleSaveNotes}
              loading={savingNotes}
              size="sm"
              disabled={notes === internalNotes}
            >
              <StickyNote className="size-4" aria-hidden />
              Save notes
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {/* Status change with a reason */}
      <Modal
        open={statusModal !== null}
        onClose={() => setStatusModal(null)}
        title={
          statusModal === BookingStatus.CANCELLED
            ? `Cancel ${reference}?`
            : statusModal === BookingStatus.REFUNDED
              ? `Mark ${reference} as refunded?`
              : `Mark ${reference} as no show?`
        }
        description={
          statusModal === BookingStatus.CANCELLED
            ? "This frees the slot and emails the customer."
            : statusModal === BookingStatus.REFUNDED
              ? "This frees the slot and marks the payment refunded. Process the actual refund in Paystack."
              : "This frees the slot. The customer is not emailed."
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusModal(null)} disabled={pending}>
              Keep as is
            </Button>
            <Button
              variant="danger"
              onClick={() => statusModal && applyStatus(statusModal, reason)}
              loading={pending}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Field label="Reason" description="Included in the email where one is sent.">
          {(props) => (
            <Textarea
              {...props}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="e.g. studio maintenance brought forward"
            />
          )}
        </Field>
      </Modal>

      {/* Reschedule */}
      <Modal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title={`Reschedule ${reference}`}
        description="The new slot is checked against other bookings before anything moves."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRescheduleOpen(false)}
              disabled={rescheduling}
            >
              Cancel
            </Button>
            <Button onClick={handleReschedule} loading={rescheduling}>
              Reschedule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Date" required>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={reschedule.dateKey}
                onChange={(event) =>
                  setReschedule((current) => ({ ...current, dateKey: event.target.value }))
                }
              />
            )}
          </Field>

          <Field label="Start time" required description="On the half hour, e.g. 14:00 or 14:30.">
            {(props) => (
              <Input
                {...props}
                type="time"
                step={1800}
                value={reschedule.startTime}
                onChange={(event) =>
                  setReschedule((current) => ({ ...current, startTime: event.target.value }))
                }
              />
            )}
          </Field>

          <Field label="Duration (minutes)" required>
            {(props) => (
              <Input
                {...props}
                value={reschedule.durationMinutes}
                onChange={(event) =>
                  setReschedule((current) => ({
                    ...current,
                    durationMinutes: event.target.value,
                  }))
                }
                inputMode="numeric"
              />
            )}
          </Field>

          <Checkbox
            label="Allow outside opening hours"
            description="For sessions the studio is opening specially."
            checked={reschedule.allowOutsideHours}
            onChange={(event) =>
              setReschedule((current) => ({
                ...current,
                allowOutsideHours: event.target.checked,
              }))
            }
          />

          {rescheduleError ? <Alert tone="danger">{rescheduleError}</Alert> : null}
        </div>
      </Modal>
    </>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors disabled:opacity-50 ${
        danger
          ? "border-danger-100 text-danger-700 hover:bg-danger-50"
          : "border-line text-ink-soft hover:bg-paper-deep hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
