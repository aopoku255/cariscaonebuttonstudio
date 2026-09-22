import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /**
       * Server modules are marked with `import "server-only"`, which throws unless the
       * bundler resolves it under React's `react-server` condition — something Next.js
       * sets for Server Components but Vitest's SSR pipeline does not. Pointing it at a
       * stub lets the tests exercise the real server modules; the guard still does its
       * job in the actual Next.js build.
       */
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Integration tests share one database, so run files serially rather than racing
    // each other over the same booking slots.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
