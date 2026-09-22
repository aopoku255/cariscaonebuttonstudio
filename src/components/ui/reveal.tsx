"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Reveals its children once they scroll into view.
 *
 * Uses one IntersectionObserver per element and disconnects after the first reveal, so
 * nothing keeps observing after the animation has played. The CSS in globals.css
 * removes the effect entirely under `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger in milliseconds, for lists of cards. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If the browser cannot observe, show the content rather than hiding it forever.
    if (typeof IntersectionObserver === "undefined") {
      element.dataset.reveal = "shown";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            element.dataset.reveal = "shown";
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
