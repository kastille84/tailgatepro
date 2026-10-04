import { fetchWithTimeout } from "../utils/fetchWithTimeout";

/** A talk draft from the AI Talk Builder — same field names as
 *  `CreateTalkInput` (`apiTalks.ts`), minus `id`/`targetLanguages`, so it can
 *  pre-fill `TalkForm` directly. Never saved server-side. */
export interface TalkDraft {
  title: string;
  tradeTag: string;
  summary: string;
  talkingPoints: string[];
  siteHazardsToCheck: string[];
  discussionQuestions: string[];
  oshaStandards: string[];
  estimatedMinutes: number;
}

/** This month's draft allowance (`server/services/talkGeneration.js`). */
export interface AiTalkUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface GenerateTalkResult {
  draft: TalkDraft;
  usage: AiTalkUsage;
}

export interface GenerateTalkInput {
  topic: string;
  tradeTag?: string;
}

// The generation call can take ~10-30s, well past `fetchWithTimeout`'s default.
const GENERATE_TIMEOUT_MS = 60_000;

/** POST /api/talks/generate — drafts a talk from a topic. A 403 means the
 *  plan has no AI allowance, a 429 that this month's cap is used up; both
 *  carry a user-readable `error` that is surfaced as the thrown message. */
export const generateTalkDraft = async (
  accessToken: string,
  input: GenerateTalkInput,
): Promise<GenerateTalkResult> => {
  const res = await fetchWithTimeout(
    "/api/talks/generate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
    },
    GENERATE_TIMEOUT_MS,
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? "Could not draft a talk. Please try again.");
  }

  return body.data as GenerateTalkResult;
};

/** GET /api/talks/ai-usage — this month's draft allowance. */
export const getAiTalkUsage = async (
  accessToken: string,
): Promise<AiTalkUsage> => {
  const res = await fetchWithTimeout("/api/talks/ai-usage", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? "Could not load your AI draft allowance.");
  }

  return body.data as AiTalkUsage;
};
