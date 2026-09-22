"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Saving the receipt uses the browser's own print dialog ("Save as PDF"), which works
 * on every platform and avoids shipping a PDF renderer for a one-page document.
 */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      Download / print
    </Button>
  );
}
