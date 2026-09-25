// Turn the hand-authored talks in data/authored/NNN.json into the standard talk
// JSON under data/processed/<trade>/. Each authored talk replaces the boilerplate
// Word-library file for the same TBT number (deleted if its path differs).
//
//   node scripts/build-authored-talks.js
//   node scripts/build-tbt-talks.js      # then re-index and regenerate the report
//
// Idempotent: re-running rewrites the same files.

const fs = require("fs");
const path = require("path");

const { buildAuthoredJson } = require("./lib/authoredBuild");
const { TRADE_SLUGS } = require("./lib/tbtCatalog");

const ROOT = path.join(__dirname, "..");
const AUTHORED_DIR = path.join(ROOT, "data", "authored");
const OUT_DIR = path.join(ROOT, "data", "processed");

const main = () => {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const authored = fs
    .readdirSync(AUTHORED_DIR)
    .filter((f) => /^\d{3}\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(AUTHORED_DIR, f), "utf8")));

  // Every other talk's id, so an authored talk can never overwrite an unrelated one.
  const owner = new Map();
  for (const d of fs.readdirSync(OUT_DIR, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    for (const f of fs.readdirSync(path.join(OUT_DIR, d.name))) {
      const a = JSON.parse(fs.readFileSync(path.join(OUT_DIR, d.name, f), "utf8")).attribution;
      owner.set(path.join(d.name, f), a?.source_ref || "original");
    }
  }

  let written = 0;
  let approved = 0;
  for (const a of authored) {
    const json = buildAuthoredJson(a, { now });
    const rel = path.join(TRADE_SLUGS[json.primary_trade], `${json.id}.json`);

    const holder = owner.get(rel);
    // Replacing this TBT's own file is expected; any other talk at the path is a collision.
    if (holder && holder !== `TBT-${a.n}`) throw new Error(`TBT-${a.n}: "${json.id}" collides with existing talk ${holder} at ${rel}`);

    for (const [file, ref] of owner) {
      if (path.basename(file) === `${json.id}.json` && file !== rel && ref !== `TBT-${a.n}`) throw new Error(`TBT-${a.n}: id "${json.id}" already used by ${ref} at ${file}`);
    }

    // Remove this TBT's Word-library placeholder if it lives at a different path.
    for (const [file, ref] of owner) {
      if (ref === `TBT-${a.n}` && file !== rel) {
        const p = path.join(OUT_DIR, file);
        if (JSON.parse(fs.readFileSync(p, "utf8")).attribution?.source === "TailgatePro Library") fs.unlinkSync(p);
      }
    }

    fs.mkdirSync(path.join(OUT_DIR, TRADE_SLUGS[json.primary_trade]), { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, rel), `${JSON.stringify(json, null, 2)}\n`, "utf8");
    written++;
    if (json.audit.status === "approved") approved++;
  }
  console.log(`authored talks written: ${written} (approved ${approved}, awaiting audit/revision ${written - approved})`);
};

main();
