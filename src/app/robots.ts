import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing here should ever appear in search results: the admin area, a
        // customer's own booking pages and receipts, and the API surface.
        disallow: ["/admin", "/admin/", "/api/", "/booking/", "/account"],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}
