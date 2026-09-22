import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money is handled in minor units (pesewas) everywhere. These helpers are the only
 * place that converts to and from the major unit shown to people.
 */
export function formatMoney(minor: number, currency = "GHS"): string {
  const major = minor / 100;
  const formatted = new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${currencySymbol(currency)}${formatted}`;
}

export function currencySymbol(currency = "GHS"): string {
  return currency === "GHS" ? "GH₵" : `${currency} `;
}

/** Parse a user-entered major-unit amount ("550", "550.50") into minor units. */
export function parseMoneyToMinor(input: string | number): number {
  const value = typeof input === "number" ? input : Number.parseFloat(input.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function minorToMajorString(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** "90" -> "1 hr 30 min" */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (mins) parts.push(`${mins} min`);
  return parts.join(" ");
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(input: string, length: number): string {
  return input.length <= length ? input : `${input.slice(0, length - 1)}…`;
}
