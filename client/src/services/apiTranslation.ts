import { fetchWithTimeout } from "../utils/fetchWithTimeout";

export interface TranslationLanguage {
  code: string;
  name: string;
}

/** GET /api/talks/translation-languages — every language the server's
 *  configured Google Translate project supports, for TalkForm's "Translate
 *  into" checklist. The server returns `[]` (never an error status) when
 *  translation isn't configured; a 403 means the caller's tier doesn't have
 *  translation access, surfaced as a thrown error same as any other route. */
export const getTranslationLanguages = async (
  accessToken: string,
): Promise<TranslationLanguage[]> => {
  const res = await fetchWithTimeout("/api/talks/translation-languages", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? "Could not load translation languages.");
  }

  return body.data as TranslationLanguage[];
};
