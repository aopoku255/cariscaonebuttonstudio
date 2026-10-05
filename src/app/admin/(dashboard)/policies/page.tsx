import type { Metadata } from "next";
import Link from "next/link";

import { NewPolicyButton } from "@/components/admin/policy-editor";
import { PageHeader } from "@/components/admin/page-header";
import { PolicyStatusBadge } from "@/components/admin/policy-status-badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatPolicyDate } from "@/components/public/policy-document";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { policyPath } from "@/lib/policies/catalogue";
import { parsePolicy } from "@/lib/policies/markdown";
import { getPolicySettings } from "@/lib/policies/queries";
import { createTokenResolver } from "@/lib/policies/tokens";

export const metadata: Metadata = {
  title: "Policies",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPoliciesPage() {
  await requireAdminPage("policies:manage");

  const [policies, settings] = await Promise.all([
    prisma.policy.findMany({
      orderBy: { sortOrder: "asc" },
      include: { versions: { orderBy: { createdAt: "desc" } } },
    }),
    getPolicySettings(),
  ]);
  const resolver = createTokenResolver(settings);

  const rows = policies.map((policy) => {
    const published = policy.versions.find((version) => version.status === "PUBLISHED") ?? null;
    const working =
      policy.versions.find((version) =>
        ["DRAFT", "UNDER_REVIEW", "APPROVED"].includes(version.status),
      ) ?? null;
    const placeholders = published ? parsePolicy(published.content, resolver).placeholders.length : 0;
    return { policy, published, working, placeholders };
  });

  const totalPlaceholders = rows.reduce((sum, row) => sum + row.placeholders, 0);
  const undated = rows.filter((row) => row.published && !row.published.effectiveDate).length;

  return (
    <>
      <PageHeader
        title="Policies"
        description="The policy documents shown on the website. Each change is drafted as a new version, reviewed, approved and then published; earlier versions are kept."
        action={<NewPolicyButton />}
      />

      {totalPlaceholders > 0 || undated > 0 ? (
        <Alert tone="warning" className="mb-5" title="Details still to be confirmed">
          {totalPlaceholders > 0 ? (
            <>
              The published policies still show {totalPlaceholders} placeholder
              {totalPlaceholders === 1 ? "" : "s"} where the studio has not confirmed a detail.
              Fill them in under{" "}
              <Link href="/admin/settings" className="font-semibold underline underline-offset-4">
                Settings
              </Link>
              .{" "}
            </>
          ) : null}
          {undated > 0
            ? `${undated} published ${undated === 1 ? "policy has" : "policies have"} no effective date yet.`
            : null}
        </Alert>
      ) : null}

      <Card className="hidden overflow-hidden md:block">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Policy</Th>
                <Th>Published version</Th>
                <Th>Effective date</Th>
                <Th>In progress</Th>
                <Th>Placeholders</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ policy, published, working, placeholders }) => (
                <Tr key={policy.id}>
                  <Td>
                    <Link
                      href={`/admin/policies/${policy.id}`}
                      className="font-semibold text-ink hover:text-brand-700"
                    >
                      {policy.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[12px] text-muted">{policyPath(policy.slug)}</p>
                  </Td>
                  <Td>
                    {published ? (
                      <span className="flex items-center gap-2">
                        {published.version} <PolicyStatusBadge status="PUBLISHED" />
                      </span>
                    ) : (
                      <span className="text-muted">Not published</span>
                    )}
                  </Td>
                  <Td>
                    {published ? (formatPolicyDate(published.effectiveDate) ?? "Not set") : "-"}
                  </Td>
                  <Td>
                    {working ? (
                      <span className="flex items-center gap-2">
                        {working.version} <PolicyStatusBadge status={working.status} />
                      </span>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </Td>
                  <Td>{placeholders}</Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/policies/${policy.id}`}
                      className="text-[13px] font-semibold text-brand-700 underline underline-offset-4"
                    >
                      Manage
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <div className="space-y-3 md:hidden">
        {rows.map(({ policy, published, working, placeholders }) => (
          <MobileRowCard
            key={policy.id}
            title={policy.title}
            subtitle={policyPath(policy.slug)}
            badges={
              <>
                {published ? <PolicyStatusBadge status="PUBLISHED" /> : null}
                {working ? <PolicyStatusBadge status={working.status} /> : null}
              </>
            }
            rows={[
              { label: "Published", value: published ? published.version : "Not published" },
              {
                label: "Effective",
                value: published ? (formatPolicyDate(published.effectiveDate) ?? "Not set") : "-",
              },
              { label: "Placeholders", value: String(placeholders) },
            ]}
            action={
              <Link
                href={`/admin/policies/${policy.id}`}
                className="text-[13px] font-semibold text-brand-700 underline underline-offset-4"
              >
                Manage
              </Link>
            }
          />
        ))}
      </div>
    </>
  );
}
