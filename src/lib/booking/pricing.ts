import { AddOnPricingUnit, type CustomerType } from "@/generated/prisma/enums";

/**
 * The booking pricing engine.
 *
 * This module is deliberately pure: it takes catalogue rows that were read from the
 * database and returns the money breakdown. Nothing here ever reads a price from the
 * client: callers pass database entities, and the client may only choose *which*
 * package and add-ons to reference, never what they cost.
 *
 * Order of operations:
 *   1. Base studio price comes from the package row.
 *   2. An active membership absorbs up to its remaining minutes, pro-rata.
 *   3. One discount applies to the remaining studio time: the better of the
 *      customer-category discount (student/researcher) and the member's extra-hour
 *      discount. They do not stack, so the customer always gets the larger of the two.
 *   4. Add-ons are charged in full and are not discounted.
 *   5. Tax/service charge, if configured, applies to the discounted subtotal.
 */

export interface PricingPackage {
  id: string;
  name: string;
  priceMinor: number;
  durationMinutes: number;
}

export interface PricingAddOn {
  id: string;
  name: string;
  priceMinor: number;
  pricingUnit: AddOnPricingUnit;
  maxQuantity: number;
}

export interface PricingDiscountRule {
  id: string;
  name: string;
  percentOff: number;
  eligibleUserTypes: string;
  requiresVerification: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  appliesToAllPackages: boolean;
  packageIds: string[];
}

export interface PricingMembership {
  id: string;
  remainingMinutes: number;
  extraHourDiscountPercent: number;
}

export interface AddOnSelection {
  addOnId: string;
  quantity: number;
}

export interface PricingInput {
  pkg: PricingPackage;
  /** Billable minutes. Defaults to the package duration; admins may override. */
  durationMinutes?: number;
  addOns: PricingAddOn[];
  selections: AddOnSelection[];
  customerType: CustomerType;
  customerIsVerified: boolean;
  discountRules: PricingDiscountRule[];
  membership?: PricingMembership | null;
  taxPercent: number;
  taxLabel: string;
  currency: string;
  now?: Date;
}

export interface QuoteAddOnLine {
  addOnId: string;
  name: string;
  pricingUnit: AddOnPricingUnit;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  /** CUSTOM-priced add-ons are recorded on the booking but quoted by the team. */
  requiresCustomQuote: boolean;
}

export interface Quote {
  packageId: string;
  packageName: string;
  durationMinutes: number;
  /** Full list price of the studio time, before any membership or discount. */
  baseMinor: number;
  /** Portion of the studio time covered by prepaid membership hours. */
  membershipCoveredMinor: number;
  membershipMinutesUsed: number;
  membershipId: string | null;
  addOnLines: QuoteAddOnLine[];
  addOnsMinor: number;
  /** baseMinor + addOnsMinor, i.e. the list price of everything selected. */
  subtotalMinor: number;
  discountMinor: number;
  discountLabel: string | null;
  taxMinor: number;
  taxLabel: string;
  totalMinor: number;
  currency: string;
  /** True when at least one selected add-on needs a manual quote. */
  requiresCustomQuote: boolean;
}

/** Parse the comma-separated `eligibleUserTypes` column into a set. */
export function parseEligibleTypes(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
}

/**
 * Pick the discount rule that gives the customer the largest percentage off, among
 * the rules they are actually eligible for right now.
 */
export function selectDiscountRule(
  rules: PricingDiscountRule[],
  params: {
    customerType: CustomerType;
    customerIsVerified: boolean;
    packageId: string;
    now: Date;
  },
): PricingDiscountRule | null {
  const eligible = rules.filter((rule) => {
    if (!rule.isActive) return false;
    if (rule.percentOff <= 0) return false;
    if (rule.startsAt && params.now < rule.startsAt) return false;
    if (rule.endsAt && params.now > rule.endsAt) return false;
    if (rule.requiresVerification && !params.customerIsVerified) return false;
    if (!parseEligibleTypes(rule.eligibleUserTypes).has(params.customerType)) return false;
    if (!rule.appliesToAllPackages && !rule.packageIds.includes(params.packageId)) return false;
    return true;
  });

  if (eligible.length === 0) return null;
  return eligible.reduce((best, rule) => (rule.percentOff > best.percentOff ? rule : best));
}

function lineTotalFor(
  addOn: PricingAddOn,
  quantity: number,
  durationMinutes: number,
): number {
  switch (addOn.pricingUnit) {
    case AddOnPricingUnit.PER_HOUR: {
      // Bill whole started hours so a 90-minute booking pays for 2 operator hours.
      const hours = Math.max(1, Math.ceil(durationMinutes / 60));
      return addOn.priceMinor * hours * quantity;
    }
    case AddOnPricingUnit.PER_BOOKING:
    case AddOnPricingUnit.FIXED:
      return addOn.priceMinor * quantity;
    case AddOnPricingUnit.CUSTOM:
      // Quoted manually by the team; carries no automatic charge.
      return 0;
    default:
      return 0;
  }
}

export function computeQuote(input: PricingInput): Quote {
  const now = input.now ?? new Date();
  const durationMinutes = Math.max(
    0,
    Math.round(input.durationMinutes ?? input.pkg.durationMinutes),
  );

  const baseMinor = Math.max(0, Math.round(input.pkg.priceMinor));

  // --- 1. Membership absorption -------------------------------------------------
  let membershipMinutesUsed = 0;
  let membershipCoveredMinor = 0;
  let membershipId: string | null = null;

  const membership = input.membership;
  if (membership && membership.remainingMinutes > 0 && durationMinutes > 0) {
    membershipMinutesUsed = Math.min(membership.remainingMinutes, durationMinutes);
    membershipCoveredMinor = Math.round((baseMinor * membershipMinutesUsed) / durationMinutes);
    membershipId = membership.id;
  }

  const chargeableBaseMinor = Math.max(0, baseMinor - membershipCoveredMinor);

  // --- 2. Best available discount on the remaining studio time -------------------
  const categoryRule = selectDiscountRule(input.discountRules, {
    customerType: input.customerType,
    customerIsVerified: input.customerIsVerified,
    packageId: input.pkg.id,
    now,
  });

  const memberPercent = membership?.extraHourDiscountPercent ?? 0;
  const categoryPercent = categoryRule?.percentOff ?? 0;

  let discountPercent = 0;
  let discountLabel: string | null = null;

  if (memberPercent > categoryPercent && memberPercent > 0) {
    discountPercent = memberPercent;
    discountLabel = `Member rate (${memberPercent}% off additional hours)`;
  } else if (categoryRule && categoryPercent > 0) {
    discountPercent = categoryPercent;
    discountLabel = `${categoryRule.name} (${categoryPercent}% off)`;
  }

  // Membership hours are already free; only the chargeable remainder is discounted.
  const discountMinor = Math.round((chargeableBaseMinor * discountPercent) / 100);

  // --- 3. Add-ons ---------------------------------------------------------------
  const addOnById = new Map(input.addOns.map((addOn) => [addOn.id, addOn]));
  const addOnLines: QuoteAddOnLine[] = [];
  let addOnsMinor = 0;
  let requiresCustomQuote = false;

  for (const selection of input.selections) {
    const addOn = addOnById.get(selection.addOnId);
    if (!addOn) continue;

    const quantity = Math.min(
      Math.max(1, Math.floor(selection.quantity || 1)),
      Math.max(1, addOn.maxQuantity),
    );
    const lineTotalMinor = lineTotalFor(addOn, quantity, durationMinutes);
    const isCustom = addOn.pricingUnit === AddOnPricingUnit.CUSTOM;
    if (isCustom) requiresCustomQuote = true;

    addOnLines.push({
      addOnId: addOn.id,
      name: addOn.name,
      pricingUnit: addOn.pricingUnit,
      unitPriceMinor: addOn.priceMinor,
      quantity,
      lineTotalMinor,
      requiresCustomQuote: isCustom,
    });
    addOnsMinor += lineTotalMinor;
  }

  // --- 4. Totals ----------------------------------------------------------------
  // The subtotal shown to the customer is the list price of everything selected;
  // membership cover and the discount are then subtracted as visible lines.
  const subtotalMinor = baseMinor + addOnsMinor;
  const totalDeductionMinor = membershipCoveredMinor + discountMinor;
  const taxableMinor = Math.max(0, subtotalMinor - totalDeductionMinor);
  const taxMinor = Math.round((taxableMinor * Math.max(0, input.taxPercent)) / 100);
  const totalMinor = Math.max(0, taxableMinor + taxMinor);

  return {
    packageId: input.pkg.id,
    packageName: input.pkg.name,
    durationMinutes,
    baseMinor,
    membershipCoveredMinor,
    membershipMinutesUsed,
    membershipId,
    addOnLines,
    addOnsMinor,
    subtotalMinor,
    // Reported as a single "discount" figure covering membership cover + percentage off,
    // which is what the customer sees on the summary and what is stored on the booking.
    discountMinor: totalDeductionMinor,
    discountLabel:
      membershipCoveredMinor > 0
        ? [
            `${(membershipMinutesUsed / 60).toFixed(membershipMinutesUsed % 60 === 0 ? 0 : 1)} membership hour(s) applied`,
            discountLabel,
          ]
            .filter(Boolean)
            .join(" · ")
        : discountLabel,
    taxMinor,
    taxLabel: input.taxLabel,
    totalMinor,
    currency: input.currency,
    requiresCustomQuote,
  };
}
