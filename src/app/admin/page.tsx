import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** `/admin` is just an entry point: straight to the dashboard, or to sign in. */
export default async function AdminIndexPage() {
  const admin = await getAdminSession();
  redirect(admin ? "/admin/dashboard" : "/admin/login");
}
