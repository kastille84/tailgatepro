import type { Talk } from "../interfaces/talk";

const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 2;
const BODY_WEIGHT = 1;

const includesToken = (text: string, token: string) =>
  text.toLowerCase().includes(token);

const anyIncludes = (texts: string[], token: string) =>
  texts.some((text) => includesToken(text, token));

/** Relevance of one query token to a talk: the highest-weight field that
 *  contains it (title > trade tags / OSHA standards > hazards / summary), or 0
 *  when no searched field matches. */
const scoreToken = (talk: Talk, token: string) => {
  if (includesToken(talk.title, token)) return TITLE_WEIGHT;
  const structured = talk.structured;
  if (
    anyIncludes(talk.tradeTags ?? [], token) ||
    anyIncludes(structured?.osha_standards ?? [], token)
  ) {
    return TAG_WEIGHT;
  }
  if (
    anyIncludes(structured?.site_hazards_to_check ?? [], token) ||
    includesToken(structured?.summary ?? "", token)
  ) {
    return BODY_WEIGHT;
  }
  return 0;
};

/** Keyword search over the talk library. Every whitespace-separated word must
 *  match somewhere (AND); talks are ordered by summed field weight, and ties
 *  keep their original order. A blank query returns the talks unchanged. */
export const searchTalks = (talks: Talk[], query: string): Talk[] => {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return talks;

  const scored: { talk: Talk; score: number; index: number }[] = [];
  talks.forEach((talk, index) => {
    let score = 0;
    for (const token of tokens) {
      const tokenScore = scoreToken(talk, token);
      if (tokenScore === 0) return;
      score += tokenScore;
    }
    scored.push({ talk, score, index });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.talk);
};
