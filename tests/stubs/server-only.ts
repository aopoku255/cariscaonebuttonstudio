/**
 * Test stub for the `server-only` package.
 *
 * The real module throws unless the bundler resolves it under React's `react-server`
 * condition, which Next.js sets for Server Components but Vitest's SSR pipeline does
 * not. Aliasing it here lets the tests import the genuine server modules: the guard
 * exists to catch accidental client imports at build time, and the tests are neither.
 */
export {};
