// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed.

const { normalizeJobsiteName } = require("./jobsiteGrouping");

describe("normalizeJobsiteName", () => {
  it("should trim, collapse whitespace and lowercase", () => {
    // Act / Assert
    expect(normalizeJobsiteName("  Riverside   Tower  ")).toBe("riverside tower");
  });

  it("should return an empty string for a nullish name", () => {
    // Act / Assert
    expect(normalizeJobsiteName(null)).toBe("");
    expect(normalizeJobsiteName(undefined)).toBe("");
  });
});
