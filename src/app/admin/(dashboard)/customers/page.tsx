import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { MembershipStatus, PaymentStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import { formatShortDate } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { CUSTOMER_TYPE_LABELS } from "@/lib/customer-types";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminCustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  await requireAdminPage("customers:read");
  const params = await searchParams;

  const q = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);

  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { organisation: { contains: q } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
        bookings: {
          where: { paymentStatus: PaymentStatus.PAID },
          select: { totalMinor: true },
        },
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { id: true, packageNameSnapshot: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
  ]);

  // Last booking date per customer, fetched in one query rather than N.
  const lastBookings = customers.length
    ? await prisma.booking.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customers.map((c) => c.id) } },
        _max: { bookingDate: true },
      })
    : [];
  const lastByCustomer = new Map(
    lastBookings.map((row) => [row.customerId, row._max.bookingDate]),
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total} customer${total === 1 ? "" : "s"}${q ? " matching your search" : ""}.`}
      />

      <SearchBox
        basePath="/admin/customers"
        placeholder="Search name, email, phone or organisation"
        label="Search customers"
      />

      {customers.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<Users className="size-5" aria-hidden />}
          title={q ? "No customers match that search" : "No customers yet"}
          description={
            q
              ? "Try a different name, email or phone number."
              : "Customers are created automatically the first time someone books."
          }
          action={
            q ? (
              <ButtonLink href="/admin/customers" variant="outline">
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
                    <Th>Contact</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Bookings</Th>
                    <Th className="text-right">Total spent</Th>
                    <Th>Membership</Th>
                    <Th>Last booking</Th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const spent = customer.bookings.reduce((sum, b) => sum + b.totalMinor, 0);
                    const last = lastByCustomer.get(customer.id);
                    return (
                      <Tr key={customer.id}>
                        <Td>
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="font-semibold text-brand-700 underline underline-offset-4"
                          >
                            {customer.name}
                          </Link>
                          {customer.organisation ? (
                            <span className="block text-[12px] text-muted">
                              {customer.organisation}
                            </span>
                          ) : null}
                          {customer.isVerified ? (
                            <Badge tone="success" className="mt-1">
                              Verified
                            </Badge>
                          ) : null}
                        </Td>
                        <Td>
                          <span className="block text-[12.5px]">{customer.email}</span>
                          <span className="block text-[12px] text-muted">{customer.phone}</span>
                        </Td>
                        <Td>{CUSTOMER_TYPE_LABELS[customer.userType]}</Td>
                        <Td className="text-right">{customer._count.bookings}</Td>
                        <Td className="text-right font-medium text-ink">
                          {formatMoney(spent)}
                        </Td>
                        <Td>
                          {customer.memberships[0] ? (
                            <Badge tone="brand">
                              {customer.memberships[0].packageNameSnapshot ?? "Active"}
                            </Badge>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </Td>
                        <Td>{last ? formatShortDate(last) : <span className="text-muted">-</span>}</Td>
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
              const last = lastByCustomer.get(customer.id);
              return (
                <MobileRowCard
                  key={customer.id}
                  title={customer.name}
                  subtitle={customer.organisation ?? customer.email}
                  badges={
                    customer.memberships[0] ? <Badge tone="brand">Member</Badge> : undefined
                  }
                  rows={[
                    { label: "Type", value: CUSTOMER_TYPE_LABELS[customer.userType] },
                    { label: "Bookings", value: String(customer._count.bookings) },
                    { label: "Spent", value: formatMoney(spent) },
                    { label: "Last booking", value: last ? formatShortDate(last) : "-" },
                  ]}
                  action={
                    <ButtonLink
                      href={`/admin/customers/${customer.id}`}
                      size="sm"
                      variant="outline"
                      fullWidth
                    >
                      View customer
                    </ButtonLink>
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
                    href={`/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
                    size="sm"
                    variant="outline"
                  >
                    Previous
                  </ButtonLink>
                ) : null}
                {page < totalPages ? (
                  <ButtonLink
                    href={`/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
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
