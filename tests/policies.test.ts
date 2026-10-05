import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveRefundTier, type RefundRules } from "@/lib/payments/refund-policy";
import { POLICY_CATALOGUE, policyPath } from "@/lib/policies/catalogue";
import { isAllowedHref, parsePolicy } from "@/lib/policies/markdown";
import { createTokenResolver } from "@/lib/policies/tokens";
import { allowedPolicyActions, canPerform, nextVersionLabel } from "@/lib/policies/workflow";
import { SETTING_DEFAULTS } from "@/lib/settings";
import { policyAcceptanceSchema } from "@/lib/validation/booking";

/**
 * The policy system's rules, tested without a database: what the parser will and will
 * not render, how placeholders and settings are quoted, the review workflow, the
 * refund tiers, and what counts as acceptance at checkout.
 */

const ROOT = join(__dirname, "..");
const defaults = { ...SETTING_DEFAULTS } as Record<string, string>;
const resolver = createTokenResolver(defaults);

describe("policy parser", () => {
  it("numbers sections and gives each a unique anchor", () => {
    const doc = parsePolicy("Intro.\n\n## Scope\n\nText.\n\n## Scope\n\nMore.", resolver);
    expect(doc.intro).toHaveLength(1);
    expect(doc.sections.map((s) => [s.number, s.id])).toEqual([
      [1, "scope"],
      [2, "scope-2"],
    ]);
  });

  it("treats HTML as plain text, never as markup", () => {
    const doc = parsePolicy('## A\n\n<script>alert(1)</script> <img src=x onerror="x">', resolver);
    const block = doc.sections[0].blocks[0];
    expect(block.type).toBe("paragraph");
    if (block.type !== "paragraph") return;
    expect(block.children).toEqual([
      { type: "text", value: '<script>alert(1)</script> <img src=x onerror="x">' },
    ]);
  });

  it("only links to this site, https, email and phone addresses", () => {
    expect(isAllowedHref("/privacy-policy")).toBe(true);
    expect(isAllowedHref("https://www.knust.edu.gh/about/knust/policies")).toBe(true);
    expect(isAllowedHref("mailto:a@b.co")).toBe(true);
    expect(isAllowedHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedHref("//evil.example")).toBe(false);
    expect(isAllowedHref("http://insecure.example")).toBe(false);
    expect(isAllowedHref("data:text/html,x")).toBe(false);

    const doc = parsePolicy("## A\n\n[click](javascript:alert(1)) and [ok](/terms-and-conditions)", resolver);
    const block = doc.sections[0].blocks[0];
    if (block.type !== "paragraph") throw new Error("expected a paragraph");
    const links = block.children.filter((node) => node.type === "link");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: "/terms-and-conditions" });
  });

  it("builds lists, notes and sub-headings", () => {
    const doc = parsePolicy("## A\n\n> Note text\n\n### Sub\n\n- one\n- two\n\n1. first\n2. second", resolver);
    expect(doc.sections[0].blocks.map((b) => b.type)).toEqual(["note", "subheading", "list", "list"]);
    const [, , bullets, numbered] = doc.sections[0].blocks;
    expect(bullets).toMatchObject({ ordered: false });
    expect(numbered).toMatchObject({ ordered: true });
  });
});

describe("policy tokens", () => {
  it("quotes a configured setting", () => {
    const doc = parsePolicy("## A\n\nHeld for {{booking.pendingExpiryMinutes}} minutes.", resolver);
    const block = doc.sections[0].blocks[0];
    if (block.type !== "paragraph") throw new Error("expected a paragraph");
    expect(block.children).toContainEqual({ type: "value", value: "30" });
    expect(doc.placeholders).toEqual([]);
  });

  it("shows a marked placeholder for anything not yet confirmed", () => {
    const doc = parsePolicy("## A\n\nContact {{legal.privacyEmail}}.", resolver);
    expect(doc.placeholders).toEqual(["Privacy contact"]);
  });

  it("never treats a setting's value as markup", () => {
    const hostile = createTokenResolver({ ...defaults, "legal.operatorName": "**x** [a](https://e.example) {{studio.name}}" });
    const doc = parsePolicy("## A\n\n{{legal.operatorName}}", hostile);
    const block = doc.sections[0].blocks[0];
    if (block.type !== "paragraph") throw new Error("expected a paragraph");
    expect(block.children).toEqual([
      { type: "value", value: "**x** [a](https://e.example) {{studio.name}}" },
    ]);
  });

  it("flags an unknown token instead of dropping it silently", () => {
    const doc = parsePolicy("## A\n\n{{not.a.setting}}", resolver);
    expect(doc.placeholders[0]).toContain("not.a.setting");
  });

  it("describes the cancellation tiers from the live settings", () => {
    const text = (settings: Record<string, string>) =>
      createTokenResolver(settings).block("block.cancellationTiers")!.join("\n");

    const single = text(defaults);
    expect(single).toContain("24 hours or more");
    expect(single).toContain("Less than 24 hours");
    expect(single).not.toContain("Between");

    const tiered = text({
      ...defaults,
      "cancellation.freeCancellationHours": "48",
      "cancellation.partialRefundHours": "12",
      "cancellation.partialRefundPercent": "50",
    });
    expect(tiered).toContain("Between 12 and 48 hours");
    expect(tiered).toContain("a refund of 50%");
    expect(tiered).toContain("Less than 12 hours");
  });

  it("only claims Data Protection Commission registration when it is confirmed", () => {
    const status = (settings: Record<string, string>) =>
      createTokenResolver(settings).block("block.dpcStatus")!.join(" ");

    expect(status(defaults)).not.toContain("is registered");
    expect(status({ ...defaults, "legal.dpcStatus": "REGISTERED" })).not.toContain("is registered");
    expect(
      status({ ...defaults, "legal.dpcStatus": "REGISTERED", "legal.dpcNumber": "ABC-123" }),
    ).toContain("Registration number: ABC-123");
  });
});

describe("the shipped policy documents", () => {
  const files = POLICY_CATALOGUE.map((policy) => ({
    policy,
    content: readFileSync(join(ROOT, "prisma", "policies", `${policy.slug}.md`), "utf8"),
  }));

  it("exist for every policy in the catalogue, with real sections", () => {
    for (const { policy, content } of files) {
      const doc = parsePolicy(content, resolver);
      expect(doc.sections.length, policy.slug).toBeGreaterThanOrEqual(5);
    }
  });

  it("use only tokens the system knows", () => {
    for (const { policy, content } of files) {
      const unknown = parsePolicy(content, resolver).placeholders.filter((label) =>
        label.startsWith("Unknown value"),
      );
      expect(unknown, policy.slug).toEqual([]);
    }
  });

  it("each state that they are not a KNUST policy and that KNUST rules take precedence", () => {
    for (const { policy, content } of files) {
      expect(content, policy.slug).toContain("not a policy of Kwame Nkrumah University of Science and Technology");
      expect(content, policy.slug).toMatch(/ha(s|ve) not been issued or approved by the University/);
      expect(content, policy.slug).toContain("that law or requirement applies");
    }
  });

  it("never ask for a KNUST password", () => {
    for (const slug of ["privacy-policy", "student-policy"]) {
      const content = files.find((file) => file.policy.slug === slug)!.content;
      expect(content).toMatch(/never ask for your KNUST portal password/);
    }
  });

  it("link only to pages that exist", () => {
    const known = new Set([
      ...POLICY_CATALOGUE.map((policy) => policyPath(policy.slug)),
      "/participant-release",
    ]);
    for (const { policy, content } of files) {
      for (const match of content.matchAll(/\]\((\/[^)#\s]*)/g)) {
        expect(known.has(match[1]), `${policy.slug} links to ${match[1]}`).toBe(true);
      }
    }
  });
});

describe("policy workflow", () => {
  const editor = { canManage: true, canPublish: false, requiredAtCheckout: false };
  const publisher = { canManage: true, canPublish: true, requiredAtCheckout: false };

  it("lets a drafter edit and submit, but not approve or publish", () => {
    expect(allowedPolicyActions("DRAFT", editor)).toEqual(["edit", "submit", "delete"]);
    expect(canPerform("UNDER_REVIEW", "approve", editor)).toBe(false);
    expect(canPerform("APPROVED", "publish", editor)).toBe(false);
  });

  it("requires review and approval before publishing", () => {
    expect(canPerform("DRAFT", "publish", publisher)).toBe(false);
    expect(canPerform("UNDER_REVIEW", "publish", publisher)).toBe(false);
    expect(canPerform("UNDER_REVIEW", "approve", publisher)).toBe(true);
    expect(canPerform("APPROVED", "publish", publisher)).toBe(true);
  });

  it("keeps published and archived versions read-only", () => {
    expect(canPerform("PUBLISHED", "edit", publisher)).toBe(false);
    expect(canPerform("ARCHIVED", "edit", publisher)).toBe(false);
    expect(allowedPolicyActions("ARCHIVED", publisher)).toEqual([]);
  });

  it("will not unpublish a policy customers accept at checkout", () => {
    expect(canPerform("PUBLISHED", "unpublish", publisher)).toBe(true);
    expect(canPerform("PUBLISHED", "unpublish", { ...publisher, requiredAtCheckout: true })).toBe(false);
  });

  it("gives someone with no policy permission nothing to do", () => {
    const none = { canManage: false, canPublish: false, requiredAtCheckout: false };
    for (const status of ["DRAFT", "UNDER_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"] as const) {
      expect(allowedPolicyActions(status, none)).toEqual([]);
    }
  });

  it("suggests the next version number", () => {
    expect(nextVersionLabel([])).toBe("1.0");
    expect(nextVersionLabel(["1.0"])).toBe("1.1");
    expect(nextVersionLabel(["1.0", "1.9", "1.10"])).toBe("1.11");
    expect(nextVersionLabel(["2", "1.4"])).toBe("2.1");
  });
});

describe("refund tiers", () => {
  const today: RefundRules = {
    freeCancellationHours: 24,
    lateRefundPercent: 0,
    partialRefundHours: 0,
    partialRefundPercent: 0,
    noShowRefundPercent: 0,
  };

  it("matches the previous single-threshold behaviour when the middle tier is off", () => {
    expect(resolveRefundTier(today, 48).percent).toBe(100);
    expect(resolveRefundTier(today, 24).percent).toBe(100);
    expect(resolveRefundTier(today, 23.9).percent).toBe(0);
    expect(resolveRefundTier(today, -3).percent).toBe(0);
    expect(resolveRefundTier({ ...today, lateRefundPercent: 40 }, 2).percent).toBe(40);
  });

  it("applies the middle tier between the two thresholds", () => {
    const tiered = { ...today, freeCancellationHours: 48, partialRefundHours: 12, partialRefundPercent: 50, lateRefundPercent: 10 };
    expect(resolveRefundTier(tiered, 48).percent).toBe(100);
    expect(resolveRefundTier(tiered, 47).percent).toBe(50);
    expect(resolveRefundTier(tiered, 12).percent).toBe(50);
    expect(resolveRefundTier(tiered, 11.9).percent).toBe(10);
  });

  it("ignores a middle tier that is not inside the free window", () => {
    const broken = { ...today, partialRefundHours: 30, partialRefundPercent: 50 };
    expect(resolveRefundTier(broken, 10).percent).toBe(0);
  });

  it("uses the no-show rule for a no-show", () => {
    expect(resolveRefundTier({ ...today, noShowRefundPercent: 25 }, -1, true).percent).toBe(25);
  });
});

describe("checkout acceptance", () => {
  it("needs each of the three boxes ticked separately", () => {
    const all = { terms: true, studioPolicy: true, privacy: true };
    expect(policyAcceptanceSchema.safeParse(all).success).toBe(true);
    expect(policyAcceptanceSchema.safeParse({ ...all, terms: false }).success).toBe(false);
    expect(policyAcceptanceSchema.safeParse({ ...all, studioPolicy: false }).success).toBe(false);
    expect(policyAcceptanceSchema.safeParse({ terms: true, studioPolicy: true }).success).toBe(false);
    expect(policyAcceptanceSchema.safeParse(undefined).success).toBe(false);
    expect(policyAcceptanceSchema.safeParse({ ...all, privacy: "true" }).success).toBe(false);
  });
});

describe("house style", () => {
  const EM_DASH = String.fromCharCode(0x2014);
  const SKIP = new Set(["node_modules", ".next", ".git", "generated"]);
  const EXTENSIONS = /\.(ts|tsx|mts|css|md|sql|prisma|json)$/;

  function collect(dir: string, found: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || name.startsWith(".")) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) collect(path, found);
      else if (EXTENSIONS.test(name)) found.push(path);
    }
    return found;
  }

  it("has no em dash anywhere in the source, content, tests or config", () => {
    const files = [
      ...collect(join(ROOT, "src")),
      ...collect(join(ROOT, "prisma")),
      ...collect(join(ROOT, "tests")),
      ...["proxy.ts", "next.config.ts", "prisma7.config.ts", "vitest.config.mts", "README.md", "package.json"].map(
        (name) => join(ROOT, name),
      ),
    ];
    const offenders = files.filter((path) => {
      try {
        return readFileSync(path, "utf8").includes(EM_DASH);
      } catch {
        return false;
      }
    });
    expect(offenders.map((path) => path.replace(`${ROOT}/`, ""))).toEqual([]);
  });
});
