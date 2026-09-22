import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/** Empty states, inline alerts and loading skeletons. */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-paper/50 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-paper-deep text-muted">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_STYLES: Record<AlertTone, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: "bg-info-50 border-info-100 text-info-700",
    icon: <Info className="size-4 shrink-0" aria-hidden />,
  },
  success: {
    wrap: "bg-success-50 border-success-100 text-success-700",
    icon: <CheckCircle2 className="size-4 shrink-0" aria-hidden />,
  },
  warning: {
    wrap: "bg-warning-50 border-warning-100 text-warning-700",
    icon: <TriangleAlert className="size-4 shrink-0" aria-hidden />,
  },
  danger: {
    wrap: "bg-danger-50 border-danger-100 text-danger-700",
    icon: <AlertCircle className="size-4 shrink-0" aria-hidden />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = ALERT_STYLES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px] leading-relaxed",
        style.wrap,
        className,
      )}
    >
      <span className="mt-0.5">{style.icon}</span>
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5", className)}>
      <Skeleton className="h-4 w-1/3" />
      <SkeletonText className="mt-4" lines={3} />
      <Skeleton className="mt-5 h-9 w-28 rounded-lg" />
    </div>
  );
}

/** A small "loading" line used inside panels that refresh in place. */
export function LoadingLine({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
      <span className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-brand-600" />
      {label}
    </p>
  );
}
