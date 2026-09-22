// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md). A pure
// function, so no mocking is needed.

const { normalizeJobsiteName, groupProjectsIntoJobsites } = require("./jobsites");

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

describe("groupProjectsIntoJobsites", () => {
  it("should group projects that normalize to the same name", () => {
    // Arrange — oldest first, as the service is expected to pass them in.
    const projects = [
      { id: "p1", name: "Riverside Tower", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "p2", name: "  riverside   tower ", createdAt: "2026-02-01T00:00:00.000Z" },
    ];

    // Act
    const result = groupProjectsIntoJobsites(projects);

    // Assert
    expect(result).toEqual([
      { name: "Riverside Tower", projects: [projects[0], projects[1]] },
    ]);
  });

  it("should keep near-duplicate names as separate jobsites", () => {
    // Arrange
    const projects = [
      { id: "p1", name: "Riverside Tower" },
      { id: "p2", name: "Riverside Twr" },
    ];

    // Act
    const result = groupProjectsIntoJobsites(projects);

    // Assert
    expect(result).toHaveLength(2);
  });

  it("should use the earliest row's original spelling as the display name", () => {
    // Arrange — p1 is oldest and spelled differently from p2.
    const projects = [
      { id: "p1", name: "riverside tower" },
      { id: "p2", name: "Riverside Tower" },
    ];

    // Act
    const result = groupProjectsIntoJobsites(projects);

    // Assert
    expect(result[0].name).toBe("riverside tower");
  });

  it("should sort groups by display name", () => {
    // Arrange
    const projects = [
      { id: "p1", name: "Zenith Site" },
      { id: "p2", name: "Alpha Site" },
    ];

    // Act
    const result = groupProjectsIntoJobsites(projects);

    // Assert
    expect(result.map((g) => g.name)).toEqual(["Alpha Site", "Zenith Site"]);
  });

  it("should return an empty array for no projects", () => {
    // Act / Assert
    expect(groupProjectsIntoJobsites([])).toEqual([]);
  });
});
