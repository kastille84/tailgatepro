import { describe, expect, it } from "vitest";

import {
  getLocalizedTalkContent,
  getTalkLanguageOptions,
} from "../../src/utils/talkLocalization";
import type { Talk } from "../../src/interfaces/talk";

const baseTalk: Talk = {
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction"],
  content: "# Eye Protection\n",
  structured: {
    summary: "Wear eye protection at all times.",
    talking_points: ["Point one", "Point two"],
    site_hazards_to_check: ["Flying debris"],
    discussion_questions: ["Do you have safety glasses?"],
    osha_standards: ["29 CFR 1926.102"],
    estimated_minutes: 5,
  },
  attribution: null,
  quiz: null,
  translations: null,
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("getTalkLanguageOptions", () => {
  it("returns only English when the talk has no translations", () => {
    expect(getTalkLanguageOptions(baseTalk)).toEqual([
      { code: "en", label: "English" },
    ]);
  });

  it("returns English plus one entry per translation key, with a human-readable label", () => {
    const talk: Talk = {
      ...baseTalk,
      translations: {
        es: {
          title: "Protección Ocular",
          summary: null,
          talking_points: [],
          site_hazards_to_check: [],
          discussion_questions: [],
        },
      },
    };

    const options = getTalkLanguageOptions(talk);
    expect(options[0]).toEqual({ code: "en", label: "English" });
    expect(options[1].code).toBe("es");
    expect(options[1].label.length).toBeGreaterThan(0);
    expect(options[1].label).not.toBe("es");
  });

  it("falls back to the raw code when Intl.DisplayNames itself can't be constructed", () => {
    const spy = vi
      .spyOn(Intl, "DisplayNames")
      .mockImplementation(() => {
        throw new Error("unsupported");
      });

    const talk: Talk = {
      ...baseTalk,
      translations: {
        es: {
          title: "x",
          summary: null,
          talking_points: [],
          site_hazards_to_check: [],
          discussion_questions: [],
        },
      },
    };

    expect(getTalkLanguageOptions(talk)).toEqual([
      { code: "en", label: "English" },
      { code: "es", label: "es" },
    ]);

    spy.mockRestore();
  });

  it("falls back to the raw code when Intl.DisplayNames.of() throws for a given code", () => {
    const spy = vi
      .spyOn(Intl, "DisplayNames")
      .mockImplementation(
        () =>
          ({
            of: () => {
              throw new Error("invalid code");
            },
          }) as unknown as Intl.DisplayNames,
      );

    const talk: Talk = {
      ...baseTalk,
      translations: {
        es: {
          title: "x",
          summary: null,
          talking_points: [],
          site_hazards_to_check: [],
          discussion_questions: [],
        },
      },
    };

    expect(getTalkLanguageOptions(talk)).toEqual([
      { code: "en", label: "English" },
      { code: "es", label: "es" },
    ]);

    spy.mockRestore();
  });
});

describe("getLocalizedTalkContent", () => {
  it("returns the talk's own fields for English", () => {
    const localized = getLocalizedTalkContent(baseTalk, "en");
    expect(localized).toEqual({
      title: "Eye Protection on the Jobsite",
      summary: "Wear eye protection at all times.",
      talking_points: ["Point one", "Point two"],
      site_hazards_to_check: ["Flying debris"],
      discussion_questions: ["Do you have safety glasses?"],
    });
  });

  it("returns the matching translation when one exists", () => {
    const talk: Talk = {
      ...baseTalk,
      translations: {
        es: {
          title: "Protección Ocular",
          summary: "Use protección ocular en todo momento.",
          talking_points: ["Punto uno"],
          site_hazards_to_check: ["Escombros voladores"],
          discussion_questions: ["¿Tiene gafas de seguridad?"],
        },
      },
    };

    expect(getLocalizedTalkContent(talk, "es")).toEqual(
      talk.translations!.es,
    );
  });

  it("falls back to English as a whole object when the requested language has no translation", () => {
    const localized = getLocalizedTalkContent(baseTalk, "fr");
    expect(localized.title).toBe("Eye Protection on the Jobsite");
    expect(localized.talking_points).toEqual(["Point one", "Point two"]);
  });

  it("falls back to empty/null defaults when the talk has no structured data", () => {
    const talk: Talk = { ...baseTalk, structured: null };
    expect(getLocalizedTalkContent(talk, "en")).toEqual({
      title: "Eye Protection on the Jobsite",
      summary: null,
      talking_points: [],
      site_hazards_to_check: [],
      discussion_questions: [],
    });
  });
});
