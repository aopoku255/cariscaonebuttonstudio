"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { claimAccount, signInCustomer } from "@/app/(public)/account/actions";
import { cn } from "@/lib/utils";

export function AccountAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result =
      mode === "signin"
        ? await signInCustomer({ email, password })
        : await claimAccount({ email, password });

    setLoading(false);

    if (result.ok) {
      router.refresh();
    } else {
      setError(result.message ?? "Something went wrong.");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div
        role="tablist"
        aria-label="Account"
        className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-paper-deep p-1"
      >
        {(["signin", "create"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={cn(
              "rounded-md px-3 py-2 text-[13.5px] font-semibold transition-colors",
              mode === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {value === "signin" ? "Sign in" : "Set up an account"}
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <p className="mb-5 text-[13px] leading-relaxed text-muted">
          Use the same email address you booked with, and choose a password. Your existing
          bookings will be waiting for you.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email address" required>
          {(props) => (
            <Input
              {...props}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Field
          label="Password"
          required
          description={
            mode === "create"
              ? "At least 10 characters, with upper and lower case letters and a number."
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              required
            />
          )}
        </Field>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Button type="submit" loading={loading} fullWidth size="lg">
          {mode === "signin" ? "Sign in" : "Create my account"}
        </Button>
      </form>
    </div>
  );
}
