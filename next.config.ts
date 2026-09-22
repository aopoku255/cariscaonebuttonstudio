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
