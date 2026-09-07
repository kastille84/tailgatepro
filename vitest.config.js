const { defineConfig } = require("vitest/config");

// Server-side Vitest config — separate from client/vite.config.ts, which runs
// client specs in browser mode. The server stays CommonJS/Node; no browser,
// no coverage threshold gate (client owns the 90% requirement for now).
//
// `globals: true` matters here for a reason beyond convenience: server test
// files must be written as plain CommonJS (require/module.exports, no `import`
// statements — see the note at the top of server/middlewares/requireAuth.test.js)
// so that their require() calls share Node's module cache with the CJS source
// files under test. Vitest exposes describe/it/expect/vi/etc. as globals so
// those files don't need `import { ... } from "vitest"` to get them (that
// import can't be `require()`d — Vitest only ships it as ESM).
module.exports = defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.js"],
  },
});
