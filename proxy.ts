import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware` to `proxy`. This runs on the Node.js runtime.
 *
 * IMPORTANT: this is **not** a security boundary. It only improves the experience for
 * signed-out visitors by sending them to the login page instead of rendering a shell
 * they cannot use. Real authorisation happens in `requireAdminPage` / `requireAdmin`,
 * which every admin page, server action and route handler calls — a Server Action can
 * be POSTed directly without ever passing through a page render, so the check has to
 * live with the action itself.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdminArea =
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    !pathname.startsWith("/admin/login/");

  if (!isAdminArea) return NextResponse.next();

  // Presence of the cookie only — its validity is checked server-side on the page.
  const hasSession = request.cookies.has("carisca_admin_session");
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
