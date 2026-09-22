import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdminPage } from "@/lib/auth/guard";
import { isEmailConfigured, isPaystackConfigured } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage("settings:manage");
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Studio details, booking rules, pricing policy and notifications. These take effect immediately across the website and the booking engine."
      />
      <SettingsForm
        settings={settings}
        paystackConfigured={isPaystackConfigured()}
        emailConfigured={isEmailConfigured()}
      />
    </>
  );
}
