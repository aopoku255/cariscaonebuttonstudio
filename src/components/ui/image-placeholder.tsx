import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A reusable, intentional image placeholder.
 *
 * Real studio photography does not exist yet, so every image slot in the app
 * (hero, service cards, gallery, packages, equipment) renders through this one
 * component. It is deliberately styled to look like a considered placeholder
 * rather than a broken image or a stand-in stock photo: a labelled block in the
 * brand's own blue-gray tones with a subtle diagonal pattern.
 *
 * Pass `src` once a real photograph is available (via admin-managed `imageUrl`
 * fields) and the same component swaps to a real, optimised `next/image` render
 * with no change needed at the call site.
 */

const ASPECT_CLASSES = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  wide: "aspect-[21/9]",
  hero: "aspect-4/3 lg:aspect-square",
} as const;

export type PlaceholderAspect = keyof typeof ASPECT_CLASSES;

export function ImagePlaceholder({
  label,
  aspect = "video",
  src,
  alt,
  icon,
  tone = "light",
  className,
  priority,
  sizes,
}: {
  /** Shown inside the block, e.g. "Studio Hero Image". */
  label: string;
  aspect?: PlaceholderAspect;
  /** Once set, renders the real photograph instead of the placeholder. */
  src?: string | null;
  alt?: string;
  icon?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden", ASPECT_CLASSES[aspect], className)}>
        <Image
          src={src}
          alt={alt ?? label}
          fill
          priority={priority}
          sizes={sizes ?? "100vw"}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${label} placeholder`}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border",
        tone === "dark"
          ? "border-brand-700 bg-brand-900 text-brand-200"
          : "border-line-strong bg-brand-50 text-brand-700",
        ASPECT_CLASSES[aspect],
        className,
      )}
    >
      {/* Subtle diagonal hatch, tone-on-tone, so the block reads as a deliberate
          placeholder rather than a rendering error. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0, currentColor 1.5px, transparent 1.5px, transparent 14px)",
        }}
      />
      <span
        className={cn(
          "relative flex size-10 items-center justify-center rounded-full border",
          tone === "dark" ? "border-brand-600 bg-brand-800" : "border-brand-200 bg-surface",
        )}
      >
        {icon ?? <ImageIcon className="size-4.5" aria-hidden />}
      </span>
      <span className="relative mt-3 px-4 text-center text-[12px] font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span
        className={cn(
          "relative mt-1 text-[10.5px] tracking-wide uppercase",
          tone === "dark" ? "text-brand-400" : "text-brand-400",
        )}
      >
        Image placeholder
      </span>
    </div>
  );
}
