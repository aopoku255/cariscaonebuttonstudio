import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { PolicyEditor } from "@/components/admin/policy-editor";
import { PolicyStatusBadge } from "@/components/admin/policy-status-badge";
import { requireAdminPage } from "@/lib/auth/guard";
import { roleHas } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getPolicySettings } from "@/lib/policies/queries";

export const metadata: Metadata = {
  title: "Policy version",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function dateKey(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function AdminPolicyVersionPage({
  params,
}: PageProps<"/admin/policies/[id]/[versionId]">) {
  const admin = await requireAdminPage("policies:manage");
  const { id, versionId } = await params;

  const [version, settings] = await Promise.all([
    prisma.policyVersion.findFirst({
      where: { id: versionId, policyId: id },
      include: { policy: true },
    }),
    getPolicySettings(),
  ]);
  if (!version) notFound();

  return (
    <>
      <PageHeader
        title={`${version.policy.title}: version ${version.version}`}
        description={
          version.createdByName ? `Drafted by ${version.createdByName}.` : undefined
        }
        action={<PolicyStatusBadge status={version.status} />}
      />

      <p className="mb-4 text-[13px]">
        <Link
          href={`/admin/policies/${version.policyId}`}
          className="font-semibold text-brand-700 underline underline-offset-4"
        >
          Version history
        </Link>
      </p>

      <PolicyEditor
        key={`${version.id}-${version.status}-${version.updatedAt.getTime()}`}
        policyId={version.policyId}
        version={{
          id: version.id,
          version: version.version,
          title: version.title,
          content: version.content,
          status: version.status,
          effectiveDate: dateKey(version.effectiveDate),
          lastUpdatedDate: dateKey(version.lastUpdatedDate),
          changeReason: version.changeReason ?? "",
        }}
        canManage={roleHas(admin.role, "policies:manage")}
        canPublish={roleHas(admin.role, "policies:publish")}
        requiredAtCheckout={version.policy.requiredAtCheckout}
        settings={settings}
      />
    </>
  );
}
