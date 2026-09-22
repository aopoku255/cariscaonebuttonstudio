import type { ReactNode } from "react";

import {
  BookingStatus,
  InquiryStatus,
  MembershipStatus,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-paper-deep text-ink-soft border-line-strong",
  brand: "bg-brand-50 text-brand-800 border-brand-200",
  accent: "bg-accent-50 text-accent-700 border-accent-200",
  success: "bg-success-50 text-success-700 border-success-100",
  warning: "bg-warning-50 text-warning-700 border-warning-100",
  danger: "bg-danger-50 text-danger-700 border-danger-100",
  info: "bg-info-50 text-info-700 border-info-100",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Single source of truth for how each status reads and looks across the app. */
export const BOOKING_STATUS_META: Record<BookingStatus, { label: string; tone: BadgeTone }> = {
  [BookingStatus.PENDING_PAYMENT]: { label: "Pending payment", tone: "warning" },
  [BookingStatus.PENDING_APPROVAL]: { label: "Pending approval", tone: "info" },
  [BookingStatus.CONFIRMED]: { label: "Confirmed", tone: "success" },
  [BookingStatus.IN_PROGRESS]: { label: "In progress", tone: "brand" },
  [BookingStatus.COMPLETED]: { label: "Completed", tone: "neutral" },
  [BookingStatus.CANCELLED]: { label: "Cancelled", tone: "danger" },
  [BookingStatus.REFUNDED]: { label: "Refunded", tone: "accent" },
  [BookingStatus.NO_SHOW]: { label: "No show", tone: "danger" },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  [PaymentStatus.PENDING]: { label: "Pending", tone: "warning" },
  [PaymentStatus.PAID]: { label: "Paid", tone: "success" },
  [PaymentStatus.FAILED]: { label: "Failed", tone: "danger" },
  [PaymentStatus.REFUNDED]: { label: "Refunded", tone: "accent" },
};

export const MEMBERSHIP_STATUS_META: Record<
  MembershipStatus,
  { label: string; tone: BadgeTone }
> = {
  [MembershipStatus.PENDING_PAYMENT]: { label: "Pending payment", tone: "warning" },
  [MembershipStatus.ACTIVE]: { label: "Active", tone: "success" },
  [MembershipStatus.EXPIRED]: { label: "Expired", tone: "neutral" },
  [MembershipStatus.CANCELLED]: { label: "Cancelled", tone: "danger" },
};

export const INQUIRY_STATUS_META: Record<InquiryStatus, { label: string; tone: BadgeTone }> = {
  [InquiryStatus.NEW]: { label: "New", tone: "info" },
  [InquiryStatus.IN_REVIEW]: { label: "In review", tone: "warning" },
  [InquiryStatus.CONTACTED]: { label: "Contacted", tone: "brand" },
  [InquiryStatus.CONVERTED]: { label: "Converted", tone: "success" },
  [InquiryStatus.CLOSED]: { label: "Closed", tone: "neutral" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const meta = BOOKING_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  const meta = MEMBERSHIP_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const meta = INQUIRY_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
