import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getStudioProfile } from "@/lib/queries/public";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const studio = await getStudioProfile();

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-lg focus:bg-brand-800 focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <SiteHeader studioName={studio.name} parentOrg={studio.parentOrg} logoUrl={studio.logoUrl} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
