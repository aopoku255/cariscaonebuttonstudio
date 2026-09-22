"use client";

import { CreditCard, XCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cancelBookingByCustomer } from "@/app/(public)/booking/actions";
import { retryPayment } from "@/app/(public)/book/actions";

/** Pay-again and cancel controls on a customer's booking page. */
export function BookingActions({
  reference,
  accessToken,
  awaitingPayment,
  paymentEnabled,
  canCancel,
}: {
  reference: string;
  accessToken: string;
  awaitingPayment: boolean;
  paymentEnabled: boolean;
  canCancel: boolean;
  /** ISO timestamp: kept for callers that need it; cancellation windows are enforced server-side. */
  startsAt: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [paying, setPaying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  async function handlePay() {
    setPaying(true);
    const result = await retryPayment(reference);
    if (result.ok && result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    setPaying(false);
    toast.error("Could not start payment", result.message);
  }

  async function handleCancel() {
    setCancelling(true);
    const result = await cancelBookingByCustomer({ reference, token: accessToken, reason });
    setCancelling(false);
    setCancelOpen(false);

    if (result.ok) {
      toast.success("Booking cancelled", result.message);
      router.refresh();
    } else {
      toast.error("Could not cancel", result.message);
    }
  }

  return (
    <>
      {awaitingPayment && paymentEnabled ? (
        <Button onClick={handlePay} loading={paying}>
          <CreditCard className="size-4" aria-hidden />
          Pay now
        </Button>
      ) : null}

      {canCancel ? (
        <Button variant="ghost" onClick={() => setCancelOpen(true)}>
          <XCircle className="size-4" aria-hidden />
          Cancel booking
        </Button>
      ) : null}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this booking?"
        description="This frees the slot for someone else. Any refund follows the studio's cancellation policy."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep booking
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              Cancel booking
            </Button>
          </>
        }
      >
        <Field
          label="Reason (optional)"
          description="It helps us understand what to improve."
        >
          {(props) => (
            <Textarea
              {...props}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="e.g. a scheduling clash came up"
            />
          )}
        </Field>
      </Modal>
    </>
  );
}
