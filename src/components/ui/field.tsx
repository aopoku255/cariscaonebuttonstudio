"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Form primitives.
 *
 * `Field` owns the label/description/error wiring (including `aria-describedby` and
 * `aria-invalid`) so every form in the app reports errors to assistive technology the
 * same way without each screen remembering to do it.
 */

const CONTROL_BASE =
  "w-full rounded-lg border bg-surface px-3.5 text-[14.5px] text-ink placeholder:text-muted/70 " +
  "transition-colors duration-150 disabled:bg-paper-deep disabled:text-muted";

const CONTROL_STATE =
  "border-line-strong hover:border-muted/50 focus:border-brand-600 focus:outline-none " +
  "focus:ring-2 focus:ring-brand-600/15";

const CONTROL_ERROR =
  "border-danger-500 hover:border-danger-500 focus:border-danger-500 focus:ring-danger-500/15";

export function controlClasses(invalid?: boolean, className?: string) {
  return cn(CONTROL_BASE, invalid ? CONTROL_ERROR : CONTROL_STATE, className);
}

interface FieldProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  /** Receives the generated ids so the control can wire itself up. */
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
}

export function Field({
  label,
  description,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="block text-[13px] font-semibold text-ink-soft">
          {label}
          {required ? <span className="ml-1 text-danger-500">*</span> : null}
        </label>
      ) : null}

      {description ? (
        <p id={descriptionId} className="text-[12.5px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {error ? (
        <p id={errorId} className="text-[12.5px] font-medium text-danger-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input className={cn(controlClasses(invalid, "h-11"), className)} {...props} />;
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(controlClasses(invalid, "py-2.5 min-h-24 leading-relaxed"), className)}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        controlClasses(invalid, "h-11 pr-9 appearance-none cursor-pointer"),
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236e6a5e%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  className,
  label,
  description,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex gap-2.5", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong text-brand-800 accent-brand-800"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Fieldset({
  legend,
  description,
  children,
  className,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-4", className)}>
      <legend className="text-[15px] font-semibold text-ink">{legend}</legend>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}
