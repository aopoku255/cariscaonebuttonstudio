import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { TeamManager } from "@/components/admin/team-manager";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AdminRole } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Admin users",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const admin = await requireAdminPage("admins:manage");

  const users = await prisma.adminUser.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Admin users"
        description="Who can sign in, and what each of them can do. Permissions are enforced on the server for every action, not just hidden in the menu."
      />

      <TeamManager
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
          isSelf: user.id === admin.id,
        }))}
      />

      <Card className="mt-6">
        <CardHeader
          title="What each role can do"
          description="Assign the narrowest role that lets someone do their job."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {Object.values(AdminRole).map((role) => (
            <div key={role} className="rounded-lg border border-line p-4">
              <h3 className="text-[14px] font-semibold text-ink">{ROLE_LABELS[role]}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {ROLE_DESCRIPTIONS[role]}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {ROLE_PERMISSIONS[role].map((permission) => (
                  <li
                    key={permission}
                    className="rounded-full bg-paper-deep px-2 py-0.5 font-mono text-[10.5px] text-ink-soft"
                  >
                    {permission}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
