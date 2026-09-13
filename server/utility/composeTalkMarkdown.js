// Pure transform shared by the seed pipeline (scripts/lib/talkRow.js, for
// harvested talks) and server/services/talks.js `create` (for company-scoped
// custom talks) — one place that renders structured talk fields into the
// single Markdown `content` column every toolbox_talks row needs. No I/O, no
// Supabase, no Express — CJS to match the rest of the server.

const bullets = (heading, items) =>
  Array.isArray(items) && items.length
    ? [`## ${heading}`, ...items.map((i) => `- ${i}`), ""]
    : [];

/**
 * Render structured talk fields into Markdown. The meeting PDF (Phase 5) and
 * any legacy reader still get a body.
 * @param {object} json - title, summary, talking_points,
 *   site_hazards_to_check, discussion_questions, osha_standards,
 *   estimated_minutes, attribution.
 * @returns {string}
 */
const composeTalkMarkdown = (json) => {
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
  // Custom talks never carry attribution, so this branch is a no-op for them.
  const attribution = json.attribution;
  if (attribution && (attribution.copyright || attribution.notice)) {
    const credit = [attribution.copyright, attribution.notice]
      .filter(Boolean)
      .join(" ");
    lines.push("", "---", `_Source: ${credit}_`);
  }

  return `${lines.join("\n").trim()}\n`;
};

module.exports = { composeTalkMarkdown };
