"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOutCustomer } from "@/app/(public)/account/actions";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutCustomer();
          router.refresh();
        })
      }
    >
      <LogOut className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
