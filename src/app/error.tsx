"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Root error boundary. The message is deliberately generic: an unexpected server error
 * can carry details a visitor should not see, so the specifics go to the server log and
 * the digest is shown only as a reference to quote to the studio.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight text-ink">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        We hit an unexpected problem. Nothing you were doing has been lost: try again, and
        if it keeps happening, let the studio know.
      </p>

      {error.digest ? (
        <p className="mt-4 font-mono text-[12px] text-muted">Reference: {error.digest}</p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-800 px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-900"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-[14.5px] font-semibold text-ink transition-colors hover:bg-paper-deep"
        >
          Back to the studio
        </Link>
      </div>
    </div>
  );
}
