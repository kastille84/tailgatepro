import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

// Generates the PWA icon set from a single square master
// (client/public/logo.png, 1024x1024). Output lands next to the master in
// client/public/. The minimal-2023 preset emits:
//   pwa-64x64.png, pwa-192x192.png, pwa-512x512.png
//   maskable-icon-512x512.png
//   apple-touch-icon-180x180.png
//   favicon.ico
// vite-plugin-pwa picks this up via `pwaAssets: { config: true }` in
// vite.config.ts and fills `manifest.icons`. The master itself is kept out of
// the SW precache via `injectManifest.globIgnores` there.
export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset: minimal2023Preset,
  images: ["public/logo.png"],
});
