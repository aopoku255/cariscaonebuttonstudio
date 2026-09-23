import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's query engine and the MariaDB driver are native Node modules; keep them
  // out of the bundler so the server runtime loads them directly.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb", "nodemailer"],

  images: {
    // Package, equipment and studio imagery is configured by admins as URLs, so allow
    // remote sources over HTTPS while still going through Next's optimiser.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    qualities: [70, 80, 90],
    // The studio/CARISCA logos are SVGs. Logo URLs are admin-configurable, so this is
    // locked down per Next's guidance: no script execution and a sandboxed response,
    // which neutralises SVG-based XSS even if a logo URL ever pointed somewhere untrusted.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Never let an intermediary cache an authenticated dashboard response.
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
