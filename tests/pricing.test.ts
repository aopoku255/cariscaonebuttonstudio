import { describe, expect, it } from "vitest";

import { AddOnPricingUnit, CustomerType } from "@/generated/prisma/enums";
import {
  type PricingAddOn,
  type PricingDiscountRule,
  computeQuote,
  selectDiscountRule,
} from "@/lib/booking/pricing";

/**
 * The pricing engine is pure, so these tests pin down the money rules exactly -
 * including the ones that protect revenue, like add-ons never being discounted.
 */

const THREE_HOUR = {
  id: "pkg_3h",
  name: "3 Hours",
  priceMinor: 55_000, // GH₵550
  durationMinutes: 180,
};

const CAMERA_OPERATOR: PricingAddOn = {
  id: "addon_cam",
  name: "Camera Operator",
  priceMinor: 15_000, // GH₵150 / hour
  pricingUnit: AddOnPricingUnit.PER_HOUR,
  maxQuantity: 2,
};

const EDITING: PricingAddOn = {
  id: "addon_edit",
  name: "Editing",
  priceMinor: 20_000,
  pricingUnit: AddOnPricingUnit.PER_BOOKING,
  maxQuantity: 5,
};

const FULL_PRODUCTION: PricingAddOn = {
  id: "addon_full",
  name: "Full Production",
  priceMinor: 0,
  pricingUnit: AddOnPricingUnit.CUSTOM,
  maxQuantity: 1,
};

const STUDENT_RULE: PricingDiscountRule = {
  id: "rule_student",
  name: "Student & Researcher rate",
  percentOff: 10,
  eligibleUserTypes: "STUDENT,RESEARCHER",
  requiresVerification: false,
  startsAt: null,
  endsAt: null,
  isActive: true,
  appliesToAllPackages: true,
  packageIds: [],
};

function quote(overrides: Partial<Parameters<typeof computeQuote>[0]> = {}) {
  return computeQuote({
    pkg: THREE_HOUR,
    addOns: [CAMERA_OPERATOR, EDITING, FULL_PRODUCTION],
    selections: [],
    customerType: CustomerType.CREATOR,
    customerIsVerified: false,
    discountRules: [],
    taxPercent: 0,
    taxLabel: "Service charge",
    currency: "GHS",
    now: new Date("2026-09-22T10:00:00Z"),
    ...overrides,
  });
}

describe("computeQuote: base pricing", () => {
  it("charges the package price with no add-ons or discounts", () => {
    const result = quote();
    expect(result.baseMinor).toBe(55_000);
    expect(result.subtotalMinor).toBe(55_000);
    expect(result.discountMinor).toBe(0);
    expect(result.totalMinor).toBe(55_000);
  });

  it("bills per-hour add-ons by whole started hours", () => {
    const result = quote({ selections: [{ addOnId: "addon_cam", quantity: 1 }] });
    // 3 hours × GH₵150
    expect(result.addOnsMinor).toBe(45_000);
    expect(result.totalMinor).toBe(100_000);
  });

  it("rounds a part-hour up when billing per-hour add-ons", () => {
    const result = quote({
      pkg: { ...THREE_HOUR, durationMinutes: 90, priceMinor: 30_000 },
      durationMinutes: 90,
      selections: [{ addOnId: "addon_cam", quantity: 1 }],
    });
    // 90 minutes bills as 2 operator hours
    expect(result.addOnLines[0].lineTotalMinor).toBe(30_000);
  });

  it("multiplies per-hour add-ons by quantity", () => {
    const result = quote({ selections: [{ addOnId: "addon_cam", quantity: 2 }] });
    expect(result.addOnsMinor).toBe(90_000);
  });

  it("clamps quantity to the add-on's maximum", () => {
    const result = quote({ selections: [{ addOnId: "addon_cam", quantity: 99 }] });
    expect(result.addOnLines[0].quantity).toBe(2);
  });

  it("charges nothing automatically for custom-priced add-ons but flags them", () => {
    const result = quote({ selections: [{ addOnId: "addon_full", quantity: 1 }] });
    expect(result.addOnsMinor).toBe(0);
    expect(result.requiresCustomQuote).toBe(true);
    expect(result.totalMinor).toBe(55_000);
  });

  it("ignores add-on ids that are not in the catalogue", () => {
    const result = quote({ selections: [{ addOnId: "addon_does_not_exist", quantity: 1 }] });
    expect(result.addOnLines).toHaveLength(0);
    expect(result.totalMinor).toBe(55_000);
  });
});

describe("computeQuote: discounts", () => {
  it("applies an eligible category discount to studio time", () => {
    const result = quote({
      customerType: CustomerType.STUDENT,
      discountRules: [STUDENT_RULE],
    });
    expect(result.discountMinor).toBe(5_500); // 10% of 55,000
    expect(result.totalMinor).toBe(49_500);
    expect(result.discountLabel).toContain("10%");
  });

  it("does not discount ineligible customer categories", () => {
    const result = quote({
      customerType: CustomerType.CORPORATE,
      discountRules: [STUDENT_RULE],
    });
    expect(result.discountMinor).toBe(0);
    expect(result.totalMinor).toBe(55_000);
  });

  it("never discounts add-ons, only studio time", () => {
    const result = quote({
      customerType: CustomerType.STUDENT,
      discountRules: [STUDENT_RULE],
      selections: [{ addOnId: "addon_edit", quantity: 1 }],
    });
    // 10% of the 55,000 studio time only: the 20,000 edit is charged in full.
    expect(result.discountMinor).toBe(5_500);
    expect(result.totalMinor).toBe(55_000 + 20_000 - 5_500);
  });

  it("withholds a verification-required discount from unverified customers", () => {
    const rule = { ...STUDENT_RULE, requiresVerification: true };
    expect(
      quote({ customerType: CustomerType.STUDENT, discountRules: [rule] }).discountMinor,
    ).toBe(0);
    expect(
      quote({
        customerType: CustomerType.STUDENT,
        customerIsVerified: true,
        discountRules: [rule],
      }).discountMinor,
    ).toBe(5_500);
  });

  it("picks the largest discount the customer is eligible for", () => {
    const generous = { ...STUDENT_RULE, id: "rule_big", name: "Launch offer", percentOff: 25 };
    const result = quote({
      customerType: CustomerType.STUDENT,
      discountRules: [STUDENT_RULE, generous],
    });
    expect(result.discountMinor).toBe(13_750); // 25%
  });
});

describe("selectDiscountRule: eligibility windows", () => {
  const now = new Date("2026-09-22T10:00:00Z");
  const base = { customerType: CustomerType.STUDENT, customerIsVerified: false, packageId: "pkg_3h", now };

  it("ignores inactive rules", () => {
    expect(selectDiscountRule([{ ...STUDENT_RULE, isActive: false }], base)).toBeNull();
  });

  it("ignores rules that have not started", () => {
    const rule = { ...STUDENT_RULE, startsAt: new Date("2026-10-01T00:00:00Z") };
    expect(selectDiscountRule([rule], base)).toBeNull();
  });

  it("ignores rules that have expired", () => {
    const rule = { ...STUDENT_RULE, endsAt: new Date("2026-09-01T00:00:00Z") };
    expect(selectDiscountRule([rule], base)).toBeNull();
  });

  it("honours package scoping", () => {
    const scoped = { ...STUDENT_RULE, appliesToAllPackages: false, packageIds: ["pkg_other"] };
    expect(selectDiscountRule([scoped], base)).toBeNull();
    expect(
      selectDiscountRule([{ ...scoped, packageIds: ["pkg_3h"] }], base),
    ).not.toBeNull();
  });
});

describe("computeQuote: memberships", () => {
  it("covers the whole session when enough prepaid hours remain", () => {
    const result = quote({
      membership: { id: "mem_1", remainingMinutes: 240, extraHourDiscountPercent: 15 },
    });
    expect(result.membershipMinutesUsed).toBe(180);
    expect(result.membershipCoveredMinor).toBe(55_000);
    expect(result.totalMinor).toBe(0);
  });

  it("covers part of the session pro-rata and charges the remainder", () => {
    const result = quote({
      membership: { id: "mem_1", remainingMinutes: 60, extraHourDiscountPercent: 0 },
    });
    expect(result.membershipMinutesUsed).toBe(60);
    // One of three hours covered: 55,000 / 3
    expect(result.membershipCoveredMinor).toBe(18_333);
    expect(result.totalMinor).toBe(55_000 - 18_333);
  });

  it("applies the member's extra-hour discount to the uncovered remainder", () => {
    const result = quote({
      membership: { id: "mem_1", remainingMinutes: 60, extraHourDiscountPercent: 20 },
    });
    const chargeable = 55_000 - 18_333;
    expect(result.discountMinor).toBe(18_333 + Math.round(chargeable * 0.2));
  });

  it("gives the customer the better of the member and category discounts, not both", () => {
    const result = quote({
      customerType: CustomerType.STUDENT,
      discountRules: [STUDENT_RULE], // 10%
      membership: { id: "mem_1", remainingMinutes: 0, extraHourDiscountPercent: 20 },
    });
    // The member rate (20%) beats the student rate (10%), and they do not stack.
    expect(result.membershipMinutesUsed).toBe(0);
    expect(result.discountMinor).toBe(11_000);
    expect(result.discountLabel).toContain("Member rate");
  });

  it("still applies the member rate once the prepaid hours are exhausted", () => {
    // This is the whole point of "discount on additional hours": the benefit applies
    // precisely when the included allowance has run out.
    const result = quote({
      membership: { id: "mem_1", remainingMinutes: 0, extraHourDiscountPercent: 15 },
    });
    expect(result.membershipCoveredMinor).toBe(0);
    expect(result.membershipId).toBeNull();
    expect(result.discountMinor).toBe(8_250); // 15% of 55,000
    expect(result.totalMinor).toBe(46_750);
  });
});

describe("computeQuote: tax", () => {
  it("applies tax to the discounted subtotal, not the list price", () => {
    const result = quote({
      customerType: CustomerType.STUDENT,
      discountRules: [STUDENT_RULE],
      taxPercent: 5,
    });
    const discounted = 55_000 - 5_500;
    expect(result.taxMinor).toBe(Math.round(discounted * 0.05));
    expect(result.totalMinor).toBe(discounted + result.taxMinor);
  });

  it("never returns a negative total", () => {
    const result = quote({
      membership: { id: "mem_1", remainingMinutes: 600, extraHourDiscountPercent: 100 },
    });
    expect(result.totalMinor).toBeGreaterThanOrEqual(0);
  });
});
