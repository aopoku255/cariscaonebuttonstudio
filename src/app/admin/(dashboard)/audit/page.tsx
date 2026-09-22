import type { Metadata } from "next";
import { History } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAdminPage } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { initials } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdminPage("audit:read");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { adminUser: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every administrative action that changes bookings, money or configuration, with who did it and when."
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" aria-hidden />}
          title="Nothing recorded yet"
          description="Admin actions appear here as soon as someone changes something."
        />
      ) : (
        <>
          <ol className="space-y-px overflow-hidden rounded-xl border border-line bg-surface">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex gap-3 border-b border-line px-5 py-3.5 last:border-b-0"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-deep text-[11px] font-semibold text-ink-soft">
                  {entry.adminUser?.name ? initials(entry.adminUser.name) : "-"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-ink">{entry.summary}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                    <span>{entry.adminUser?.name ?? entry.actorEmail ?? "System"}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <code className="font-mono text-[11px]">{entry.action}</code>
                    {entry.ipAddress ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-mono text-[11px]">{entry.ipAddress}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {totalPages > 1 ? (
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination">
              <p className="text-[13px] text-muted">
                Page {page} of {totalPages} · {total} entries
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <ButtonLink href={`/admin/audit?page=${page - 1}`} size="sm" variant="outline">
                    Previous
                  </ButtonLink>
                ) : null}
                {page < totalPages ? (
                  <ButtonLink href={`/admin/audit?page=${page + 1}`} size="sm" variant="outline">
                    Next
                  </ButtonLink>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
