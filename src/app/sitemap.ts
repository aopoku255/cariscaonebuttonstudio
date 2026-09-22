import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";

/**
 * Sitemap. Only public, indexable pages are listed: booking pages, receipts, the
 * customer account and the whole admin area are deliberately excluded, and are also
 * marked `noindex` in their own metadata.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const lastModified = new Date();

  const routes: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/book", priority: 0.9, changeFrequency: "daily" },
    { path: "/packages", priority: 0.9, changeFrequency: "weekly" },
    { path: "/memberships", priority: 0.8, changeFrequency: "weekly" },
    { path: "/studio", priority: 0.8, changeFrequency: "monthly" },
    { path: "/corporate", priority: 0.7, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
