// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md).

const { placeholderEmail } = require("./jobsiteMembers");

describe("placeholderEmail", () => {
  it("should build an undeliverable address keyed by the company id", () => {
    // Act / Assert
    expect(placeholderEmail("company-1")).toBe(
      "backfill+company-1@backfill.invalid",
    );
  });
});
