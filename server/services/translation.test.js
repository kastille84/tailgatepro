// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const envUtils = require("../utility/envUtils");
const { getSupportedLanguages, translateStructuredFields } = require("./translation");

const keysSpy = vi.spyOn(envUtils, "keysBasedOnEnv");

const withApiKey = (apiKey) =>
  keysSpy.mockReturnValue({ googleTranslate: { apiKey } });

const fetchSpy = vi.fn();

beforeEach(() => {
  keysSpy.mockReset();
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
});

describe("translation service: getSupportedLanguages", () => {
  it("returns [] when no API key is configured, without calling fetch", async () => {
    withApiKey(undefined);

    const result = await getSupportedLanguages();

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the mapped language list on success", async () => {
    withApiKey("key-123");
    fetchSpy.mockResolvedValue(
      jsonResponse({
        data: { languages: [{ language: "es", name: "Spanish" }] },
      }),
    );

    const result = await getSupportedLanguages();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("key=key-123"),
    );
    expect(result).toEqual([{ code: "es", name: "Spanish" }]);
  });

  it("returns [] when the API call fails (non-ok response)", async () => {
    withApiKey("key-123");
    fetchSpy.mockResolvedValue(jsonResponse(null, false, 500));

    const result = await getSupportedLanguages();

    expect(result).toEqual([]);
  });

  it("returns [] when fetch itself throws", async () => {
    withApiKey("key-123");
    fetchSpy.mockRejectedValue(new Error("network down"));

    const result = await getSupportedLanguages();

    expect(result).toEqual([]);
  });
});

describe("translation service: translateStructuredFields", () => {
  const fields = {
    title: "Ladder Safety",
    summary: "Keep three points of contact.",
    talking_points: ["Inspect rungs", "Face the ladder"],
    site_hazards_to_check: ["Wet rungs"],
    discussion_questions: ["Any damaged ladders on site?"],
  };

  it("returns {} without calling fetch when no API key is configured", async () => {
    withApiKey(undefined);

    const result = await translateStructuredFields(fields, ["es"]);

    expect(result).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns {} without calling fetch when targetLanguages is empty", async () => {
    withApiKey("key-123");

    const result = await translateStructuredFields(fields, []);

    expect(result).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("makes one API call per language and rebuilds the structured shape from the flattened response", async () => {
    withApiKey("key-123");
    // 6 flattened strings: title, summary, 2 talking_points, 1 hazard, 1 question
    fetchSpy.mockResolvedValue(
      jsonResponse({
        data: {
          translations: [
            { translatedText: "Seguridad de Escaleras" },
            { translatedText: "Mantenga tres puntos de contacto." },
            { translatedText: "Inspeccione los peldaños" },
            { translatedText: "Mire hacia la escalera" },
            { translatedText: "Peldaños mojados" },
            { translatedText: "¿Hay escaleras dañadas en el sitio?" },
          ],
        },
      }),
    );

    const result = await translateStructuredFields(fields, ["es"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("key=key-123");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      q: [
        "Ladder Safety",
        "Keep three points of contact.",
        "Inspect rungs",
        "Face the ladder",
        "Wet rungs",
        "Any damaged ladders on site?",
      ],
      source: "en",
      target: "es",
      format: "text",
    });

    expect(result).toEqual({
      es: {
        title: "Seguridad de Escaleras",
        summary: "Mantenga tres puntos de contacto.",
        talking_points: ["Inspeccione los peldaños", "Mire hacia la escalera"],
        site_hazards_to_check: ["Peldaños mojados"],
        discussion_questions: ["¿Hay escaleras dañadas en el sitio?"],
      },
    });
  });

  it("omits a language that fails, without throwing and without blocking other languages", async () => {
    withApiKey("key-123");
    fetchSpy.mockImplementation((url, init) => {
      const body = JSON.parse(init.body);
      if (body.target === "es") {
        return Promise.resolve(jsonResponse(null, false, 500));
      }
      return Promise.resolve(
        jsonResponse({
          data: {
            translations: [
              { translatedText: "Sécurité des échelles" },
              { translatedText: "Gardez trois points de contact." },
              { translatedText: "Inspectez les barreaux" },
              { translatedText: "Faites face à l'échelle" },
              { translatedText: "Barreaux mouillés" },
              { translatedText: "Des échelles endommagées ?" },
            ],
          },
        }),
      );
    });

    const result = await translateStructuredFields(fields, ["es", "fr"]);

    expect(result.es).toBeUndefined();
    expect(result.fr).toBeDefined();
    expect(result.fr.title).toBe("Sécurité des échelles");
  });

  it("omits a language whose response has an unexpected number of strings", async () => {
    withApiKey("key-123");
    fetchSpy.mockResolvedValue(
      jsonResponse({ data: { translations: [{ translatedText: "only one" }] } }),
    );

    const result = await translateStructuredFields(fields, ["es"]);

    expect(result).toEqual({});
  });

  it("translates a null summary as an empty string and restores it to null on the way back", async () => {
    withApiKey("key-123");
    const fieldsWithNullSummary = { ...fields, summary: null };
    fetchSpy.mockResolvedValue(
      jsonResponse({
        data: {
          translations: [
            { translatedText: "Seguridad de Escaleras" },
            { translatedText: "" },
            { translatedText: "Inspeccione los peldaños" },
            { translatedText: "Mire hacia la escalera" },
            { translatedText: "Peldaños mojados" },
            { translatedText: "¿Hay escaleras dañadas en el sitio?" },
          ],
        },
      }),
    );

    const result = await translateStructuredFields(fieldsWithNullSummary, ["es"]);

    expect(result.es.summary).toBeNull();
  });
});
