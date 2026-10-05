"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "obs-cookie-consent";

export type CookieChoice = "accepted" | "declined";

/** The visitor's stored choice, for any script that sets non-essential cookies. */
export function readCookieChoice(): CookieChoice | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Consent banner for non-essential cookies. It is only rendered when the
 * "cookies.nonEssentialEnabled" setting is on: the site sets no such cookies by
 * default, and anything added later must check `readCookieChoice()` before running.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setVisible(readCookieChoice() === null));
  }, []);

  if (!visible) return null;

  function choose(choice: CookieChoice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Without storage the choice only lasts for this page view.
    }
    window.dispatchEvent(new CustomEvent("obs-cookie-consent", { detail: choice }));
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="print:hidden fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-ink/10"
    >
      <p className="text-[14px] leading-relaxed text-ink-soft">
        We use cookies that are needed for the site to work. With your permission we would also
        use optional cookies to understand how the site is used. See the{" "}
        <Link href="/privacy-policy#cookies" className="font-medium text-brand-700 underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button size="sm" variant="outline" onClick={() => choose("declined")}>
          Essential only
        </Button>
        <Button size="sm" onClick={() => choose("accepted")}>
          Allow optional cookies
        </Button>
      </div>
    </div>
  );
}
