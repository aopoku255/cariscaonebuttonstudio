import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { NotificationStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/env";
import { titleCase } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

export default async function AdminNotificationsPage({
  searchParams,
}: PageProps<"/admin/notifications">) {
  await requireAdminPage("settings:manage");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);

  const [notifications, total, counts] = await Promise.all([
    prisma.notification.findMany({
      include: { booking: { select: { id: true, reference: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count(),
    prisma.notification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (status: NotificationStatus) =>
    counts.find((row) => row.status === status)?._count._all ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Every message the system has tried to send, and whether it actually went out."
      />

      {!isEmailConfigured() ? (
        <Alert tone="warning" className="mb-4" title="Email sending is switched off">
          No <code className="font-mono text-[12px]">EMAIL_SERVER</code> is configured, so
          messages below are recorded and logged but not delivered. Nothing is silently
          reported as sent.
        </Alert>
      ) : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Sent" value={String(countFor(NotificationStatus.SENT))} />
        <StatCard
          label="Queued"
          value={String(countFor(NotificationStatus.QUEUED))}
          tone={countFor(NotificationStatus.QUEUED) > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Failed"
          value={String(countFor(NotificationStatus.FAILED))}
          tone={countFor(NotificationStatus.FAILED) > 0 ? "warning" : "default"}
        />
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" aria-hidden />}
          title="No notifications yet"
          description="Booking confirmations, reminders and enquiry alerts appear here."
        />
      ) : (
        <>
          <ol className="overflow-hidden rounded-xl border border-line bg-surface">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="border-b border-line px-5 py-3.5 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">
                      {notification.subject}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                      <span>To {notification.recipient}</span>
                      <span aria-hidden>·</span>
                      <span>{titleCase(notification.type)}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {formatDateTime(notification.sentAt ?? notification.createdAt)}
                      </span>
                      {notification.booking ? (
                        <>
                          <span aria-hidden>·</span>
                          <Link
                            href={`/admin/bookings/${notification.booking.id}`}
                            className="font-mono text-[11px] text-brand-700 underline underline-offset-4"
                          >
                            {notification.booking.reference}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {notification.error ? (
                      <p className="mt-1.5 text-[12px] text-warning-700">
                        {notification.error}
                      </p>
                    ) : null}
                  </div>

                  <Badge
                    tone={
                      notification.status === NotificationStatus.SENT
                        ? "success"
                        : notification.status === NotificationStatus.FAILED
                          ? "danger"
                          : "warning"
                    }
                  >
                    {titleCase(notification.status)}
                  </Badge>
                </div>
              </li>
            ))}
          </ol>

          {totalPages > 1 ? (
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination">
              <p className="text-[13px] text-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <ButtonLink
                    href={`/admin/notifications?page=${page - 1}`}
                    size="sm"
                    variant="outline"
                  >
                    Previous
                  </ButtonLink>
                ) : null}
                {page < totalPages ? (
                  <ButtonLink
                    href={`/admin/notifications?page=${page + 1}`}
                    size="sm"
                    variant="outline"
                  >
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
