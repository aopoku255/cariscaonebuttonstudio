"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { signIn } from "@/app/admin/login/actions";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signIn, undefined);

  useEffect(() => {
    if (state?.ok) {
      // Only ever follow a same-origin path, so `?next=` cannot redirect off-site.
      const target = next.startsWith("/") && !next.startsWith("//") ? next : "/admin/dashboard";
      router.replace(target);
      router.refresh();
    }
  }, [state, next, router]);

  return (
    <form action={action} className="space-y-5">
      <Field label="Email address" required>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@carisca.org"
          />
        )}
      </Field>

      <Field label="Password" required>
        {(props) => (
          <Input
            {...props}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••"
          />
        )}
      </Field>

      {state && !state.ok && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Button type="submit" loading={pending} fullWidth size="lg">
        Sign in
      </Button>
    </form>
  );
}
