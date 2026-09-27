const { buildBundleIndexCsv } = require("./buildBundleIndex");

const entry = (overrides) => ({
  companyName: "Acme Roofing",
  projectName: "Riverside Tower",
  talkTitle: "Fall Protection",
  heldAt: "2026-09-21T14:00:00.000Z",
  filename: "acme-roofing-riverside-tower-2026-09-21-meeting1.pdf",
  ...overrides,
});

describe("buildBundleIndexCsv", () => {
  it("should write the header row and one row per entry", () => {
    // Act
    const csv = buildBundleIndexCsv([entry()]);

    // Assert
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe('"Company","Project","Talk","Held At","Filename"');
    expect(lines[1]).toBe(
      '"Acme Roofing","Riverside Tower","Fall Protection","2026-09-21T14:00:00.000Z","acme-roofing-riverside-tower-2026-09-21-meeting1.pdf"',
    );
  });

  it("should return only the header (plus trailing newline) for no entries", () => {
    // Act
    const csv = buildBundleIndexCsv([]);

    // Assert
    expect(csv).toBe('"Company","Project","Talk","Held At","Filename"\n');
  });

  it("should escape a field containing a quote by doubling it", () => {
    // Act
    const csv = buildBundleIndexCsv([entry({ projectName: 'The "Riverside" Tower' })]);

    // Assert
    expect(csv).toContain('"The ""Riverside"" Tower"');
  });

  it("should escape a field containing a comma", () => {
    // Act
    const csv = buildBundleIndexCsv([entry({ companyName: "Acme, Inc." })]);

    // Assert
    expect(csv).toContain('"Acme, Inc."');
  });

  it("should render a null talkTitle as an empty quoted field", () => {
    // Act
    const csv = buildBundleIndexCsv([entry({ talkTitle: null })]);

    // Assert
    const dataLine = csv.trimEnd().split("\n")[1];
    expect(dataLine).toContain(',"",');
  });

  it("should append no note line when nothing was skipped", () => {
    // Act
    const csv = buildBundleIndexCsv([entry()], { skippedCount: 0 });

    // Assert
    expect(csv).not.toContain("#");
  });

  it("should append a singular note line when exactly one entry was skipped", () => {
    // Act
    const csv = buildBundleIndexCsv([entry()], { skippedCount: 1 });

    // Assert
    expect(csv).toContain(
      "# 1 completed meeting log excluded — no PDF has been generated for it yet.",
    );
  });

  it("should append a plural note line when several entries were skipped", () => {
    // Act
    const csv = buildBundleIndexCsv([entry()], { skippedCount: 3 });

    // Assert
    expect(csv).toContain(
      "# 3 completed meeting logs excluded — no PDF has been generated for them yet.",
    );
  });
});
