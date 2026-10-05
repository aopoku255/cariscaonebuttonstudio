import { PolicyPage, policyMetadata } from "@/components/public/policy-document";

export const revalidate = 300;

export const generateMetadata = () => policyMetadata("student-policy");

export default function Page() {
  return <PolicyPage slug="student-policy" />;
}
