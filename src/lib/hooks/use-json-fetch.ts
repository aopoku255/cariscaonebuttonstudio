"use client";

import { useEffect, useState } from "react";

/**
 * Fetch JSON, keyed by the request itself.
 *
 * The result is stored together with the key it belongs to, so `loading` is *derived*
 * ("the stored result is not for the request I am currently making") rather than being
 * a separate piece of state set at the top of the effect. That avoids the cascading
 * re-render that calling `setState` synchronously inside an effect causes, and it also
 * removes a real bug class: a slow response for an old key can never overwrite a newer
 * one, because the key is compared on read.
 *
 * Pass `url: null` to stand down: nothing is fetched and `data` stays null.
 */

interface Stored<T> {
  key: string;
  data: T | null;
  error: string | null;
}

export interface JsonFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useJsonFetch<T>(
  url: string | null,
  body?: unknown,
): JsonFetchResult<T> {
  // Serialising here keeps the effect's dependencies to plain strings, so the effect
  // does not re-run just because the caller rebuilt an object literal.
  const serialisedBody = body === undefined ? "" : JSON.stringify(body);
  const key = url === null ? "" : `${url}|${serialisedBody}`;

  const [stored, setStored] = useState<Stored<T> | null>(null);

  useEffect(() => {
    if (!url) return;

    const controller = new AbortController();

    const request: RequestInit = serialisedBody
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serialisedBody,
          signal: controller.signal,
        }
      : { signal: controller.signal };

    fetch(url, request)
      .then(async (response) => {
        const payload = (await response.json()) as T & { error?: string };
        if (!response.ok) {
          throw new Error(payload?.error ?? `Request failed (${response.status})`);
        }
        return payload as T;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setStored({ key, data, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setStored({
          key,
          data: null,
          error: cause instanceof Error ? cause.message : "Something went wrong",
        });
      });

    return () => controller.abort();
  }, [url, serialisedBody, key]);

  const matches = stored?.key === key;

  return {
    data: matches ? stored.data : null,
    loading: url !== null && !matches,
    error: matches ? stored.error : null,
  };
}
