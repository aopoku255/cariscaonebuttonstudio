"use client";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal toast system. Messages are announced through an `aria-live` region so
 * screen-reader users hear the same success and error feedback sighted users see.
 */

type ToastTone = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { wrap: string; icon: ReactNode }> = {
  success: {
    wrap: "border-success-100 bg-success-50 text-success-700",
    icon: <CheckCircle2 className="size-4 shrink-0" aria-hidden />,
  },
  error: {
    wrap: "border-danger-100 bg-danger-50 text-danger-700",
    icon: <AlertCircle className="size-4 shrink-0" aria-hidden />,
  },
  warning: {
    wrap: "border-warning-100 bg-warning-50 text-warning-700",
    icon: <TriangleAlert className="size-4 shrink-0" aria-hidden />,
  },
  info: {
    wrap: "border-info-100 bg-info-50 text-info-700",
    icon: <Info className="size-4 shrink-0" aria-hidden />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), input.tone === "error" ? 8000 : 5000),
      );
    },
    [dismiss],
  );

  // Clear any pending timers if the provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: "success", title, description }),
      error: (title, description) => toast({ tone: "error", title, description }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((item) => {
          const style = TONE_STYLES[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                "animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg shadow-ink/5",
                style.wrap,
              )}
            >
              <span className="mt-0.5">{style.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed opacity-90">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-mr-1 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a <ToastProvider>");
  }
  return context;
}
