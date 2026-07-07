import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: that config wires up the React/
// Tailwind frontend build, which the server-side unit tests here have no
// need for and shouldn't have to resolve just to run `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/server/**/*.test.ts"],
  },
});
