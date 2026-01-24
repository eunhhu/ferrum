import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
      include: [
        "src/components/**/*.{ts,tsx}",
        "src/stores/**/*.ts",
        "src/hooks/**/*.ts",
        "src/utils/**/*.ts",
        "src/ipc/**/*.ts",
      ],
      exclude: [
        "src/test/**",
        "src/__tests__/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
        "src/vite-env.d.ts",
        "**/mockData.ts",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./src/test"),
    },
    conditions: ["development", "browser"],
  },
});
