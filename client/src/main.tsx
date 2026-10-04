// import { StrictMode } from 'react'
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { initInstallCapture } from "./utils/pwa";

// Start listening for `beforeinstallprompt` immediately — Chromium fires it
// once, before React mounts. PwaInstallProvider reads the stashed event.
initInstallCapture();

// Register the injectManifest service worker (client/src/service-worker.ts).
// Guarded to production builds so the SW never intercepts the Vite dev server
// or the jsdom test environment. `autoUpdate` (see vite.config.ts) means a new
// SW activates as soon as it is ready.
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <App />,
  // </StrictMode>,
);
