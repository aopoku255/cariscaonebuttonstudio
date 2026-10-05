import { PolicyPage, policyMetadata } from "@/components/public/policy-document";

export const revalidate = 300;

export const generateMetadata = () => policyMetadata("privacy-policy");

export default function Page() {
  return <PolicyPage slug="privacy-policy" />;
}
