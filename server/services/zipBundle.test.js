// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { PassThrough } = require("stream");
const storageService = require("./storage");
const { streamJobsiteBundle } = require("./zipBundle");

const downloadSpy = vi.spyOn(storageService, "downloadBlob");

const entry = (overrides) => ({
  path: "meeting-1/report.pdf",
  filename: "acme-roofing-riverside-tower-2026-09-21-meeting1.pdf",
  companyName: "Acme Roofing",
  projectName: "Riverside Tower",
  talkTitle: "Fall Protection",
  heldAt: "2026-09-21T14:00:00.000Z",
  ...overrides,
});

// Collects everything written to a PassThrough into one Buffer once it ends —
// standing in for `res`, the same way a real Writable would be consumed.
const collect = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

beforeEach(() => {
  downloadSpy.mockReset().mockResolvedValue(Buffer.from("%PDF-1.4 fake pdf bytes"));
});

describe("zipBundle service: streamJobsiteBundle", () => {
  it("should pipe a valid, non-empty ZIP containing every entry's PDF and an index.csv", async () => {
    // Arrange
    const output = new PassThrough();
    const collected = collect(output);

    // Act
    await streamJobsiteBundle([entry(), entry({ path: "meeting-2/report.pdf", filename: "meeting-2.pdf" })], output);
    const buffer = await collected;

    // Assert — the ZIP local-file-header signature, and both PDFs downloaded.
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(downloadSpy).toHaveBeenCalledWith("meeting-pdfs", "meeting-1/report.pdf");
    expect(downloadSpy).toHaveBeenCalledWith("meeting-pdfs", "meeting-2/report.pdf");
    expect(downloadSpy).toHaveBeenCalledTimes(2);
  });

  it("should resolve for zero entries, still producing an index-only ZIP", async () => {
    // Arrange
    const output = new PassThrough();
    const collected = collect(output);

    // Act
    await streamJobsiteBundle([], output);
    const buffer = await collected;

    // Assert
    expect(buffer.slice(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it("should reject when a PDF download fails partway through, without hanging", async () => {
    // Arrange
    const output = new PassThrough();
    output.resume(); // drain so a partial write before the failure doesn't back up
    const failure = new Error("Could not download the file");
    downloadSpy.mockResolvedValueOnce(Buffer.from("first pdf")).mockRejectedValueOnce(failure);

    // Act & Assert
    await expect(
      streamJobsiteBundle([entry(), entry({ path: "meeting-2/report.pdf" })], output),
    ).rejects.toBe(failure);
  });
});
