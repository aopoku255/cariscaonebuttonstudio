import Image from "next/image";
import { Aperture, Landmark } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Logo placeholder, for One Button Studio and for CARISCA.
 *
 * Neither organisation's real logo file exists in this project yet, and
 * fabricating a logomark that merely resembles one would misrepresent both
 * brands the moment a real file replaces it inconsistently. So this renders an
 * honest, clearly-labelled placeholder: a dashed-border box with a generic
 * icon, never a stylised wordmark or monogram meant to pass as the real thing.
 *
 * Once a real logo URL is set (via studio.logoUrl / studio.cariscaLogoUrl in
 * Admin -> Settings), pass it as `src` and this renders the actual image
 * instead, at every call site, with no further changes needed.
 */

const SIZES = {
  sm: { box: "size-8", icon: "size-3.5", radius: "rounded-md" },
  md: { box: "size-10", icon: "size-4.5", radius: "rounded-lg" },
  lg: { box: "size-14", icon: "size-6", radius: "rounded-xl" },
} as const;

export function BrandLogo({
  variant,
  src,
  size = "md",
  tone = "light",
  className,
}: {
  variant: "studio" | "carisca";
  src?: string | null;
  size?: keyof typeof SIZES;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dims = SIZES[size];
  const label = variant === "studio" ? "One Button Studio logo" : "CARISCA logo";

  if (src) {
    return (
      <span className={cn("relative shrink-0 overflow-hidden", dims.box, dims.radius, className)}>
        <Image src={src} alt={label} fill sizes="56px" className="object-contain" />
      </span>
    );
  }

  const Icon = variant === "studio" ? Aperture : Landmark;

  return (
    <span
      role="img"
      aria-label={`${label} placeholder`}
      title={`${label} placeholder`}
      className={cn(
        "flex shrink-0 items-center justify-center border border-dashed",
        dims.box,
        dims.radius,
        tone === "dark"
          ? "border-brand-600 bg-brand-800/60 text-brand-300"
          : "border-brand-200 bg-brand-50 text-brand-600",
        className,
      )}
    >
      <Icon className={dims.icon} aria-hidden strokeWidth={1.75} />
    </span>
  );
}
