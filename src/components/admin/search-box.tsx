"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/** A URL-backed search box, so a filtered list stays shareable and reloadable. */
export function SearchBox({
  basePath,
  placeholder,
  label,
}: {
  basePath: string;
  placeholder: string;
  label: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    next.delete("page");
    router.push(`${basePath}?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="pl-9"
        />
      </div>
      <Button type="submit">Search</Button>
      {params.get("q") ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setValue("");
            router.push(basePath);
          }}
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden />
        </Button>
      ) : null}
    </form>
  );
}
