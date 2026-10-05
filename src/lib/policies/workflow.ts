import type { PolicyStatus } from "@/generated/prisma/enums";

/**
 * The review workflow for a policy version, as plain rules so they can be tested and
 * shared between the server actions (which enforce them) and the editor (which only
 * uses them to decide which buttons to show).
 *
 *   Draft -> Under review -> Approved -> Published -> Archived
 *
 * Drafting needs "policies:manage". Approving, publishing, unpublishing and archiving
 * need "policies:publish".
 */

export type PolicyAction =
  | "edit"
  | "submit"
  | "returnToDraft"
  | "approve"
  | "publish"
  | "unpublish"
  | "archive"
  | "delete";

export interface WorkflowContext {
  canManage: boolean;
  canPublish: boolean;
  /** Checkout depends on this policy, so its published version cannot be withdrawn. */
  requiredAtCheckout: boolean;
}

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function allowedPolicyActions(status: PolicyStatus, context: WorkflowContext): PolicyAction[] {
  const actions: PolicyAction[] = [];
  const { canManage, canPublish, requiredAtCheckout } = context;

  switch (status) {
    case "DRAFT":
      if (canManage) actions.push("edit", "submit", "delete");
      break;
    case "UNDER_REVIEW":
      if (canManage) actions.push("returnToDraft");
      if (canPublish) actions.push("approve");
      break;
    case "APPROVED":
      if (canManage) actions.push("returnToDraft");
      if (canPublish) actions.push("publish", "archive");
      break;
    case "PUBLISHED":
      if (canPublish && !requiredAtCheckout) actions.push("unpublish");
      break;
    case "ARCHIVED":
      break;
  }

  return actions;
}

export function canPerform(
  status: PolicyStatus,
  action: PolicyAction,
  context: WorkflowContext,
): boolean {
  return allowedPolicyActions(status, context).includes(action);
}

/** "1.0" -> "1.1", "2" -> "2.1", "1.4.2" -> "1.5". Anything unparseable starts at "1.0". */
export function nextVersionLabel(existing: string[]): string {
  let best: [number, number] | null = null;
  for (const label of existing) {
    const match = /^(\d+)(?:\.(\d+))?/.exec(label.trim());
    if (!match) continue;
    const pair: [number, number] = [Number(match[1]), Number(match[2] ?? 0)];
    if (!best || pair[0] > best[0] || (pair[0] === best[0] && pair[1] > best[1])) best = pair;
  }
  return best ? `${best[0]}.${best[1] + 1}` : "1.0";
}
