import type { TokenResolver } from "@/lib/policies/markdown";
import { hasPartialTier } from "@/lib/payments/refund-policy";

/**
 * Values the policy documents can quote with `{{token}}`.
 *
 * Every token maps to something an administrator controls in Settings. When that
 * setting is blank the document shows a marked placeholder carrying the label below,
 * so nothing the studio has not confirmed is ever stated as fact.
 *
 * No server-only imports: the admin preview resolves tokens in the browser.
 */

export type PolicySettings = Record<string, string>;

/** Settings that may be quoted directly, with the label used for a placeholder. */
export const SETTING_TOKENS: Record<string, string> = {
  "studio.name": "Studio name",
  "studio.parentOrg": "Parent organisation",
  "studio.location": "Studio location",
  "studio.phone": "Studio phone number",
  "studio.email": "Studio email address",
  "pricing.currency": "Currency",
  "booking.leadTimeHours": "Minimum notice for a booking, in hours",
  "booking.maxAdvanceDays": "How far ahead bookings open, in days",
  "booking.pendingExpiryMinutes": "Time an unpaid slot is held, in minutes",
  "booking.arrivalGuidance": "Arrival and check-in requirement",
  "booking.lateArrivalRule": "Late arrival rule",
  "booking.overtimeRule": "Overtime rule",
  "booking.rescheduleRule": "Rescheduling rule",
  "safety.studioCapacity": "Maximum number of people in the studio",
  "cancellation.freeCancellationHours": "Free cancellation window, in hours",
  "student.knustEmailDomain": "KNUST student email domain",
  "legal.operatorName": "Legal name of the studio operator",
  "legal.supportEmail": "Studio support contact",
  "legal.privacyEmail": "Privacy contact",
  "legal.managerContact": "Studio manager contact",
  "legal.emergencyContact": "Approved emergency contact",
  "legal.knustReportingContact": "Official KNUST safeguarding and reporting contact",
  "legal.dpcNumber": "Data Protection Commission registration number",
  "legal.dataProtectionSupervisor": "Data protection supervisor",
  "legal.retentionPeriod": "Approved retention period",
  "legal.refundProcessingTime": "Approved refund processing time",
  "legal.providerFeesRule": "Rule on payment provider fees",
};

/** The legal and operational settings a studio still has to confirm. */
export const CONFIRMABLE_SETTINGS = Object.keys(SETTING_TOKENS).filter(
  (key) =>
    key.startsWith("legal.") ||
    key.startsWith("safety.") ||
    ["booking.arrivalGuidance", "booking.lateArrivalRule", "booking.overtimeRule", "booking.rescheduleRule"].includes(key),
);

function minutesLabel(raw: string | undefined): string | null {
  const minutes = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (rest) parts.push(`${rest} minutes`);
  return parts.join(" ");
}

function int(settings: PolicySettings, key: string): number {
  const parsed = Number.parseInt(settings[key] ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function refundPhrase(percent: number): string {
  if (percent >= 100) return "a full refund of the amount paid for the booking";
  if (percent <= 0) return "no refund";
  return `a refund of ${percent}% of the amount paid for the booking`;
}

function cancellationTiers(settings: PolicySettings): string[] {
  const free = int(settings, "cancellation.freeCancellationHours");
  const late = Math.min(100, int(settings, "cancellation.lateRefundPercent"));
  const rules = {
    freeCancellationHours: free,
    lateRefundPercent: late,
    partialRefundHours: int(settings, "cancellation.partialRefundHours"),
    partialRefundPercent: Math.min(100, int(settings, "cancellation.partialRefundPercent")),
    noShowRefundPercent:
      (settings["cancellation.noShowRefundPercent"] ?? "").trim() === ""
        ? late
        : Math.min(100, int(settings, "cancellation.noShowRefundPercent")),
  };

  const lines = [
    `- **${free} hours or more before the session starts:** ${refundPhrase(100)}, or a reschedule.`,
  ];
  if (hasPartialTier(rules)) {
    lines.push(
      `- **Between ${rules.partialRefundHours} and ${free} hours before the session starts:** ${refundPhrase(rules.partialRefundPercent)}.`,
      `- **Less than ${rules.partialRefundHours} hours before the session starts:** ${refundPhrase(late)}.`,
    );
  } else {
    lines.push(`- **Less than ${free} hours before the session starts:** ${refundPhrase(late)}.`);
  }
  lines.push(`- **No-show (the customer does not attend):** ${refundPhrase(rules.noShowRefundPercent)}.`);
  return lines;
}

function dpcStatus(settings: PolicySettings): string[] {
  const number = (settings["legal.dpcNumber"] ?? "").trim();
  if (settings["legal.dpcStatus"] === "REGISTERED" && number) {
    return [
      `The operator of {{studio.name}} is registered with the Data Protection Commission of Ghana. Registration number: ${number.replace(/[{}[\]()*]/g, "")}.`,
    ];
  }
  return [
    "Registration status with the Data Protection Commission of Ghana: {{legal.dpcRegistration}}.",
  ];
}

export function createTokenResolver(settings: PolicySettings): TokenResolver {
  return {
    inline(key) {
      if (key === "booking.minDuration" || key === "booking.maxDuration" || key === "booking.interval") {
        const source =
          key === "booking.minDuration"
            ? "booking.minDurationMinutes"
            : key === "booking.maxDuration"
              ? "booking.maxDurationMinutes"
              : "booking.intervalMinutes";
        const label = minutesLabel(settings[source]);
        return label ? { value: label } : { placeholder: "Booking length setting" };
      }
      if (key === "legal.dpcRegistration") {
        return { placeholder: "not yet confirmed by the studio" };
      }

      const label = SETTING_TOKENS[key];
      if (!label) return { placeholder: `Unknown value "${key}"` };

      const value = (settings[key] ?? "").trim();
      return value ? { value } : { placeholder: label };
    },
    block(key) {
      if (key === "block.cancellationTiers") return cancellationTiers(settings);
      if (key === "block.dpcStatus") return dpcStatus(settings);
      return null;
    },
  };
}
