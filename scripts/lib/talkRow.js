// Pure transforms for the toolbox_talks seed loader (scripts/seed-talks.js).
// No I/O, no Supabase — kept separate so the mapping is unit-tested
// (scripts/lib/talkRow.test.js). CommonJS to match the server side.

const { v5: uuidv5 } = require("uuid");
const { composeTalkMarkdown } = require("../../server/utility/composeTalkMarkdown");

// Fixed namespace so a talk's slug always maps to the same UUID. This is what
// makes re-running the loader idempotent: the primary key never churns.
const TALK_NAMESPACE = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

/**
 * True only when the safety-auditor has signed the file off.
 * @param {object} json - a parsed data/processed/**.json file
 */
const isApproved = (json) => json?.audit?.status === "approved";

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
    content: composeTalkMarkdown(json),
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

// Re-exported under its old name so nothing that already requires
// `composeMarkdown` from this module breaks; the canonical implementation +
// tests now live in server/utility/composeTalkMarkdown.js.
module.exports = {
  TALK_NAMESPACE,
  isApproved,
  composeMarkdown: composeTalkMarkdown,
  buildRow,
};
