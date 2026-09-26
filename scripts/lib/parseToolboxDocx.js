// Pure-ish helpers for importing the 300-talk Word library
// (data/300_Toolbox_Talks_Library.docx) into data/raw/. CommonJS to match the
// rest of scripts/ and the server. The only I/O is reading the docx bytes in
// `readDocxText`; everything else is a pure transform so it can be unit tested
// (scripts/lib/parseToolboxDocx.test.js).

const crypto = require("crypto");
const zlib = require("zlib");

// ---------------------------------------------------------------------------
// docx -> text
// ---------------------------------------------------------------------------

/**
 * Read one entry out of a zip buffer using only Node built-ins (a .docx is a
 * zip). Walks the central directory so it works for entries written with a
 * data descriptor.
 * @param {Buffer} buf
 * @param {string} name - e.g. "word/document.xml"
 * @returns {Buffer}
 */
const readZipEntry = (buf, name) => {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (end of central directory missing)");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const entryName = buf.toString("utf8", p + 46, p + 46 + nameLen);

    if (entryName === name) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`unsupported zip compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`entry not found in zip: ${name}`);
};

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decodeEntities = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return XML_ENTITIES[e.toLowerCase()];
  });

/**
 * Flatten WordprocessingML to plain text, one paragraph per line.
 * @param {string} xml - contents of word/document.xml
 * @returns {string}
 */
const xmlToText = (xml) =>
  decodeEntities(
    xml
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
  );

/**
 * @param {Buffer} docxBuffer
 * @returns {string} plain text of the document body
 */
const readDocxText = (docxBuffer) =>
  xmlToText(readZipEntry(docxBuffer, "word/document.xml").toString("utf8"));

// ---------------------------------------------------------------------------
// text -> talks
// ---------------------------------------------------------------------------

const HEADING = /^TBT-(\d{3})\s+(.+?)\s*$/;

// Section header line (exact text) -> field name on the parsed talk.
const SECTION_HEADERS = {
  "KEY HAZARDS": "keyHazards",
  "REQUIRED CONTROLS": "requiredControls",
  "EMPLOYEES MUST": "employeesMust",
  "EMPLOYEES MUST NOT": "employeesMustNot",
  "GOOD PRACTICE": "goodPractice",
  "EMERGENCY / INCIDENT RESPONSE": "emergencyResponse",
  "Supervisor Discussion": "supervisorDiscussion",
};

const BODY_FIELDS = [
  "whyItMatters",
  "keyHazards",
  "requiredControls",
  "employeesMust",
  "employeesMustNot",
  "goodPractice",
  "emergencyResponse",
];

const stripBullet = (line) => line.replace(/^[••\-\*]\s*/, "").trim();

/**
 * Split document text into talks. A talk page starts at a `TBT-nnn  Title`
 * line whose next non-empty line begins `Category:` — that skips the
 * table-of-contents entries, which have the same heading shape.
 * @param {string} text
 * @returns {Array<object>}
 */
const parseTalks = (text) => {
  const lines = text.split("\n").map((l) => l.replace(/\r/g, "").trim());
  const talks = [];
  let current = null;
  let field = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = HEADING.exec(line);
    if (heading) {
      let j = i + 1;
      while (j < lines.length && lines[j] === "") j++;
      if (j < lines.length && lines[j].startsWith("Category:")) {
        current = {
          number: heading[1],
          title: heading[2],
          category: "",
          duration: "",
          whyItMatters: "",
          keyHazards: [],
          requiredControls: [],
          employeesMust: [],
          employeesMustNot: [],
          goodPractice: [],
          emergencyResponse: [],
          supervisorDiscussion: [],
        };
        talks.push(current);
        field = null;
        continue;
      }
    }
    if (!current || line === "") continue;

    if (line.startsWith("Category:")) {
      const m = /^Category:\s*(.*?)\s{2,}Duration:\s*(.*)$/.exec(line);
      current.category = m ? m[1] : line.replace(/^Category:\s*/, "");
      current.duration = m ? m[2] : "";
      field = null;
    } else if (line.startsWith("Why It Matters:")) {
      current.whyItMatters = line.replace(/^Why It Matters:\s*/, "");
      field = null;
    } else if (SECTION_HEADERS[line]) {
      field = SECTION_HEADERS[line];
    } else if (line === "Presenter" || line.startsWith("Document control:")) {
      field = null; // sign-off table / footer follow; ignore them
    } else if (field) {
      current[field].push(stripBullet(line));
    }
  }
  return talks;
};

// ---------------------------------------------------------------------------
// hashing, slugs, raw markdown
// ---------------------------------------------------------------------------

/**
 * Hash of a talk's substantive body with its own title masked out. Two talks
 * with the same hash are boilerplate copies of each other (only the title
 * differs) — the auditor treats those as "generic-body".
 */
const bodyHash = (talk) => {
  const body = BODY_FIELDS.map((f) =>
    Array.isArray(talk[f]) ? talk[f].join("\n") : talk[f]
  )
    .join("\n--\n")
    .split(talk.title)
    .join("{T}");
  return crypto.createHash("md5").update(body).digest("hex");
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const rawFileName = (talk) => `tbt-${talk.number}-${slugify(talk.title)}.md`;

const list = (items) => items.map((i) => `- ${i}`).join("\n");

/**
 * Lossless raw Markdown for one talk (frontmatter mirrors the collector's raw
 * files: source_url / agency / scraped_date, plus TBT-specific keys).
 */
const toRawMarkdown = (talk, { sourcePath, scrapedDate, hash }) =>
  [
    "---",
    `source_url: ${sourcePath}`,
    "agency: Owner-Provided",
    `scraped_date: ${scrapedDate}`,
    `tbt_number: TBT-${talk.number}`,
    `title: ${JSON.stringify(talk.title)}`,
    `category: ${JSON.stringify(talk.category)}`,
    `duration: ${JSON.stringify(talk.duration)}`,
    `body_hash: ${hash}`,
    "---",
    "",
    `# TBT-${talk.number} ${talk.title}`,
    "",
    `## Why It Matters\n${talk.whyItMatters}`,
    "",
    `## KEY HAZARDS\n${list(talk.keyHazards)}`,
    "",
    `## REQUIRED CONTROLS\n${list(talk.requiredControls)}`,
    "",
    `## EMPLOYEES MUST\n${list(talk.employeesMust)}`,
    "",
    `## EMPLOYEES MUST NOT\n${list(talk.employeesMustNot)}`,
    "",
    `## GOOD PRACTICE\n${list(talk.goodPractice)}`,
    "",
    `## EMERGENCY / INCIDENT RESPONSE\n${list(talk.emergencyResponse)}`,
    "",
    `## Supervisor Discussion\n${list(talk.supervisorDiscussion)}`,
    "",
  ].join("\n");

// ---------------------------------------------------------------------------
// duplicate candidates
// ---------------------------------------------------------------------------

// Topic groups matched against a title (lower-cased). Two talks that hit the
// same group are *candidates* for duplication; the importer agent makes the
// final call. Kept broad on purpose — a false candidate costs a glance, a
// missed one ships a duplicate.
const TOPIC_GROUPS = {
  ladder: /\bladders?\b/,
  silica: /\bsilica\b/,
  "confined-space": /confined space|oxygen deficiency|poorly ventilated|gas testing/,
  heat: /heat stress|heat illness|hot environment|dehydration|sun protection|extreme weather/,
  cold: /cold stress|cold environment|winter/,
  housekeeping: /housekeeping/,
  "lockout-isolation": /lockout|tagout|isolation|stored energy/,
  "eye-protection": /\beye\b/,
  respiratory: /respirat/,
  "electrical-cords-equipment": /portable electrical|extension cord|electrical (equipment|inspection|defect)/,
  "electrical-live": /live electrical|electrical (isolation|safety)|wiring/,
  "power-lines": /overhead|power lines?/,
  forklift: /forklift|reach truck/,
  scaffold: /scaffold|mobile tower/,
  "fall-protection": /working at height|fall arrest|edge protection|fragile|harness|guardrail|roof(s| access| edge)|slip, trip and fall|falls?\b/,
  "falling-objects": /dropped objects|falling objects?|tools at height/,
  "hot-work-welding": /hot work|welding|brazing|fume extraction|fire watch/,
  crane: /crane|slinger|banksman|lifting/,
  excavation: /excavation|underground services|trench|buried/,
  biohazard: /biological|sharps|biohazard|sewage|needlestick/,
  "carbon-monoxide": /carbon monoxide/,
  "repetitive-motion": /hand-arm vibration|repetitive|whole-body vibration/,
  "nail-gun": /nail gun/,
  "power-saw-tools": /power (tools?|saws?)|hand tools/,
  "wet-concrete": /wet concrete|cement/,
  drywall: /drywall/,
  "aerial-lift": /mewp|aerial|mobile access/,
  "equipment-on-off": /getting on and off/,
  "skid-steer": /skid steer/,
};

const groupsFor = (text) =>
  Object.keys(TOPIC_GROUPS).filter((g) => TOPIC_GROUPS[g].test(text.toLowerCase()));

/**
 * @param {Array<object>} talks - output of parseTalks
 * @param {Array<{id:string,title:string}>} existing - already-processed talks
 * @returns {{ vsExisting: object[], withinImport: object[], identicalBodies: object[] }}
 */
const findDuplicateCandidates = (talks, existing) => {
  const existingGroups = existing.map((e) => ({
    ...e,
    groups: groupsFor(`${e.title} ${e.id.replace(/-/g, " ")}`),
  }));

  const vsExisting = [];
  const byGroup = {};
  const byHash = {};

  for (const t of talks) {
    const groups = groupsFor(t.title);
    const matches = existingGroups
      .map((e) => ({
        id: e.id,
        title: e.title,
        sharedGroups: e.groups.filter((g) => groups.includes(g)),
      }))
      .filter((m) => m.sharedGroups.length > 0);
    if (matches.length) {
      vsExisting.push({ tbt: `TBT-${t.number}`, title: t.title, matches });
    }
    for (const g of groups) (byGroup[g] ||= []).push(`TBT-${t.number} ${t.title}`);
    (byHash[bodyHash(t)] ||= []).push(`TBT-${t.number}`);
  }

  return {
    vsExisting,
    withinImport: Object.entries(byGroup)
      .filter(([, v]) => v.length > 1)
      .map(([group, members]) => ({ group, members })),
    identicalBodies: Object.entries(byHash)
      .filter(([, v]) => v.length > 1)
      .map(([hash, members]) => ({ hash, members })),
  };
};

module.exports = {
  readZipEntry,
  xmlToText,
  readDocxText,
  parseTalks,
  bodyHash,
  slugify,
  rawFileName,
  toRawMarkdown,
  groupsFor,
  findDuplicateCandidates,
};
