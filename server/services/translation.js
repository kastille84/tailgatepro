// Wraps the Google Cloud Translation API (v2, REST + API key -- no service
// account/OAuth flow, kept lightweight to match this repo's other external
// service clients). Used only for custom (company-authored) talks -- the
// global library only ever carries official agency-published translations,
// never machine translation (see .claude/agents/talks/safety-structurer.md).
// Not destructured -- `keysBasedOnEnv` is looked up fresh at call time (like
// `talks.js` does with `supabase.from`) so it stays spy-able in tests.
const envUtils = require("../utility/envUtils");

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";
const LANGUAGES_URL =
  "https://translation.googleapis.com/language/translate/v2/languages";

const apiKey = () => envUtils.keysBasedOnEnv().googleTranslate?.apiKey;

// The structured fields that get translated, and the order they're flattened
// into one array for a single API call -- talking_points/site_hazards_to_check/
// discussion_questions are variable-length lists, so each entry also records
// how many strings it contributed, to rebuild the arrays afterward.
const FIELD_ORDER = [
  "title",
  "summary",
  "talking_points",
  "site_hazards_to_check",
  "discussion_questions",
];

const flattenFields = (fields) => {
  const flat = [];
  const spans = {};
  for (const field of FIELD_ORDER) {
    const value = fields[field];
    const start = flat.length;
    if (Array.isArray(value)) {
      flat.push(...value);
      spans[field] = { start, length: value.length, isList: true };
    } else {
      // `summary` may be null -- translate an empty string rather than
      // sending `null` to the API, then restore null on the way back out.
      flat.push(value ?? "");
      spans[field] = { start, length: 1, isList: false };
    }
  }
  return { flat, spans };
};

const unflattenFields = (translatedStrings, spans, originalFields) => {
  const result = {};
  for (const field of FIELD_ORDER) {
    const { start, length, isList } = spans[field];
    const slice = translatedStrings.slice(start, start + length);
    if (isList) {
      result[field] = slice;
    } else {
      result[field] = originalFields[field] == null ? null : (slice[0] ?? "");
    }
  }
  return result;
};

// Returns every language the configured Google Translate project supports,
// as `[{ code, name }]`. Returns `[]` (never throws) when no API key is
// configured or the call fails -- translation is simply unavailable rather
// than a hard error, since it's an optional enhancement everywhere it's used.
const getSupportedLanguages = async () => {
  const key = apiKey();
  if (!key) return [];

  try {
    const res = await fetch(
      `${LANGUAGES_URL}?key=${encodeURIComponent(key)}&target=en`,
    );
    if (!res.ok) return [];
    const body = await res.json();
    const languages = body?.data?.languages ?? [];
    return languages.map((lang) => ({ code: lang.language, name: lang.name }));
  } catch {
    return [];
  }
};

// Translates one language's worth of text via a single API call (the `q`
// param accepts an array, so every field/list-item is batched together
// rather than one call per string).
const translateOneLanguage = async ({ flat, spans }, fields, targetLanguage, key) => {
  const res = await fetch(`${TRANSLATE_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: flat, source: "en", target: targetLanguage, format: "text" }),
  });

  if (!res.ok) throw new Error(`Translation API returned ${res.status}`);

  const body = await res.json();
  const translatedStrings = (body?.data?.translations ?? []).map(
    (t) => t.translatedText,
  );
  if (translatedStrings.length !== flat.length) {
    throw new Error("Translation API returned an unexpected number of strings");
  }

  return unflattenFields(translatedStrings, spans, fields);
};

/**
 * Translates `fields` (a talk's title + structured prose fields) into every
 * language in `targetLanguages`. One API call per language. A single
 * language's failure (network error, unsupported target, timeout) is caught
 * and that language is simply omitted from the result -- never throws, and
 * never blocks the caller from saving the talk itself with whatever
 * succeeded. Returns `{}` if no API key is configured or `targetLanguages`
 * is empty.
 *
 * @param {{ title: string, summary: string|null, talking_points: string[],
 *   site_hazards_to_check: string[], discussion_questions: string[] }} fields
 * @param {string[]} targetLanguages
 * @returns {Promise<Record<string, object>>}
 */
const translateStructuredFields = async (fields, targetLanguages) => {
  const key = apiKey();
  if (!key || !targetLanguages?.length) return {};

  const flattened = flattenFields(fields);
  const result = {};

  await Promise.all(
    targetLanguages.map(async (lang) => {
      try {
        result[lang] = await translateOneLanguage(flattened, fields, lang, key);
      } catch {
        // Omit this language; other languages and the talk save proceed.
      }
    }),
  );

  return result;
};

module.exports = { getSupportedLanguages, translateStructuredFields };
