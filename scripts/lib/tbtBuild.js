// Pure transforms: raw TBT markdown (from scripts/parse-toolbox-docx.js) ->
// the standard talk JSON (see .claude/agents/talks/safety-structurer.md).
// No I/O. CommonJS. Tested in tbtBuild.test.js.

const { slugify } = require("./parseToolboxDocx");
const { toUsEnglish, findUkTerms } = require("./usEnglish");

const SECTION_KEYS = {
  "Why It Matters": "whyItMatters",
  "KEY HAZARDS": "keyHazards",
  "REQUIRED CONTROLS": "requiredControls",
  "EMPLOYEES MUST": "employeesMust",
  "EMPLOYEES MUST NOT": "employeesMustNot",
  "GOOD PRACTICE": "goodPractice",
  "EMERGENCY / INCIDENT RESPONSE": "emergencyResponse",
  "Supervisor Discussion": "supervisorDiscussion",
};

/**
 * Parse one data/raw/tbt-*.md file.
 * @param {string} md
 * @returns {{ number: string, title: string, bodyHash: string, whyItMatters: string, [k: string]: any }}
 */
const parseRawTalk = (rawMd) => {
  const md = rawMd.replace(/\r\n/g, "\n"); // git autocrlf on Windows
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!fm) throw new Error("raw talk has no frontmatter");
  const meta = {};
  for (const line of fm[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }

  const talk = {
    number: /TBT-(\d{3})/.exec(meta.tbt_number || "")?.[1],
    title: JSON.parse(meta.title),
    bodyHash: meta.body_hash,
    whyItMatters: "",
    keyHazards: [],
    requiredControls: [],
    employeesMust: [],
    employeesMustNot: [],
    goodPractice: [],
    emergencyResponse: [],
    supervisorDiscussion: [],
  };
  if (!talk.number) throw new Error("raw talk has no tbt_number");

  let key = null;
  for (const line of md.slice(fm[0].length).split("\n")) {
    if (line.startsWith("## ")) {
      key = SECTION_KEYS[line.slice(3).trim()] || null;
    } else if (key && line.trim() !== "") {
      if (key === "whyItMatters") talk.whyItMatters = line.trim();
      else talk[key].push(line.replace(/^-\s*/, "").trim());
    }
  }
  return talk;
};

// --- sentence helpers ------------------------------------------------------

const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Keep acronyms / proper starts ("PPE", "OSHA") intact.
const lowerFirst = (s) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const sentence = (s) => {
  const t = upperFirst(s.trim());
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

const words = (s) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

const overlaps = (a, b) => {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return false;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size) >= 0.6;
};

/**
 * Pick up to 8 talking points: 3 required controls, 1 employee "must" that does
 * not repeat them, 2 "never" items, 1 good practice, and 1 emergency line.
 */
const buildTalkingPoints = (t) => {
  const points = [];
  const add = (text) => {
    if (!points.some((p) => overlaps(p, text))) points.push(text);
  };

  t.requiredControls.slice(0, 3).forEach((s) => add(sentence(s)));
  const must = t.employeesMust.find((s) => !points.some((p) => overlaps(p, s)));
  if (must) add(sentence(must));
  t.employeesMustNot.slice(0, 2).forEach((s) => add(sentence(`Never ${lowerFirst(s)}`)));
  if (t.goodPractice[0]) add(sentence(t.goodPractice[0]));

  const emergency = t.emergencyResponse.slice(0, 3).map((s) => lowerFirst(s.trim().replace(/[.!?]$/, "")));
  if (emergency.length) points.push(sentence(`If something goes wrong: ${emergency.join("; ")}`));
  return points;
};

const STOP = new Set(["safety", "awareness", "working", "with", "and", "the", "for", "use", "from", "near", "around"]);

/** True when none of the title's key words appear anywhere in the talk body. */
const titleMissingFromBody = (title, t) => {
  const body = [t.keyHazards, t.requiredControls, t.employeesMust, t.employeesMustNot, t.goodPractice, t.emergencyResponse]
    .flat()
    .join(" ")
    .toLowerCase();
  const stems = [...words(title)].filter((w) => !STOP.has(w)).map((w) => w.slice(0, 5));
  return stems.length > 0 && !stems.some((s) => body.includes(s));
};

const ATTRIBUTION = (number) => ({
  source: "TailgatePro Library",
  publisher: "TailgatePro",
  copyright: "Adapted for U.S. construction use from the \"300 Toolbox Talks Library\" (Rev. 2.0).",
  license: "owner-provided-unverified",
  source_url: null,
  source_ref: `TBT-${number}`,
  notice: "Localized to U.S. (OSHA) terminology. General guidance only; follow your company safety program and site-specific requirements.",
});

/**
 * @param {object} raw - parseRawTalk output
 * @param {{ title: string, primary: string, tags: string[], osha: string[] }} meta
 * @param {{ siblings: string[], now: string, verified?: boolean }} ctx
 *   siblings: other TBT numbers sharing this talk's body hash (whole library)
 * @returns {object} talk JSON in schema order
 */
const buildTalkJson = (raw, meta, ctx) => {
  const us = (s) => toUsEnglish(s.split(raw.title).join(meta.title));
  const json = {
    id: slugify(meta.title),
    title: meta.title,
    primary_trade: meta.primary,
    trade_tags: [meta.primary, ...meta.tags.filter((t) => t !== meta.primary)],
    osha_standards: meta.osha,
    estimated_minutes: 5,
    summary: sentence(us(raw.whyItMatters)),
    talking_points: buildTalkingPoints({
      ...raw,
      requiredControls: raw.requiredControls.map(toUsEnglish),
      employeesMust: raw.employeesMust.map(toUsEnglish),
      employeesMustNot: raw.employeesMustNot.map(toUsEnglish),
      goodPractice: raw.goodPractice.map(toUsEnglish),
      emergencyResponse: raw.emergencyResponse.map(toUsEnglish),
    }),
    site_hazards_to_check: raw.keyHazards.map((h) => upperFirst(toUsEnglish(h))),
    discussion_questions: raw.supervisorDiscussion.map(us),
    attribution: ATTRIBUTION(raw.number),
  };

  const flags = [];
  const blocking = [];
  if (ctx.siblings.length) {
    blocking.push(
      `generic-body: this talk's hazards/controls text is identical to ${ctx.siblings.length} other library talk(s) ` +
        `(${ctx.siblings.slice(0, 6).map((n) => `TBT-${n}`).join(", ")}${ctx.siblings.length > 6 ? ", ..." : ""}); only the title differs. ` +
        "Write topic-specific content before publishing."
    );
  }
  if (titleMissingFromBody(meta.title, raw)) {
    blocking.push(
      `title-body-mismatch: none of the title's key words appear in the talk body, so the content likely covers a different topic than "${meta.title}".`
    );
  }
  const leftovers = findUkTerms(JSON.stringify(json));
  if (leftovers.length) blocking.push(`uk-terms: leftover UK/HSE wording (${leftovers.join(", ")}).`);

  flags.push(
    "PROVENANCE (non-blocking): source is the owner-supplied \"300 Toolbox Talks Library\" Word document, which carries no author, source or license " +
      "(attribution.license = owner-provided-unverified). Confirm rights before publishing.",
    "LOCALIZATION: UK/HSE wording converted to U.S. usage by scripts/lib/usEnglish.js; OSHA standards assigned from the topic, not present in the source."
  );

  json.audit = {
    status: blocking.length ? "needs_revision" : "approved",
    audited_at: ctx.now,
    osha_accuracy_verified: !blocking.length && ctx.verified === true,
    flags: [...blocking, ...flags],
  };
  return json;
};

const ALLOWED_HOSTS = [/(^|\.)osha\.gov$/, /(^|\.)cpwr\.com$/, /(^|\.)epa\.gov$/, /(^|\.)cdc\.gov$/, /\.gov$/];

/** True for the government / CPWR sources the pipeline is allowed to use. */
const isAllowedSource = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (/(^|\.)cdc\.gov$/.test(u.hostname)) return u.pathname.startsWith("/niosh") || u.pathname.startsWith("/nioshtic");
    return ALLOWED_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
};

/**
 * Merge per-batch `_tbt-source-matches.<batch>.json` ledgers into one map.
 * Enforces the source rules: one source per TBT, a source URL is claimed once
 * (first TBT number wins), and non-allowed domains are downgraded to no-source.
 * @param {Array<Record<string, object>>} ledgers
 * @param {Set<string>} [takenUrls] source_urls already used by processed talks
 * @returns {Record<string, object>}
 */
const mergeLedgers = (ledgers, takenUrls = new Set()) => {
  const all = {};
  for (const l of ledgers) {
    for (const [n, v] of Object.entries(l)) {
      if (all[n]) throw new Error(`TBT-${n} appears in more than one ledger`);
      all[n] = { ...v };
    }
  }
  const claimed = new Map();
  for (const n of Object.keys(all).sort()) {
    const row = all[n];
    if (row.status !== "matched") continue;
    if (!isAllowedSource(row.source_url)) {
      all[n] = { status: "no-source", note: `source not on an allowed domain (${row.source_url})` };
    } else if (takenUrls.has(row.source_url)) {
      all[n] = { status: "duplicate-of-existing", source_url: row.source_url, note: "source already used by an existing talk" };
    } else if (claimed.has(row.source_url) || (row.raw_file && claimed.has(row.raw_file))) {
      const by = claimed.get(row.source_url) || claimed.get(row.raw_file);
      all[n] = { status: "no-source", note: `source already claimed by TBT-${by}` };
    } else {
      claimed.set(row.source_url, n);
      if (row.raw_file) claimed.set(row.raw_file, n);
    }
  }
  return all;
};

module.exports = { parseRawTalk, buildTalkingPoints, titleMissingFromBody, buildTalkJson, isAllowedSource, mergeLedgers };
