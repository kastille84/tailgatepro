// Seed / loader for the Content Library.
//
// Reads the audited talk files produced by the content pipeline
// (data/processed/<primary-trade-slug>/<topic-slug>.json — see
// .claude/agents/talks/) and upserts them into the Supabase `toolbox_talks`
// table. Idempotent: each row's UUID is derived from its slug, and the write
// is an upsert on `slug`, so re-running updates in place and never duplicates.
//
// Usage (from repo root):  npm run seed:talks
// Requires the root .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, and the
// toolbox_talks columns from Supabase_SQL.sql already applied.

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { supabase } = require("../server/utility/supabaseClient");
const { buildRow, isApproved } = require("./lib/talkRow");

const PROCESSED_DIR = path.join(__dirname, "..", "data", "processed");
const CHUNK = 500;

// data/processed holds one directory per primary trade; each contains the talk
// JSON files. index-by-trade.json sits at the root and is skipped (it lists a
// talk under every one of its trade_tags — walking the per-trade files gives
// each talk exactly once).
const findTalkFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tradeDir = path.join(dir, entry.name);
    for (const name of fs.readdirSync(tradeDir)) {
      if (name.endsWith(".json")) files.push(path.join(tradeDir, name));
    }
  }
  return files;
};

const main = async () => {
  const files = findTalkFiles(PROCESSED_DIR);
  if (files.length === 0) {
    console.error(
      `No talk files under ${PROCESSED_DIR}. Run the harvest pipeline first ` +
        `(@safety-collector -> @safety-structurer -> @safety-auditor).`
    );
    process.exit(1);
  }

  const rows = [];
  let skipped = 0;

  for (const file of files) {
    const rel = path.relative(PROCESSED_DIR, file);
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      throw new Error(`invalid JSON in ${rel}: ${err.message}`);
    }

    if (!isApproved(json)) {
      skipped += 1;
      console.warn(`skip (audit not approved): ${rel}`);
      continue;
    }

    try {
      rows.push(buildRow(json));
    } catch (err) {
      throw new Error(`cannot build row from ${rel}: ${err.message}`);
    }
  }

  if (rows.length === 0) {
    console.error(
      `Parsed ${files.length} file(s) but none are audit-approved — nothing to upsert.`
    );
    process.exit(1);
  }

  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("toolbox_talks")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      // A unique-violation is not expected from upsert-on-slug; if it ever
      // surfaces, treat it as an idempotent success rather than a failure
      // (mirrors server/services/waitlist.js).
      if (error.code === "23505") {
        console.warn(`ignored duplicate-key on batch starting ${i}: ${error.message}`);
      } else {
        console.error(`upsert failed on batch starting ${i}: ${error.message}`);
        process.exit(1);
      }
    }
    upserted += batch.length;
  }

  console.log(
    `parsed ${files.length}, skipped ${skipped} (not approved), upserted ${upserted}`
  );
};

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
