// Structure the staged Word-library talks (data/raw/tbt-*.md) into the standard
// talk JSON under data/processed/<trade>/, update data/processed/index-by-trade.json,
// and write docs/toolbox-library-import-report.md.
//
//   node scripts/parse-toolbox-docx.js     # stage raw files first
//   node scripts/build-tbt-talks.js
//
// Classification (duplicates, out-of-scope, trade, OSHA, US titles) lives in
// scripts/lib/tbtCatalog.js. Idempotent: re-running rewrites the same files.

const fs = require("fs");
const path = require("path");

const { parseRawTalk, buildTalkJson, mergeLedgers } = require("./lib/tbtBuild");
const { toUsEnglish } = require("./lib/usEnglish");
const catalog = require("./lib/tbtCatalog");

const ROOT = path.join(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_DIR = path.join(ROOT, "data", "processed");
const INDEX_PATH = path.join(OUT_DIR, "index-by-trade.json");
const AUTHORED_DIR = path.join(ROOT, "data", "authored");
const REPORT_PATH = path.join(ROOT, "docs", "toolbox-library-import-report.md");

// Talks with a genuinely unique body that were reviewed by hand against the
// mapped OSHA standards (see the report). Everything else needs a per-talk review.
const HAND_VERIFIED = new Set(["002", "028", "037"]);

const main = () => {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const raws = fs
    .readdirSync(RAW_DIR)
    .filter((f) => /^tbt-\d{3}-.*\.md$/.test(f))
    .map((f) => parseRawTalk(fs.readFileSync(path.join(RAW_DIR, f), "utf8")))
    .sort((a, b) => a.number.localeCompare(b.number));
  if (raws.length !== 300) throw new Error(`expected 300 raw talks, found ${raws.length}`);

  const byHash = {};
  for (const r of raws) (byHash[r.bodyHash] ||= []).push(r.number);

  const built = [];
  const usedIds = new Map();
  const existingIds = new Set();
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  // Drop this import's own entries from a previous run so a re-run rebuilds
  // them instead of treating them as pre-existing talks (keeps it idempotent).
  for (const [trade, entries] of Object.entries(index.trades)) {
    // Also prune entries whose file is gone (a retitled or reverted agency talk
    // changes its id / file path); agency talks are re-indexed below.
    index.trades[trade] = entries.filter((e) => {
      if (e.source === "TailgatePro Library") return false;
      const file = path.join(ROOT, e.file_path);
      if (!fs.existsSync(file)) return false;
      // Agency-sourced replacements (source_ref set) are re-indexed from the
      // files below, so a removed trade tag does not leave a stale entry.
      return !JSON.parse(fs.readFileSync(file, "utf8")).attribution?.source_ref;
    });
    if (index.trades[trade].length === 0) delete index.trades[trade];
  }
  for (const entries of Object.values(index.trades)) for (const e of entries) existingIds.add(e.id);

  // Agency-source ledger (written by @safety-collector in TBT replacement mode).
  // `matched` talks are rebuilt from the agency source by @safety-structurer and
  // must never be overwritten here; `duplicate-of-existing` talks are dropped.
  const ledgerFiles = fs.readdirSync(RAW_DIR).filter((f) => /^_tbt-source-matches\..+\.json$/.test(f));
  const takenUrls = new Set();
  for (const entries of Object.values(index.trades)) {
    for (const e of entries) {
      const p = path.join(ROOT, e.file_path);
      if (fs.existsSync(p)) {
        // Only the original agency talks count; TBT-derived talks (including
        // agency-sourced replacements, which carry source_ref) must not make
        // their own source look "already used" on a re-run.
        const attribution = JSON.parse(fs.readFileSync(p, "utf8")).attribution;
        if (attribution?.source_url && !attribution.source_ref) takenUrls.add(attribution.source_url);
      }
    }
  }
  const ledger = mergeLedgers(ledgerFiles.map((f) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), "utf8"))), takenUrls);
  fs.writeFileSync(path.join(RAW_DIR, "_tbt-source-matches.json"), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  const sourced = new Set(Object.keys(ledger).filter((n) => ledger[n].status === "matched"));
  const ledgerDup = new Set(Object.keys(ledger).filter((n) => ledger[n].status === "duplicate-of-existing"));

  // Original talks written by scripts/build-authored-talks.js replace the Word-library
  // placeholder for their TBT number, so this script must not regenerate it.
  const authoredNums = new Set(
    fs.existsSync(AUTHORED_DIR) ? fs.readdirSync(AUTHORED_DIR).filter((f) => /^\d{3}\.json$/.test(f)).map((f) => f.slice(0, 3)) : []
  );

  const dropped = [];
  for (const raw of raws) {
    const n = raw.number;
    if (catalog.DUPLICATES[n] || catalog.WITHIN_IMPORT_DUPLICATES[n] || catalog.OUT_OF_SCOPE[n]) continue;
    if (sourced.has(n) || ledgerDup.has(n) || authoredNums.has(n)) continue;
    const row = catalog.ROWS[n];
    if (!row) throw new Error(`TBT-${n} ${raw.title}: not classified in tbtCatalog.js`);

    const [primary, tags, osha] = row;
    const title = catalog.TITLE_OVERRIDES[n] || toUsEnglish(raw.title);
    const json = buildTalkJson(
      raw,
      { title, primary, tags, osha },
      {
        siblings: byHash[raw.bodyHash].filter((x) => x !== n),
        now,
        verified: HAND_VERIFIED.has(n),
      }
    );

    // Decision 2026-09-25: Word-library talks that are not hand-verified are dropped, not kept as
    // needs_revision placeholders. They stay in the .docx and are regenerable, but never written.
    if (json.audit.status !== "approved") {
      dropped.push({ n, title, trade: json.primary_trade });
      continue;
    }

    if (existingIds.has(json.id)) throw new Error(`TBT-${n}: id "${json.id}" collides with an existing talk`);
    if (usedIds.has(json.id)) throw new Error(`TBT-${n}: id "${json.id}" also produced by TBT-${usedIds.get(json.id)}`);
    usedIds.set(json.id, n);
    built.push({ n, json });
  }

  // --- drop previously generated files for talks now known to be duplicates --
  const droppedNums = new Set(dropped.map((d) => d.n));
  for (const d of fs.readdirSync(OUT_DIR, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    for (const f of fs.readdirSync(path.join(OUT_DIR, d.name))) {
      const file = path.join(OUT_DIR, d.name, f);
      const a = JSON.parse(fs.readFileSync(file, "utf8")).attribution;
      const ref = a?.source_ref?.slice(4);
      if (a?.source === "TailgatePro Library" && (ledgerDup.has(ref) || authoredNums.has(ref) || droppedNums.has(ref))) fs.unlinkSync(file);
    }
  }

  // --- write talk files ----------------------------------------------------
  for (const { json } of built) {
    const dir = path.join(OUT_DIR, catalog.TRADE_SLUGS[json.primary_trade]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${json.id}.json`), `${JSON.stringify(json, null, 2)}\n`, "utf8");
  }

  // Talks already rebuilt from an agency source (written by @safety-structurer,
  // never by this script): read them back so they are indexed and reported.
  const sourcedTalks = [];
  for (const d of fs.readdirSync(OUT_DIR, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    for (const f of fs.readdirSync(path.join(OUT_DIR, d.name))) {
      const json = JSON.parse(fs.readFileSync(path.join(OUT_DIR, d.name, f), "utf8"));
      const a = json.attribution;
      if (a?.source_ref && a.source !== "TailgatePro Library") sourcedTalks.push({ n: a.source_ref.slice(4), json, dir: d.name });
    }
  }
  sourcedTalks.sort((a, b) => a.n.localeCompare(b.n));

  // --- update the master index (existing entries preserved, deleted files pruned) --
  for (const [trade, list] of Object.entries(index.trades)) {
    index.trades[trade] = list.filter((e) => fs.existsSync(path.join(ROOT, e.file_path)));
    if (!index.trades[trade].length) delete index.trades[trade];
  }
  for (const { json, dir } of sourcedTalks) {
    for (const trade of json.trade_tags) {
      const list = (index.trades[trade] ||= []);
      if (list.some((e) => e.id === json.id)) continue;
      list.push({ id: json.id, title: json.title, file_path: `data/processed/${dir}/${json.id}.json`, osha_standards: json.osha_standards, source: json.attribution.source });
    }
  }
  for (const { json } of built) {
    const file_path = `data/processed/${catalog.TRADE_SLUGS[json.primary_trade]}/${json.id}.json`;
    for (const trade of json.trade_tags) {
      const list = (index.trades[trade] ||= []);
      if (list.some((e) => e.id === json.id)) continue;
      list.push({ id: json.id, title: json.title, file_path, osha_standards: json.osha_standards, source: "TailgatePro Library" });
    }
  }
  for (const list of Object.values(index.trades)) list.sort((a, b) => a.title.localeCompare(b.title));
  index.trades = Object.fromEntries(Object.entries(index.trades).sort(([a], [b]) => a.localeCompare(b)));
  index.total_talks = new Set(Object.values(index.trades).flatMap((l) => l.map((e) => e.id))).size;
  index.last_updated = now;
  fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  // --- report ---------------------------------------------------------------
  const approved = built.filter((b) => b.json.audit.status === "approved");
  const sourcedApproved = sourcedTalks.filter((t) => t.json.audit?.status === "approved");
  // Rebuilt from an agency talk vs. written from scratch (data/authored/, license "original-work").
  const authoredTalks = sourcedTalks.filter((t) => t.json.attribution.license === "original-work");
  const agencyTalks = sourcedTalks.filter((t) => t.json.attribution.license !== "original-work");
  const approvedIn = (list) => list.filter((t) => t.json.audit?.status === "approved").length;
  const sourcedNumbers = new Set(sourcedTalks.map((t) => t.n));
  const title = (n) => raws.find((r) => r.number === n).title;
  const cand = JSON.parse(fs.readFileSync(path.join(RAW_DIR, "_dedupe-candidates.json"), "utf8"));
  const skipped = new Set([...Object.keys(catalog.DUPLICATES), ...Object.keys(catalog.WITHIN_IMPORT_DUPLICATES), ...Object.keys(catalog.OUT_OF_SCOPE)]);
  const near = cand.vsExisting.filter((c) => !skipped.has(c.tbt.slice(4)) && !sourcedNumbers.has(c.tbt.slice(4)) && !ledgerDup.has(c.tbt.slice(4)));

  const lines = [
    "# Toolbox talk library import report",
    "",
    `Source: \`data/300_Toolbox_Talks_Library.docx\` (300 talks, generated ${now}).`,
    "Regenerate with `node scripts/parse-toolbox-docx.js && node scripts/build-tbt-talks.js`.",
    "",
    "## Result",
    "",
    "| Outcome | Count |",
    "| --- | --- |",
    `| Parsed from the Word file | ${raws.length} |`,
    `| Skipped: duplicate of an existing talk | ${Object.keys(catalog.DUPLICATES).length} |`,
    `| Skipped: duplicate inside the import | ${Object.keys(catalog.WITHIN_IMPORT_DUPLICATES).length} |`,
    `| Skipped: not a safety/health topic | ${Object.keys(catalog.OUT_OF_SCOPE).length} |`,
    `| Skipped: source search found it duplicates an original talk | ${ledgerDup.size} |`,
    `| Processed into \`data/processed/\` | ${built.length + sourcedTalks.length} |`,
    `| — rebuilt from an agency source (OSHA / NIOSH / CPWR / EPA) | ${agencyTalks.length} |`,
    `|   — audit \`approved\` (seeded by \`npm run seed:talks\`) | ${approvedIn(agencyTalks)} |`,
    `|   — not yet approved / needs revision | ${agencyTalks.length - approvedIn(agencyTalks)} |`,
    `| — original talks written from OSHA / NIOSH / EPA sources (\`data/authored/\`) | ${authoredTalks.length} |`,
    `|   — audit \`approved\` (seeded by \`npm run seed:talks\`) | ${approvedIn(authoredTalks)} |`,
    `|   — awaiting audit / needs revision | ${authoredTalks.length - approvedIn(authoredTalks)} |`,
    `| — Word-library content, hand-verified | ${built.length} |`,
    `| Dropped by decision (no agency source, overlap, or out of scope; not written) | ${dropped.length} |`,
    "",
    "## Why most Word-library talks need revision",
    "",
    `The 300 talks contain only ${Object.keys(byHash).length} distinct bodies: the hazards, controls and do/don't lists are boilerplate per theme with the title swapped in.`,
    "Talks whose body is shared with any other talk are flagged `generic-body`; talks whose title words never appear in their body are also flagged `title-body-mismatch`",
    "(e.g. *Working on Condensers* carries a cold-room body). Both keep the talk out of the seed until someone writes topic-specific content.",
    "",
    "## Rebuilt from an agency source",
    "",
    "| TBT | Talk | Source | Audit |",
    "| --- | --- | --- | --- |",
    ...agencyTalks.map((t) => `| ${t.n} | ${t.json.title} | [${t.json.attribution.source}](${t.json.attribution.source_url}) | ${t.json.audit?.status ?? "not audited"} |`),
    "",
    "## Original talks (written from OSHA / NIOSH / EPA sources)",
    "",
    "No agency talk existed for these topics, so each was written from the rule or guidance page linked below and checked by the auditor.",
    "",
    "| TBT | Talk | Written from | Audit |",
    "| --- | --- | --- | --- |",
    ...authoredTalks.map((t) => `| ${t.n} | ${t.json.title} | [${t.json.attribution.source_url.replace(/^https:\/\/(www\.)?/, "").slice(0, 60)}](${t.json.attribution.source_url}) | ${t.json.audit?.status ?? "not audited"} |`),
    "",
    "## Dropped by decision (2026-09-25)",
    "",
    "No agency source was found, the topic duplicates an approved talk, or it is out of scope (refrigeration plant, HR, warehouse). Not written to `data/processed/` and not seeded; the text remains in the .docx.",
    "",
    ...Object.entries(
      dropped.reduce((acc, d) => ((acc[d.trade] ||= []).push(`TBT-${d.n} ${d.title}`), acc), {})
    ).flatMap(([trade, items]) => [`**${trade}** (${items.length}): ${items.join("; ")}`, ""]),
    "## Skipped: duplicates of existing talks",
    "",
    "| TBT | Title | Existing talk kept |",
    "| --- | --- | --- |",
    ...Object.entries(catalog.DUPLICATES).sort(([a], [b]) => a.localeCompare(b)).map(([n, id]) => `| ${n} | ${title(n)} | \`${id}\` |`),
    ...[...ledgerDup].sort().map((n) => `| ${n} | ${title(n)} | \`${ledger[n].existing_raw ?? ledger[n].source_url}\` (found by source search) |`),
    "",
    "## Skipped: duplicate inside the import",
    "",
    ...Object.entries(catalog.WITHIN_IMPORT_DUPLICATES).map(([n, d]) => `- TBT-${n} ${title(n)} — ${d.reason}`),
    "",
    "## Skipped: not a safety/health topic",
    "",
    ...Object.entries(catalog.OUT_OF_SCOPE).sort(([a], [b]) => a.localeCompare(b)).map(([n, why]) => `- TBT-${n} ${title(n)} — ${why}`),
    "",
    "## Imported but overlapping an existing talk (your call)",
    "",
    "Same theme as an existing talk but a different angle, so they were kept. Delete the JSON file to drop one.",
    "",
    ...near.map((c) => {
      const ids = [...new Set(c.matches.map((m) => m.id))];
      const shown = ids.slice(0, 3).map((id) => `\`${id}\``).join(", ");
      return `- TBT-${c.tbt.slice(4)} ${c.title} ↔ ${shown}${ids.length > 3 ? ` (+${ids.length - 3} more)` : ""}`;
    }),
    "",
    "## Approved talks",
    "",
    ...[...sourcedApproved, ...approved.map((b) => ({ n: b.n, json: b.json }))].map((b) => `- TBT-${b.n} ${b.json.title} (\`${b.json.id}\`) — ${b.json.attribution.source} — OSHA: ${b.json.osha_standards.join(", ")}`),
    "",
  ];
  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");

  console.log(
    `processed ${built.length} (approved ${approved.length}), dropped ${dropped.length}; ` +
      `skipped: ${Object.keys(catalog.DUPLICATES).length} dup, ${Object.keys(catalog.WITHIN_IMPORT_DUPLICATES).length} within-import, ${Object.keys(catalog.OUT_OF_SCOPE).length} out-of-scope`
  );
};

main();
