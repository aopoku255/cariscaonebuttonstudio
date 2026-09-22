import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-800 text-white hover:bg-brand-900 active:bg-brand-950 border border-transparent",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 border border-transparent",
  secondary:
    "bg-brand-50 text-brand-900 hover:bg-brand-100 active:bg-brand-200 border border-brand-100",
  outline:
    "bg-transparent text-ink hover:bg-paper-deep active:bg-line border border-line-strong",
  ghost: "bg-transparent text-ink-soft hover:bg-paper-deep hover:text-ink border border-transparent",
  danger:
    "bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700 border border-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[14.5px] gap-2 rounded-lg",
  lg: "h-13 px-7 text-[15.5px] gap-2.5 rounded-xl",
};

const BASE =
  "inline-flex items-center justify-center font-semibold transition-colors duration-150 " +
  "disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
  fullWidth?: boolean;
}

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: CommonProps = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type ButtonProps = CommonProps & Omit<ComponentProps<"button">, "className" | "children">;

export function Button({
  variant,
  size,
  className,
  children,
  loading,
  fullWidth,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children">;

export function ButtonLink({
  variant,
  size,
  className,
  children,
  fullWidth,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {children}
    </Link>
  );
}
