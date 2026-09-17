import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { useCurrentUser } from "./useCurrentUser";
import { useOnlineStatus } from "../context/online-status";
import {
  getTranslationLanguages,
  type TranslationLanguage,
} from "../services/apiTranslation";

// The most commonly needed languages on US jobsites, pinned to the top of
// TalkForm's checklist so foremen don't have to scroll ~150 languages to find
// them. Matched by prefix (not exact code) since Google's Translation API
// returns Chinese as separate `zh-CN`/`zh-TW` entries rather than a bare
// `zh` — a prefix match pins whichever variant(s) the API actually supports
// without hardcoding a specific one.
const POPULAR_LANGUAGE_MATCHERS: Array<(code: string) => boolean> = [
  (code) => code === "es",
  (code) => code.toLowerCase().startsWith("zh"),
  (code) => code === "vi",
  (code) => code === "ko",
  (code) => code === "pt",
];

const withPopularLanguagesFirst = (languages: TranslationLanguage[]) => {
  let remaining = languages;
  const pinned = POPULAR_LANGUAGE_MATCHERS.flatMap((matches) => {
    const matched = remaining.filter((lang) => matches(lang.code));
    remaining = remaining.filter((lang) => !matches(lang.code));
    return matched;
  });
  return [...pinned, ...remaining];
};

/**
 * The languages TalkForm's "Translate into" checklist can offer, gated on
 * both connectivity (translation needs a live call to Google Translate —
 * there's no offline path) and the caller's tier. `isAvailable` is what
 * TalkForm actually branches its three-way UI (no access / offline /
 * available) on; `languages` stays `[]` whenever the query didn't run.
 *
 * Spanish, Chinese, Vietnamese, Korean, and Portuguese (whichever of these
 * the API actually returns) are pinned to the front of `languages`; every
 * other language keeps the order the API returned it in.
 */
export const useTranslationLanguages = () => {
  const { session } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { hasTranslationAccess } = useCurrentUser();

  const query = useQuery({
    queryKey: ["translationLanguages"],
    queryFn: () => getTranslationLanguages(session!.access_token),
    enabled: !!session && isOnline && hasTranslationAccess,
  });

  const languages = useMemo(
    () => withPopularLanguagesFirst(query.data ?? []),
    [query.data],
  );

  return {
    languages,
    isAvailable: isOnline && hasTranslationAccess && languages.length > 0,
  };
};
