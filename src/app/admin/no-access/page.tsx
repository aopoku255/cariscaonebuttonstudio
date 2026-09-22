import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth/guard";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const admin = await requireAdminPage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning-50 text-warning-700">
          <ShieldAlert className="size-6" aria-hidden />
        </span>

        <h1 className="font-display mt-6 text-[26px] leading-tight font-semibold tracking-tight text-ink">
          You do not have access to that
        </h1>

        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          Your account is signed in as{" "}
          <strong className="font-semibold text-ink">{ROLE_LABELS[admin.role]}</strong>.{" "}
          {ROLE_DESCRIPTIONS[admin.role]}
        </p>

        <p className="mt-3 text-[13.5px] text-muted">
          If you need access to this area, ask a Super Admin to change your role.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/admin/dashboard">Back to dashboard</ButtonLink>
        </div>
      </div>
    </div>
  );
}
