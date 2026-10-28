// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const express = require("express");
const http = require("http");
const { publicRateLimit, MAX_REQUESTS } = require("./publicRateLimit");

const get = (port) =>
  new Promise((resolve, reject) => {
    http
      .get({ port, path: "/" }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      })
      .on("error", reject);
  });

describe("publicRateLimit", () => {
  let server;
  let port;

  beforeEach(async () => {
    const app = express();
    app.use(publicRateLimit);
    app.get("/", (req, res) => res.json({ success: true }));
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
    port = server.address().port;
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  it("should allow requests up to the limit, then answer 429 in the standard error shape", async () => {
    // Act
    for (let i = 0; i < MAX_REQUESTS; i += 1) {
      const ok = await get(port);
      expect(ok.status).toBe(200);
    }
    const blocked = await get(port);

    // Assert
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: "Too many verification requests. Please wait a minute and try again.",
    });
  });
});
