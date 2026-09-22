"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Modal built on the native `<dialog>` element, which gives focus trapping, Escape to
 * close and inert background content without shipping a dialog library.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // `close` also fires for Escape and for the backdrop click handler below.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
  } as const;

  return (
    <dialog
      ref={ref}
      // Clicking the backdrop (the dialog element itself, outside the inner panel) closes.
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className={cn(
        "w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl shadow-ink/10",
        "backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:animate-fade-in",
        widths[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] leading-tight font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="-mr-1.5 -mt-0.5 rounded-lg p-1.5 text-muted transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="scrollbar-slim max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>

      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper/60 px-5 py-3.5">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
