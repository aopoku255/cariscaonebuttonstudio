import { PolicyPage, policyMetadata } from "@/components/public/policy-document";

export const revalidate = 300;

export const generateMetadata = () => policyMetadata("terms-and-conditions");

export default function Page() {
  return <PolicyPage slug="terms-and-conditions" />;
}
