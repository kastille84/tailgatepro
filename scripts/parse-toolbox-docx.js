// Stage the 300-talk Word library into data/raw/.
//
//   node scripts/parse-toolbox-docx.js [path-to.docx]
//
// Writes data/raw/tbt-<NNN>-<slug>.md (one lossless raw file per talk) and
// data/raw/_dedupe-candidates.json (matches against data/processed/ and within
// the import). No network, no Supabase. Next pipeline step: @safety-structurer.

const fs = require("fs");
const path = require("path");

const {
  readDocxText,
  parseTalks,
  bodyHash,
  rawFileName,
  toRawMarkdown,
  findDuplicateCandidates,
} = require("./lib/parseToolboxDocx");

const ROOT = path.join(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const INDEX = path.join(ROOT, "data", "processed", "index-by-trade.json");
const DEFAULT_DOCX = path.join(ROOT, "data", "300_Toolbox_Talks_Library.docx");

const main = () => {
  const docx = path.resolve(process.argv[2] || DEFAULT_DOCX);
  const talks = parseTalks(readDocxText(fs.readFileSync(docx)));
  if (talks.length === 0) throw new Error(`no talks found in ${docx}`);

  const sourcePath = path.relative(ROOT, docx).split(path.sep).join("/");
  const scrapedDate = new Date().toISOString();
  fs.mkdirSync(RAW_DIR, { recursive: true });

  for (const talk of talks) {
    const md = toRawMarkdown(talk, { sourcePath, scrapedDate, hash: bodyHash(talk) });
    fs.writeFileSync(path.join(RAW_DIR, rawFileName(talk)), md, "utf8");
  }

  // Existing talks, once each (the index lists a talk under every trade tag).
  const seen = new Map();
  const index = JSON.parse(fs.readFileSync(INDEX, "utf8"));
  for (const entries of Object.values(index.trades)) {
    for (const e of entries) seen.set(e.id, { id: e.id, title: e.title });
  }

  const candidates = findDuplicateCandidates(talks, [...seen.values()]);
  fs.writeFileSync(
    path.join(RAW_DIR, "_dedupe-candidates.json"),
    `${JSON.stringify({ source: sourcePath, generated_at: scrapedDate, ...candidates }, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `parsed ${talks.length} talks -> data/raw/tbt-*.md; ` +
      `${candidates.vsExisting.length} touch existing topics, ` +
      `${candidates.identicalBodies.length} identical-body groups`
  );
};

main();
