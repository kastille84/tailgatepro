/** A toolbox safety talk from the Content Library. Mirrors the server's
 *  `toTalk` output (server/services/talks.js) — the `structured` and
 *  `attribution` JSONB payloads keep the field names the content pipeline
 *  wrote them with (data/processed/**, see .claude/agents/talks/), so those
 *  two are NOT camelCased like the top-level columns are. */

export interface TalkStructured {
  summary: string | null;
  talking_points: string[];
  site_hazards_to_check: string[];
  discussion_questions: string[];
  osha_standards: string[];
  estimated_minutes: number | null;
}

/** Source credit for the talk's content. Every talk in the library carries
 *  one — CPWR-derived talks need it displayed as a licensing condition, see
 *  docs/content-attribution.md. `TalkDetail` must render `copyright` +
 *  `notice` wherever a talk's body is shown. */
export interface TalkAttribution {
  source: string;
  publisher: string;
  copyright: string;
  license: string;
  source_url: string | null;
  notice: string;
}

/** One question of a talk's comprehension quiz. `correctIndex` is a 0-based
 *  index into `choices`. See docs/meeting-flow-design.md — `quiz_score`/
 *  `quiz_answers` are recorded per-signature (one crew member's answers),
 *  not per-meeting. */
export interface TalkQuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
}

export interface Talk {
  id: string;
  slug: string;
  title: string;
  /** Primary trade, e.g. "Roofing", "Electrical". */
  tradeTag: string | null;
  /** Every applicable trade (primary + secondary) — used for trade filtering. */
  tradeTags: string[];
  /** Composed Markdown body (Phase 5 PDF / any plain reader). */
  content: string;
  structured: TalkStructured | null;
  attribution: TalkAttribution | null;
  /** `toolbox_talks.quiz` — exactly 3 questions when present, null for talks
   *  not yet authored with a quiz (see docs/meeting-flow-design.md). Mirrors
   *  the server's `toTalk` output. */
  quiz: TalkQuizQuestion[] | null;
  isGlobal: boolean;
  companyId: string | null;
  createdAt: string;
}
