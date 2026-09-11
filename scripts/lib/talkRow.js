// Pure transforms for the toolbox_talks seed loader (scripts/seed-talks.js).
// No I/O, no Supabase — kept separate so the mapping is unit-tested
// (scripts/lib/talkRow.test.js). CommonJS to match the server side.

const { v5: uuidv5 } = require("uuid");

// Fixed namespace so a talk's slug always maps to the same UUID. This is what
// makes re-running the loader idempotent: the primary key never churns.
const TALK_NAMESPACE = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

/**
 * True only when the safety-auditor has signed the file off.
 * @param {object} json - a parsed data/processed/**.json file
 */
const isApproved = (json) => json?.audit?.status === "approved";

const bullets = (heading, items) =>
  Array.isArray(items) && items.length
    ? [`## ${heading}`, ...items.map((i) => `- ${i}`), ""]
    : [];

/**
 * Render the structured pipeline fields into the single Markdown `content`
 * column. The meeting PDF (Phase 5) and any legacy reader still get a body.
 * @param {object} json
 * @returns {string}
 */
const composeMarkdown = (json) => {
  const lines = [`# ${json.title}`, ""];

  if (json.summary) lines.push(`**Summary:** ${json.summary}`, "");

  lines.push(...bullets("Talking points", json.talking_points));
  lines.push(...bullets("Hazards to check on site", json.site_hazards_to_check));
  lines.push(...bullets("Discussion questions", json.discussion_questions));

  const footer = [];
  if (Array.isArray(json.osha_standards) && json.osha_standards.length) {
    footer.push(`OSHA: ${json.osha_standards.join(" · ")}`);
  }
  if (json.estimated_minutes) footer.push(`~${json.estimated_minutes} min`);
  if (footer.length) lines.push(`_${footer.join(" · ")}_`);

  // Source credit rides inside the body too, so the Phase 5 PDF and any plain
  // reader carry the CPWR/NIOSH copyright markings + no-endorsement notice.
  const attribution = json.attribution;
  if (attribution && (attribution.copyright || attribution.notice)) {
    const credit = [attribution.copyright, attribution.notice]
      .filter(Boolean)
      .join(" ");
    lines.push("", "---", `_Source: ${credit}_`);
  }

  return `${lines.join("\n").trim()}\n`;
};

/**
 * Map one parsed pipeline file onto a toolbox_talks row.
 * @param {object} json
 * @returns {object} a row ready for supabase.upsert(..., { onConflict: "slug" })
 */
const buildRow = (json) => {
  if (typeof json.id !== "string" || !json.id.trim()) {
    throw new Error("missing `id` (slug)");
  }
  if (typeof json.title !== "string" || !json.title.trim()) {
    throw new Error("missing `title`");
  }

  return {
    id: uuidv5(json.id, TALK_NAMESPACE),
    slug: json.id,
    title: json.title,
    trade_tag: json.primary_trade ?? null,
    trade_tags: Array.isArray(json.trade_tags) ? json.trade_tags : [],
    content: composeMarkdown(json),
    structured: {
      summary: json.summary ?? null,
      talking_points: json.talking_points ?? [],
      site_hazards_to_check: json.site_hazards_to_check ?? [],
      discussion_questions: json.discussion_questions ?? [],
      osha_standards: json.osha_standards ?? [],
      estimated_minutes: json.estimated_minutes ?? null,
    },
    // Source credit for display in the app (CPWR licensing requires the
    // copyright markings be shown). Populated by the content pipeline from the
    // raw file's frontmatter; see scripts/backfill-attribution.js.
    attribution: json.attribution ?? null,
    is_global: true,
    company_id: null,
  };
};

module.exports = { TALK_NAMESPACE, isApproved, composeMarkdown, buildRow };
