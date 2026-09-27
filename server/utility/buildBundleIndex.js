// Pure, I/O-free CSV formatting for the Defense Bundle ZIP's index.csv — same
// category as pdfFilename.js. Kept as a standalone helper so it's easily
// unit-tested without archiver/Storage in the loop, same reasoning
// pdfFilename.js's own header comment gives.

// RFC 4180-style escaping: any field containing a comma, quote or newline is
// wrapped in quotes, with internal quotes doubled. Every field goes through
// this, not just the ones that need it, so the shape never depends on the
// data.
const escapeCsvField = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const HEADER = ["Company", "Project", "Talk", "Held At", "Filename"];

// `entries` is the array `gcDashboard.js`'s getDefenseBundleEntries builds:
// { companyName, projectName, talkTitle, heldAt, filename }. `skippedCount`
// (meeting logs with no generated PDF yet, left out of the zip) is called out
// in a trailing note line so an all-zero count never looks like data loss.
const buildBundleIndexCsv = (entries, { skippedCount = 0 } = {}) => {
  const rows = entries.map((entry) =>
    [
      entry.companyName,
      entry.projectName,
      entry.talkTitle,
      entry.heldAt,
      entry.filename,
    ]
      .map(escapeCsvField)
      .join(","),
  );

  const lines = [HEADER.map(escapeCsvField).join(","), ...rows];

  if (skippedCount > 0) {
    lines.push(
      "",
      `# ${skippedCount} completed meeting log${skippedCount === 1 ? "" : "s"} excluded — no PDF has been generated for ${skippedCount === 1 ? "it" : "them"} yet.`,
    );
  }

  return `${lines.join("\n")}\n`;
};

module.exports = { buildBundleIndexCsv };
