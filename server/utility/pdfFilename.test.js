// Plain CommonJS — no `import` (see vitest.config.js / CLAUDE.md).
const { buildPdfFilename } = require("./pdfFilename");

describe("buildPdfFilename", () => {
  it("should slugify the company and project names and append the date and a short id", () => {
    // Act
    const filename = buildPdfFilename({
      companyName: "Acme Roofing",
      projectName: "Downtown Highrise",
      meetingDate: "2026-09-14T01:23:45.000Z",
      meetingLogId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    // Assert
    expect(filename).toBe("acme-roofing-downtown-highrise-2026-09-14-a1b2c3d4.pdf");
  });

  it("should strip special characters and unicode down to a safe slug", () => {
    // Act
    const filename = buildPdfFilename({
      companyName: "J&R Contracting",
      projectName: "Café & Bar — Phase 2 (Rënovation)!!",
      meetingDate: "2026-09-14T00:00:00.000Z",
      meetingLogId: "11111111-2222-3333-4444-555555555555",
    });

    // Assert
    expect(filename).toBe("j-r-contracting-caf-bar-phase-2-r-novation-2026-09-14-11111111.pdf");
  });

  it("should collapse extra whitespace into single hyphens", () => {
    // Act
    const filename = buildPdfFilename({
      companyName: "  Acme   Roofing  ",
      projectName: "  Main   Street   Project  ",
      meetingDate: "2026-09-14T00:00:00.000Z",
      meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
    });

    // Assert
    expect(filename).toBe("acme-roofing-main-street-project-2026-09-14-aaaaaaaa.pdf");
  });

  it("should fall back to 'company' when the company name is empty, missing, or all-symbols", () => {
    // Act & Assert
    expect(
      buildPdfFilename({
        companyName: "",
        projectName: "Site A",
        meetingDate: "2026-09-14T00:00:00.000Z",
        meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
      }),
    ).toBe("company-site-a-2026-09-14-aaaaaaaa.pdf");

    expect(
      buildPdfFilename({
        companyName: undefined,
        projectName: "Site A",
        meetingDate: "2026-09-14T00:00:00.000Z",
        meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
      }),
    ).toBe("company-site-a-2026-09-14-aaaaaaaa.pdf");

    expect(
      buildPdfFilename({
        companyName: "!!!",
        projectName: "Site A",
        meetingDate: "2026-09-14T00:00:00.000Z",
        meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
      }),
    ).toBe("company-site-a-2026-09-14-aaaaaaaa.pdf");
  });

  it("should fall back to 'project' when the project name is empty, missing, or all-symbols", () => {
    // Act & Assert
    expect(
      buildPdfFilename({
        companyName: "Acme Roofing",
        projectName: "",
        meetingDate: "2026-09-14T00:00:00.000Z",
        meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
      }),
    ).toBe("acme-roofing-project-2026-09-14-aaaaaaaa.pdf");

    expect(
      buildPdfFilename({
        companyName: "Acme Roofing",
        projectName: undefined,
        meetingDate: "2026-09-14T00:00:00.000Z",
        meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
      }),
    ).toBe("acme-roofing-project-2026-09-14-aaaaaaaa.pdf");

    expect(
      buildPdfFilename({
        companyName: "Acme Roofing",
        projectName: "!!!",
        meetingDate: "2026-09-14T00:00:00.000Z",
        meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
      }),
    ).toBe("acme-roofing-project-2026-09-14-aaaaaaaa.pdf");
  });

  it("should truncate a very long company or project name to 60 characters each", () => {
    // Act
    const filename = buildPdfFilename({
      companyName: "A".repeat(100),
      projectName: "B".repeat(100),
      meetingDate: "2026-09-14T00:00:00.000Z",
      meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
    });

    // Assert
    expect(filename).toBe(
      `${"a".repeat(60)}-${"b".repeat(60)}-2026-09-14-aaaaaaaa.pdf`,
    );
  });

  it("should fall back to 'undated' when meetingDate is missing", () => {
    // Act
    const filename = buildPdfFilename({
      companyName: "Acme Roofing",
      projectName: "Downtown Highrise",
      meetingDate: null,
      meetingLogId: "aaaaaaaa-0000-0000-0000-000000000000",
    });

    // Assert
    expect(filename).toBe("acme-roofing-downtown-highrise-undated-aaaaaaaa.pdf");
  });

  it("should use the meeting log id's first 8 characters with hyphens stripped", () => {
    // Act
    const filename = buildPdfFilename({
      companyName: "Acme",
      projectName: "Site A",
      meetingDate: "2026-09-14T00:00:00.000Z",
      meetingLogId: "ab-cd-ef-01-234567890",
    });

    // Assert
    expect(filename).toBe("acme-site-a-2026-09-14-abcdef01.pdf");
  });
});
