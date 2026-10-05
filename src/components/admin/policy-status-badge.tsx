import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { PolicyStatus } from "@/generated/prisma/enums";
import { POLICY_STATUS_LABELS } from "@/lib/policies/workflow";

const TONES: Record<PolicyStatus, BadgeTone> = {
  DRAFT: "neutral",
  UNDER_REVIEW: "warning",
  APPROVED: "info",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export function PolicyStatusBadge({ status }: { status: PolicyStatus }) {
  return <Badge tone={TONES[status]}>{POLICY_STATUS_LABELS[status]}</Badge>;
}
