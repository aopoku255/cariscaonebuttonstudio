"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { verifyStudentCustomer } from "@/app/admin/(dashboard)/customers/actions";

export function VerifyStudentButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function handleVerify() {
    startTransition(async () => {
      const result = await verifyStudentCustomer(customerId);
      if (result.ok) {
        toast.success("Verified", result.message);
        router.refresh();
      } else {
        toast.error("Could not verify", result.message);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleVerify} loading={pending}>
      Verify
    </Button>
  );
}
