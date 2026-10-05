"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { roleHas } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { policyPath } from "@/lib/policies/catalogue";
import { slugify } from "@/lib/policies/markdown";
import {
  canPerform,
  nextVersionLabel,
  type PolicyAction,
  POLICY_STATUS_LABELS,
} from "@/lib/policies/workflow";
import { newPolicySchema, policyVersionSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Policy management.
 *
 * Every action re-checks the permission and the workflow rule on the server: the
 * buttons in the editor are a convenience, not the control. A published version is
 * never edited in place. Changing a published policy means drafting a new version,
 * which replaces the old one only when it is published in its turn.
 */

function toDate(key: string | undefined): Date | null {
  return key ? new Date(`${key}T00:00:00.000Z`) : null;
}

function refreshPolicy(policyId: string, slug: string) {
  revalidatePath("/admin/policies");
  revalidatePath(`/admin/policies/${policyId}`, "layout");
  revalidatePath(policyPath(slug));
  // The footer lists published policies on every public page.
  revalidatePath("/", "layout");
}

async function loadVersion(versionId: string) {
  return prisma.policyVersion.findUnique({
    where: { id: versionId },
    include: { policy: true },
  });
}

/** Create a policy beyond the standard eight, with an empty first draft. */
export async function createPolicy(payload: unknown): Promise<ActionResult<{ id: string; versionId: string }>> {
  const admin = await requireAdmin("policies:manage");

  const parsed = newPolicySchema.safeParse(payload);
  if (!parsed.success) return actionError("Please check the form.", fieldErrors(parsed.error));

  const slug = slugify(parsed.data.title);
  if (await prisma.policy.findUnique({ where: { slug } })) {
    return actionError("A policy with that title already exists.", {
      title: "Choose a different title",
    });
  }

  const last = await prisma.policy.aggregate({ _max: { sortOrder: true } });
  const policy = await prisma.policy.create({
    data: {
      slug,
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
      versions: {
        create: {
          version: "1.0",
          title: parsed.data.title,
          content: "Write a short introduction here.\n\n## First section\n\nWrite the first section here.\n",
          status: "DRAFT",
          createdByAdminId: admin.id,
          createdByName: admin.name,
        },
      },
    },
    include: { versions: true },
  });

  await recordAudit(admin, {
    action: "policy.create",
    entity: "Policy",
    entityId: policy.id,
    summary: `Created policy "${policy.title}"`,
  });
  revalidatePath("/admin/policies");
  return actionOk({ id: policy.id, versionId: policy.versions[0].id }, "Policy created as a draft.");
}

/** Start a new draft, copied from the published version (or the newest one there is). */
export async function startDraft(policyId: string): Promise<ActionResult<{ versionId: string }>> {
  const admin = await requireAdmin("policies:manage");

  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    include: { versions: { orderBy: { createdAt: "desc" } } },
  });
  if (!policy) return actionError("That policy no longer exists.");

  const open = policy.versions.find((version) =>
    ["DRAFT", "UNDER_REVIEW", "APPROVED"].includes(version.status),
  );
  if (open) {
    return actionError(
      `Version ${open.version} is already in progress (${POLICY_STATUS_LABELS[open.status]}). Finish or delete it first.`,
    );
  }

  const source =
    policy.versions.find((version) => version.status === "PUBLISHED") ?? policy.versions[0];

  const draft = await prisma.policyVersion.create({
    data: {
      policyId,
      version: nextVersionLabel(policy.versions.map((version) => version.version)),
      title: source?.title ?? policy.title,
      content: source?.content ?? "",
      status: "DRAFT",
      previousVersionId: source?.id ?? null,
      createdByAdminId: admin.id,
      createdByName: admin.name,
    },
  });

  await recordAudit(admin, {
    action: "policy.draft",
    entity: "PolicyVersion",
    entityId: draft.id,
    summary: `Started draft ${draft.version} of "${policy.title}"`,
  });
  refreshPolicy(policyId, policy.slug);
  return actionOk({ versionId: draft.id }, `Draft ${draft.version} created.`);
}

export async function savePolicyDraft(versionId: string, payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("policies:manage");

  const version = await loadVersion(versionId);
  if (!version) return actionError("That version no longer exists.");
  if (version.status !== "DRAFT") {
    return actionError("Only a draft can be edited. Return this version to draft first.");
  }

  const parsed = policyVersionSchema.safeParse(payload);
  if (!parsed.success) return actionError("Please check the form.", fieldErrors(parsed.error));

  const clash = await prisma.policyVersion.findFirst({
    where: { policyId: version.policyId, version: parsed.data.version, NOT: { id: versionId } },
  });
  if (clash) {
    return actionError("That version number is already used for this policy.", {
      version: "Already used",
    });
  }

  await prisma.policyVersion.update({
    where: { id: versionId },
    data: {
      title: parsed.data.title,
      version: parsed.data.version,
      content: parsed.data.content,
      effectiveDate: toDate(parsed.data.effectiveDate),
      lastUpdatedDate: toDate(parsed.data.lastUpdatedDate),
      changeReason: parsed.data.changeReason ?? null,
    },
  });

  await recordAudit(admin, {
    action: "policy.save",
    entity: "PolicyVersion",
    entityId: versionId,
    summary: `Saved draft ${parsed.data.version} of "${version.policy.title}"`,
  });
  refreshPolicy(version.policyId, version.policy.slug);
  return actionOk(undefined, "Draft saved.");
}

const TRANSITION_MESSAGES: Record<Exclude<PolicyAction, "edit">, string> = {
  submit: "Sent for review.",
  returnToDraft: "Returned to draft.",
  approve: "Approved. It can now be published.",
  publish: "Published. This is now the version the public sees.",
  unpublish: "Unpublished. The policy is no longer shown on the website.",
  archive: "Archived.",
  delete: "Draft deleted.",
};

/** Move a version through the workflow. */
export async function transitionPolicyVersion(
  versionId: string,
  action: Exclude<PolicyAction, "edit">,
): Promise<ActionResult> {
  const admin = await requireAdmin("policies:manage");

  const version = await loadVersion(versionId);
  if (!version) return actionError("That version no longer exists.");

  const allowed = canPerform(version.status, action, {
    canManage: roleHas(admin.role, "policies:manage"),
    canPublish: roleHas(admin.role, "policies:publish"),
    requiredAtCheckout: version.policy.requiredAtCheckout,
  });
  if (!allowed) {
    return actionError(
      action === "unpublish" && version.policy.requiredAtCheckout
        ? "Customers accept this policy at checkout, so it cannot be unpublished. Publish a newer version to replace it."
        : "You cannot do that with this version in its current state.",
    );
  }

  const now = new Date();
  const label = `${version.version} of "${version.policy.title}"`;

  switch (action) {
    case "submit":
      await prisma.policyVersion.update({ where: { id: versionId }, data: { status: "UNDER_REVIEW" } });
      break;
    case "returnToDraft":
      await prisma.policyVersion.update({
        where: { id: versionId },
        data: { status: "DRAFT", approvedAt: null, approvedByAdminId: null, approvedByName: null },
      });
      break;
    case "approve":
      await prisma.policyVersion.update({
        where: { id: versionId },
        data: {
          status: "APPROVED",
          approvedAt: now,
          approvedByAdminId: admin.id,
          approvedByName: admin.name,
        },
      });
      break;
    case "publish":
      // One published version per policy: the previous one is archived in the same step.
      await prisma.$transaction([
        prisma.policyVersion.updateMany({
          where: { policyId: version.policyId, status: "PUBLISHED" },
          data: { status: "ARCHIVED", archivedAt: now },
        }),
        prisma.policyVersion.update({
          where: { id: versionId },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            publishedByAdminId: admin.id,
            publishedByName: admin.name,
          },
        }),
        prisma.policy.update({ where: { id: version.policyId }, data: { title: version.title } }),
      ]);
      break;
    case "unpublish":
      await prisma.policyVersion.update({ where: { id: versionId }, data: { status: "APPROVED" } });
      break;
    case "archive":
      await prisma.policyVersion.update({
        where: { id: versionId },
        data: { status: "ARCHIVED", archivedAt: now },
      });
      break;
    case "delete":
      await prisma.policyVersion.delete({ where: { id: versionId } });
      break;
  }

  await recordAudit(admin, {
    action: `policy.${action}`,
    entity: "PolicyVersion",
    entityId: versionId,
    summary: `${TRANSITION_MESSAGES[action].split(".")[0]}: version ${label}`,
    metadata: { policyId: version.policyId, version: version.version, from: version.status },
  });
  refreshPolicy(version.policyId, version.policy.slug);
  return actionOk(undefined, TRANSITION_MESSAGES[action]);
}
