import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { StartDraftButton } from "@/components/admin/policy-editor";
import { PolicyStatusBadge } from "@/components/admin/policy-status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatPolicyDate } from "@/components/public/policy-document";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { policyPath } from "@/lib/policies/catalogue";

export const metadata: Metadata = {
  title: "Policy versions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STAMP = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminPolicyPage({ params }: PageProps<"/admin/policies/[id]">) {
  await requireAdminPage("policies:manage");
  const { id } = await params;

  const policy = await prisma.policy.findUnique({
    where: { id },
    include: { versions: { orderBy: { createdAt: "desc" } } },
  });
  if (!policy) notFound();

  const versionLabels = new Map(policy.versions.map((version) => [version.id, version.version]));
  const published = policy.versions.find((version) => version.status === "PUBLISHED");
  const inProgress = policy.versions.some((version) =>
    ["DRAFT", "UNDER_REVIEW", "APPROVED"].includes(version.status),
  );

  return (
    <>
      <PageHeader
        title={policy.title}
        description={
          policy.requiredAtCheckout
            ? "Customers accept this policy at checkout. It can be replaced by a newer published version, but not unpublished."
            : (policy.summary ?? undefined)
        }
        action={
          <>
            {published ? (
              <Link
                href={policyPath(policy.slug)}
                target="_blank"
                className="inline-flex h-9 items-center rounded-lg border border-line-strong px-3.5 text-[13px] font-semibold text-ink hover:bg-paper-deep"
              >
                View public page
              </Link>
            ) : null}
            {inProgress ? null : <StartDraftButton policyId={policy.id} />}
          </>
        }
      />

      <p className="mb-4 text-[13px]">
        <Link href="/admin/policies" className="font-semibold text-brand-700 underline underline-offset-4">
          All policies
        </Link>
      </p>

      <Card className="overflow-hidden">
        <CardHeader
          title="Policy Version History"
          description="Every version that has existed, newest first. Published and archived versions are kept exactly as they were."
        />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Effective date</Th>
                <Th>Published</Th>
                <Th>Previous version</Th>
                <Th>Reason for update</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {policy.versions.map((version) => (
                <Tr key={version.id}>
                  <Td>
                    <span className="font-semibold text-ink">{version.version}</span>
                    <p className="mt-0.5 text-[12px] text-muted">{version.title}</p>
                  </Td>
                  <Td>
                    <PolicyStatusBadge status={version.status} />
                  </Td>
                  <Td>{formatPolicyDate(version.effectiveDate) ?? "Not set"}</Td>
                  <Td>
                    {version.publishedAt ? (
                      <>
                        {STAMP.format(version.publishedAt)}
                        <p className="mt-0.5 text-[12px] text-muted">
                          by {version.publishedByName ?? "unknown"}
                        </p>
                      </>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td>
                    {version.previousVersionId
                      ? (versionLabels.get(version.previousVersionId) ?? "Removed")
                      : "-"}
                  </Td>
                  <Td className="max-w-[18rem] whitespace-normal">{version.changeReason ?? "-"}</Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/policies/${policy.id}/${version.id}`}
                      className="text-[13px] font-semibold text-brand-700 underline underline-offset-4"
                    >
                      {version.status === "DRAFT" ? "Edit" : "Open"}
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
