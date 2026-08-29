import { loadEnv, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const rawEnv = loadEnv(mode, process.cwd(), "VITE_");

  const defineEnv: Record<string, string> = {
    "process.env.NODE_ENV": JSON.stringify(mode),
  };

  Object.entries(rawEnv).forEach(([k, v]) => {
    defineEnv[`process.env.${k}`] = JSON.stringify(v);
  });

  return {
    define: defineEnv,
    plugins: [
      react(),
      basicSsl(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "service-worker.ts",
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
          globIgnores: ["**/images/flyer-hero-2-big.png"],
        },
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      }),
    ],
    server: {
      https: true as any, // same as "--https" flag
      host: true, // same as "--host" flag
      proxy: {
        // Forward API calls to the Express server in dev so the browser stays
        // same-origin (matches production, where the server serves the SPA).
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./setupTests.ts",
      include: ["tests/**/*.test.{ts,tsx}"],
      exclude: [
        ...configDefaults.exclude,
        "e2e/*",
        ".storybook",
        "**/*.stories.{ts,tsx}",
      ],
      browser: {
        enabled: true,
        provider: "playwright",
        headless: false, // Set to false to see the browser UI
        instances: [{ browser: "chromium" }],
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "clover", "html"],
        thresholds: {
          global: {
            statements: 90,
            branches: 90,
            functions: 90,
            lines: 90,
          },
        },
        exclude: [
          "e2e/*",
          "eslint.config.js",
          "**/vite-env.d.ts",
          "**/main.tsx",
          "**/*.config.{ts,tsx}",
          "**/interfaces/*",
          "**/constants/*",
          "**/styles/*",
          "**/fixtures/*",
          "**/context/*",
        ],
      },
    },
  };
});
