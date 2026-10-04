// Pure transforms: an original, hand-authored talk (data/authored/NNN.json,
// written from a fetched OSHA / NIOSH / EPA source) -> the standard talk JSON.
// No I/O. CommonJS. Tested in authoredBuild.test.js.

const { slugify } = require("./parseToolboxDocx");
const { findUkTerms } = require("./usEnglish");
const { isAllowedSource } = require("./tbtBuild");
const { TRADE_SLUGS } = require("./tbtCatalog");

const AGENCIES = new Set(["OSHA", "NIOSH", "EPA"]);

/** @returns {string[]} problems; empty when the authored talk is well formed. */
const validateAuthored = (a) => {
  const problems = [];
  const need = (ok, msg) => {
    if (!ok) problems.push(msg);
  };
  need(/^\d{3}$/.test(a.n || ""), "n must be a 3-digit TBT number");
  need(typeof a.title === "string" && a.title.trim() !== "", "title is required");
  need(Boolean(TRADE_SLUGS[a.primary_trade]), `primary_trade "${a.primary_trade}" is not a known trade`);
  need(Array.isArray(a.trade_tags) && a.trade_tags[0] === a.primary_trade, "trade_tags must start with primary_trade");
  need((a.trade_tags || []).every((t) => TRADE_SLUGS[t]), "every trade tag must be a known trade");
  need(Array.isArray(a.osha_standards), "osha_standards must be an array");
  need(typeof a.summary === "string" && a.summary.trim() !== "", "summary is required");
  need(Array.isArray(a.talking_points) && a.talking_points.length >= 5 && a.talking_points.length <= 8, "talking_points must have 5-8 items");
  need(Array.isArray(a.site_hazards_to_check) && a.site_hazards_to_check.length >= 4, "site_hazards_to_check needs at least 4 items");
  need(Array.isArray(a.discussion_questions) && a.discussion_questions.length >= 3, "discussion_questions needs at least 3 items");
  need(AGENCIES.has(a.source_agency), "source_agency must be OSHA, NIOSH or EPA");
  need(isAllowedSource(a.source_url || ""), `source_url is not on an allowed domain (${a.source_url})`);
  need(Array.isArray(a.source_checked) && a.source_checked.length > 0 && a.source_checked.every(isAllowedSource), "source_checked must list allowed-domain URLs actually read");
  need(typeof a.basis === "string" && a.basis.trim() !== "", "basis (what the talk was written from) is required");
  if (a.audit?.status === "approved") need(a.audit.osha_accuracy_verified === true, "an approved talk must have osha_accuracy_verified: true");

  // "torch" is a UK word for flashlight, but it is the correct U.S. term for a brazing/welding torch.
  const leftovers = findUkTerms(JSON.stringify([a.title, a.summary, a.talking_points, a.site_hazards_to_check, a.discussion_questions])).filter((t) => !/^torch$/i.test(t));
  need(leftovers.length === 0, `leftover UK/HSE wording (${leftovers.join(", ")})`);
  return problems;
};

/**
 * @param {object} a - authored talk (see validateAuthored)
 * @param {{ now: string }} ctx
 * @returns {object} talk JSON in schema order
 */
const buildAuthoredJson = (a, ctx) => {
  const problems = validateAuthored(a);
  if (problems.length) throw new Error(`TBT-${a.n} ${a.title}: ${problems.join("; ")}`);

  return {
    id: slugify(a.title),
    title: a.title,
    primary_trade: a.primary_trade,
    trade_tags: a.trade_tags,
    osha_standards: a.osha_standards,
    estimated_minutes: 5,
    summary: a.summary,
    talking_points: a.talking_points,
    site_hazards_to_check: a.site_hazards_to_check,
    discussion_questions: a.discussion_questions,
    attribution: {
      source: "TailgatePro",
      publisher: "TailgatePro",
      copyright: `Original TailgatePro content, written from ${a.basis}. Regulation and agency text is U.S. Government work in the public domain; the wording here is TailgatePro's own.`,
      license: "original-work",
      source_url: a.source_url,
      source_ref: `TBT-${a.n}`,
      notice: `Written from ${a.basis}. General guidance only; follow your company safety program and site-specific requirements. Not an endorsement by ${a.source_agency}.`,
    },
    audit: a.audit || {
      status: "needs_revision",
      audited_at: ctx.now,
      osha_accuracy_verified: false,
      flags: ["AUDIT PENDING: original talk written from the sources listed in source_checked; awaiting safety-auditor review."],
    },
  };
};

module.exports = { validateAuthored, buildAuthoredJson };
