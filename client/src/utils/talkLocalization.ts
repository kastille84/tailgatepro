import type { Talk, TalkTranslation } from "../interfaces/talk";

export interface TalkLanguageOption {
  code: string;
  label: string;
}

/** English is always first, then one entry per key in `talk.translations` --
 *  labeled via `Intl.DisplayNames` (built into the browser, no dependency
 *  needed). Falls back to the raw code if the runtime can't resolve a
 *  display name for it. */
export const getTalkLanguageOptions = (talk: Talk): TalkLanguageOption[] => {
  const codes = Object.keys(talk.translations ?? {});
  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames([navigator.language], {
      type: "language",
    });
  } catch {
    displayNames = null;
  }

  const label = (code: string) => {
    try {
      return displayNames?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  return [
    { code: "en", label: "English" },
    ...codes.map((code) => ({ code, label: label(code) })),
  ];
};

/** The talk's own top-level/`structured` fields for `"en"` or a missing
 *  translation; otherwise the whole `TalkTranslation` object. Whole-object
 *  fallback (never per-field) so a talk never renders a mid-sentence
 *  language mix. */
export const getLocalizedTalkContent = (
  talk: Talk,
  languageCode: string,
): TalkTranslation => {
  const translation = talk.translations?.[languageCode];
  if (languageCode !== "en" && translation) return translation;

  return {
    title: talk.title,
    summary: talk.structured?.summary ?? null,
    talking_points: talk.structured?.talking_points ?? [],
    site_hazards_to_check: talk.structured?.site_hazards_to_check ?? [],
    discussion_questions: talk.structured?.discussion_questions ?? [],
  };
};
