// One-shot migration: add an `attribution` block to every processed talk file
// and a `source` tag to every entry in index-by-trade.json.
//
// The harvest structurer drops the raw files' frontmatter (`agency`,
// `source_url`, `rights`), so provenance never reaches the DB or the app. The
// app must display CPWR/NIOSH copyright markings (a CPWR licensing condition),
// so this recovers that credit from data/raw/*.md and writes it into
// data/processed/**. Deterministic and idempotent: re-running overwrites the
// same block in place.
//
// Usage (from repo root):  node scripts/backfill-attribution.js
//
// The structurer's schema doc (.claude/agents/talks/safety-structurer.md) now
// documents `attribution` so future harvest rounds emit it natively and this
// script is not needed again.

const fs = require("fs");
const path = require("path");

const RAW_DIR = path.join(__dirname, "..", "data", "raw");
const PROCESSED_DIR = path.join(__dirname, "..", "data", "processed");
const INDEX_FILE = path.join(PROCESSED_DIR, "index-by-trade.json");

// Fixed per-agency templates. `source` and `source_url` are filled per file
// from the raw frontmatter; everything else is boilerplate chosen by agency.
// Every `notice` ends with the no-endorsement clause.
const TEMPLATES = {
  CPWR: {
    source: "CPWR",
    publisher: "CPWR — The Center for Construction Research and Training",
    copyright:
      "© 2017 CPWR — The Center for Construction Research and Training. All rights reserved.",
    license: "free-use-with-attribution",
    notice:
      "Adapted from a CPWR/NIOSH Toolbox Talk, produced under NIOSH cooperative " +
      "agreement OH 009762. Reproduced with attribution for jobsite safety " +
      "training; not an endorsement by CPWR or NIOSH.",
  },
  NIOSH: {
    source: "NIOSH",
    publisher:
      "National Institute for Occupational Safety and Health (NIOSH)",
    copyright: "U.S. Government work — public domain.",
    license: "public-domain",
    notice:
      "Adapted from a NIOSH Toolbox Talk (co-developed with CPWR). " +
      "Public-domain source; not an endorsement by NIOSH or CPWR.",
  },
};

// Pull the handful of scalar keys we need out of a raw file's `--- ... ---`
// frontmatter. The block is flat `key: value` lines (plus a couple of nested
// lists we ignore), so a line scanner is enough — no YAML dependency.
const readFrontmatter = (filePath) => {
  const text = fs.readFileSync(filePath, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue; // list items ("  - ...") and blanks
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
};

const buildAttribution = (agency, sourceUrl) => {
  const tpl = TEMPLATES[agency];
  if (!tpl) throw new Error(`no attribution template for agency "${agency}"`);
  return {
    source: tpl.source,
    publisher: tpl.publisher,
    copyright: tpl.copyright,
    license: tpl.license,
    source_url: sourceUrl || null,
    notice: tpl.notice,
  };
};

// Map every processed talk id -> its file path (walk the per-trade dirs only;
// index-by-trade.json sits at the root and is skipped).
const indexProcessedFiles = () => {
  const byId = new Map();
  for (const entry of fs.readdirSync(PROCESSED_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tradeDir = path.join(PROCESSED_DIR, entry.name);
    for (const name of fs.readdirSync(tradeDir)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(tradeDir, name);
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      byId.set(json.id, { file, json });
    }
  }
  return byId;
};

// Rewrite the object with `attribution` inserted immediately before `audit`
// (string keys keep insertion order through JSON.stringify).
const withAttribution = (json, attribution) => {
  const { audit, attribution: _drop, ...rest } = json;
  return audit === undefined
    ? { ...rest, attribution }
    : { ...rest, attribution, audit };
};

const writeJson = (file, obj) =>
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, "utf8");

const main = () => {
  const processed = indexProcessedFiles();
  const rawFiles = fs
    .readdirSync(RAW_DIR)
    .filter((n) => n.endsWith(".md"))
    .sort();

  const bySource = {};
  const unmatchedRaw = [];
  const attributedIds = new Set();

  for (const name of rawFiles) {
    const slug = name.replace(/\.md$/, "").replace(/^(niosh|cpwr)-/, "");
    const target = processed.get(slug);
    if (!target) {
      unmatchedRaw.push(name);
      continue;
    }
    const fm = readFrontmatter(path.join(RAW_DIR, name));
    const attribution = buildAttribution(fm.agency, fm.source_url);
    writeJson(target.file, withAttribution(target.json, attribution));
    attributedIds.add(slug);
    bySource[slug] = attribution.source;
  }

  // Patch the master index: add `source` to every per-talk entry, bump the
  // timestamp.
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
  for (const entries of Object.values(index.trades)) {
    for (const entry of entries) {
      if (bySource[entry.id]) entry.source = bySource[entry.id];
    }
  }
  index.last_updated = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  writeJson(INDEX_FILE, index);

  const missingAttribution = [...processed.keys()].filter(
    (id) => !attributedIds.has(id)
  );

  console.log(
    `raw files: ${rawFiles.length}, processed talks: ${processed.size}, ` +
      `attribution written: ${attributedIds.size}`
  );
  if (unmatchedRaw.length) {
    console.warn(`raw with no processed match: ${unmatchedRaw.join(", ")}`);
  }
  if (missingAttribution.length) {
    console.warn(
      `processed talks left without attribution: ${missingAttribution.join(", ")}`
    );
  }
  if (unmatchedRaw.length || missingAttribution.length) process.exit(1);
};

main();
