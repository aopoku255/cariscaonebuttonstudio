import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  // Already signed in? Skip the form.
  if (await getAdminSession()) redirect("/admin/dashboard");

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/admin/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-brand-950">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandLogo variant="studio" size="lg" tone="dark" />
              <span className="text-left leading-tight">
                <span className="block text-[14px] font-bold tracking-tight text-white">
                  One Button Studio
                </span>
                <span className="block text-[11px] font-medium tracking-[0.14em] text-brand-300 uppercase">
                  By CARISCA
                </span>
              </span>
            </Link>
          </div>

          <div className="rounded-2xl border border-brand-800 bg-surface p-7">
            <h1 className="font-display text-[24px] leading-tight font-semibold tracking-tight text-ink">
              Staff sign in
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Sign in to manage bookings, packages, availability and payments.
            </p>

            <div className="mt-6">
              <LoginForm next={next} />
            </div>
          </div>

          <p className="mt-6 text-center text-[12.5px] text-brand-300">
            Not a staff member?{" "}
            <Link href="/" className="font-semibold text-accent-300 underline underline-offset-4">
              Go to the studio website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
