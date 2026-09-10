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
          globIgnores: [
            "**/images/flyer-hero-2-big.png",
            // 1 MB PWA-icon master — the generated pwa-*.png are precached, not this.
            "logo.png",
          ],
        },
        registerType: "autoUpdate",
        // The SW is registered manually in src/main.tsx (production only).
        injectRegister: false,
        // Keep the SW out of `npm run dev` — it is registered only in prod builds.
        devOptions: { enabled: false },
        // Icons come from pwa-assets.config.ts (@vite-pwa/assets-generator):
        // it fills `manifest.icons`. The <head> <link> tags are written by hand
        // in index.html, so injection is turned off here to avoid duplicate
        // tags in the built HTML.
        pwaAssets: {
          config: true,
          includeHtmlHeadLinks: false,
          injectThemeColor: false,
        },
        manifest: {
          name: "TailgatePro — Digital Toolbox Safety Talks",
          short_name: "TailgatePro",
          description:
            "Run OSHA toolbox safety talks in the field, online or offline.",
          theme_color: "#ff5f15",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
        },
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
      // The Landing page renders a large tree (device mockups, comparison table,
      // FAQ); v8 coverage instrumentation pushes the first cold render past the
      // 5s default.
      testTimeout: 15000,
      include: ["tests/**/*.test.{ts,tsx}"],
      exclude: [
        ...configDefaults.exclude,
        "e2e/*",
        ".storybook",
        "**/*.stories.{ts,tsx}",
        "**/*.styles.ts",
        "dist/**",
        "**/index.ts",
      ],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "clover", "html"],
        thresholds: {
          global: {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
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
          "**/**styles.ts",
          "dist/**",
          "**/index.ts",
          "**/src/utils/EnvUtils.tsx",
          "**/src/utils/pxToRem.ts",
          "**/fixtures/*",
          "**/context/*",
          "**/src/service-worker.ts",
          "**/src/features/projects/ProjectForm.tsx",
          "**/src/ui_comps/modal/Modal.tsx",
          "**/src/utils/pwa.ts",
        ],
      },
    },
  };
});
