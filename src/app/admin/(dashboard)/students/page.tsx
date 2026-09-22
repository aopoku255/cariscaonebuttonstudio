import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { VerifyStudentButton } from "@/components/admin/verify-student-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { CustomerType, MembershipStatus, PaymentStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import { formatShortDate } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { formatHours, formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Student customers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminStudentCustomersPage({
  searchParams,
}: PageProps<"/admin/students">) {
  await requireAdminPage("customers:read");
  const params = await searchParams;

  const q = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);

  const where: Prisma.CustomerWhereInput = {
    userType: CustomerType.KNUST_STUDENT,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { knustEmail: { contains: q } },
            { studentIdRef: { contains: q } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
        bookings: {
          where: { paymentStatus: PaymentStatus.PAID },
          select: { totalMinor: true, durationMinutes: true },
        },
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: {
            id: true,
            packageNameSnapshot: true,
            totalMinutes: true,
            usedMinutes: true,
            expiryDate: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Student customers"
        description={`${total} verified or pending KNUST student${total === 1 ? "" : "s"}${q ? " matching your search" : ""}. Manage Student Studio eligibility here; pricing itself lives under Packages.`}
      />

      <SearchBox
        basePath="/admin/students"
        placeholder="Search name, email or student ID"
        label="Search student customers"
      />

      {customers.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<GraduationCap className="size-5" aria-hidden />}
          title={q ? "No student customers match that search" : "No KNUST students yet"}
          description={
            q
              ? "Try a different name, email or student ID."
              : "Customers appear here automatically once they book as a KNUST Student."
          }
          action={
            q ? (
              <ButtonLink href="/admin/students" variant="outline">
                Clear search
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mt-4 hidden rounded-xl border border-line bg-surface lg:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>KNUST email</Th>
                    <Th>Student ID</Th>
                    <Th>Verification</Th>
                    <Th className="text-right">Bookings</Th>
                    <Th className="text-right">Hours used</Th>
                    <Th>Membership</Th>
                    <Th className="text-right">Total spent</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const spent = customer.bookings.reduce((sum, b) => sum + b.totalMinor, 0);
                    const hoursUsed = customer.bookings.reduce(
                      (sum, b) => sum + b.durationMinutes,
                      0,
                    );
                    const membership = customer.memberships[0];
                    const remainingMembershipMinutes = membership
                      ? Math.max(0, membership.totalMinutes - membership.usedMinutes)
                      : null;

                    return (
                      <Tr key={customer.id}>
                        <Td>
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="font-semibold text-brand-700 underline underline-offset-4"
                          >
                            {customer.name}
                          </Link>
                          <span className="block text-[12px] text-muted">{customer.email}</span>
                        </Td>
                        <Td>
                          {customer.knustEmail ?? <span className="text-muted">-</span>}
                        </Td>
                        <Td>
                          {customer.studentIdRef ?? <span className="text-muted">-</span>}
                        </Td>
                        <Td>
                          {customer.isVerified ? (
                            <Badge tone="success">Verified</Badge>
                          ) : customer.studentIdRef ? (
                            <Badge tone="warning">Pending review</Badge>
                          ) : (
                            <Badge tone="neutral">Unverified</Badge>
                          )}
                        </Td>
                        <Td className="text-right">{customer._count.bookings}</Td>
                        <Td className="text-right">{formatHours(hoursUsed)}</Td>
                        <Td>
                          {membership ? (
                            <div>
                              <Badge tone="brand">
                                {membership.packageNameSnapshot ?? "Active"}
                              </Badge>
                              <span className="mt-1 block text-[12px] text-muted">
                                {remainingMembershipMinutes !== null
                                  ? `${formatHours(remainingMembershipMinutes)} left`
                                  : null}{" "}
                                · expires {formatShortDate(membership.expiryDate)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </Td>
                        <Td className="text-right font-medium text-ink">
                          {formatMoney(spent)}
                        </Td>
                        <Td>
                          <div className="flex justify-end gap-2">
                            {!customer.isVerified ? (
                              <VerifyStudentButton customerId={customer.id} />
                            ) : null}
                            <ButtonLink
                              href={`/admin/customers/${customer.id}`}
                              size="sm"
                              variant="ghost"
                            >
                              View
                            </ButtonLink>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          <div className="mt-4 space-y-3 lg:hidden">
            {customers.map((customer) => {
              const spent = customer.bookings.reduce((sum, b) => sum + b.totalMinor, 0);
              const hoursUsed = customer.bookings.reduce((sum, b) => sum + b.durationMinutes, 0);
              const membership = customer.memberships[0];

              return (
                <MobileRowCard
                  key={customer.id}
                  title={customer.name}
                  subtitle={customer.knustEmail ?? customer.email}
                  badges={
                    customer.isVerified ? (
                      <Badge tone="success">Verified</Badge>
                    ) : customer.studentIdRef ? (
                      <Badge tone="warning">Pending review</Badge>
                    ) : (
                      <Badge tone="neutral">Unverified</Badge>
                    )
                  }
                  rows={[
                    { label: "Bookings", value: String(customer._count.bookings) },
                    { label: "Hours used", value: formatHours(hoursUsed) },
                    { label: "Membership", value: membership?.packageNameSnapshot ?? "-" },
                    { label: "Spent", value: formatMoney(spent) },
                  ]}
                  action={
                    <div className="flex gap-2">
                      {!customer.isVerified ? (
                        <VerifyStudentButton customerId={customer.id} />
                      ) : null}
                      <ButtonLink
                        href={`/admin/customers/${customer.id}`}
                        size="sm"
                        variant="outline"
                        fullWidth
                      >
                        View
                      </ButtonLink>
                    </div>
                  }
                />
              );
            })}
          </div>

          {totalPages > 1 ? (
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination">
              <p className="text-[13px] text-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <ButtonLink
                    href={`/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
                    size="sm"
                    variant="outline"
                  >
                    Previous
                  </ButtonLink>
                ) : null}
                {page < totalPages ? (
                  <ButtonLink
                    href={`/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
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
