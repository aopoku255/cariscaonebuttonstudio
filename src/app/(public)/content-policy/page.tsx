import { PolicyPage, policyMetadata } from "@/components/public/policy-document";

export const revalidate = 300;

export const generateMetadata = () => policyMetadata("content-policy");

export default function Page() {
  return <PolicyPage slug="content-policy" />;
}
