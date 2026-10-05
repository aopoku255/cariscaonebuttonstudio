/**
 * Which refund tier applies to a cancellation. Kept free of database and server
 * imports so the rules can be tested directly.
 */

export interface RefundRules {
  freeCancellationHours: number;
  lateRefundPercent: number;
  /** 0 switches the middle tier off. */
  partialRefundHours: number;
  partialRefundPercent: number;
  noShowRefundPercent: number;
}

export interface RefundTier {
  percent: number;
  note: string;
}

export function hasPartialTier(rules: RefundRules): boolean {
  return rules.partialRefundHours > 0 && rules.partialRefundHours < rules.freeCancellationHours;
}

export function resolveRefundTier(
  rules: RefundRules,
  hoursUntilStart: number,
  isNoShow = false,
): RefundTier {
  if (isNoShow) {
    const percent = rules.noShowRefundPercent;
    return {
      percent,
      note:
        percent > 0
          ? `Marked as a no-show: ${percent}% refund under the current policy.`
          : "Marked as a no-show: no refund under the current policy.",
    };
  }

  if (hoursUntilStart >= rules.freeCancellationHours) {
    return {
      percent: 100,
      note: `Cancelled more than ${rules.freeCancellationHours} hours before the session: full refund.`,
    };
  }

  if (hasPartialTier(rules) && hoursUntilStart >= rules.partialRefundHours) {
    const percent = rules.partialRefundPercent;
    return {
      percent,
      note: `Cancelled between ${rules.partialRefundHours} and ${rules.freeCancellationHours} hours before the session: ${percent}% refund under the current policy.`,
    };
  }

  const percent = rules.lateRefundPercent;
  const window = hasPartialTier(rules) ? rules.partialRefundHours : rules.freeCancellationHours;
  return {
    percent,
    note:
      percent > 0
        ? `Cancelled inside ${window} hours: ${percent}% refund under the current policy.`
        : `Cancelled inside ${window} hours: no refund under the current policy.`,
  };
}
