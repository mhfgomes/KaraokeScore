import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        // Testes de API: arrancam a app compilada (npm run build) numa BD temporária
        extends: true,
        test: {
          name: "api",
          include: ["tests/api/**/*.test.ts"],
          globalSetup: ["tests/api/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
