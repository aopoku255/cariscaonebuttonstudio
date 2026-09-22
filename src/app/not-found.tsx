import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <p className="font-display text-[64px] leading-none font-semibold text-accent-300">
        404
      </p>
      <h1 className="font-display mt-4 text-[28px] leading-tight font-semibold tracking-tight text-ink">
        We could not find that page
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        The link may be out of date, or the page may have moved. Everything else is still
        where you left it.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-800 px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-900"
        >
          Back to the studio
        </Link>
        <Link
          href="/book"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-[14.5px] font-semibold text-ink transition-colors hover:bg-paper-deep"
        >
          Book a session
        </Link>
      </div>
    </div>
  );
}
