import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/guard";

/**
 * Every admin screen sits inside this layout, which resolves the session before
 * rendering. Each page additionally asserts the specific permission it needs: the
 * layout guarantees "signed in", not "allowed to see this".
 */
export default async function AdminDashboardLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdminPage();

  return (
    <AdminShell admin={{ name: admin.name, email: admin.email, role: admin.role }}>
      {children}
    </AdminShell>
  );
}
