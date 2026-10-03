// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const service = require("./talkGeneration");

const fromSpy = vi.spyOn(supabase, "from");
const createClientSpy = vi.spyOn(service, "createClient");

const { generateTalkDraft, getUsage, validateDraft, startOfMonthUtc } = service;

const proUser = {
  id: "user-1",
  companyId: "company-1",
  companyType: "subcontractor",
  tier: "premium",
};

const goodDraft = {
  title: "Trench Safety",
  tradeTag: "General",
  summary: "Trenches collapse without warning.",
  talkingPoints: ["Never enter an unprotected trench."],
  siteHazardsToCheck: ["Spoil pile closer than 2 feet to the edge"],
  discussionQuestions: ["Where is our nearest ladder?"],
  oshaStandards: ["29 CFR 1926.651"],
  estimatedMinutes: 5,
};

// Thenable count query + insert, keyed by table.
const mockDb = ({ used = 0, insertError = null } = {}) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    then: (resolve, reject) =>
      Promise.resolve({ count: used, error: null }).then(resolve, reject),
  };
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  fromSpy.mockReset();
  fromSpy.mockImplementation((table) => {
    if (table !== "ai_talk_generations") throw new Error(`Unexpected table: ${table}`);
    return { select: query.select, insert };
  });
  return { query, insert };
};

const textResponse = (body, stopReason = "end_turn") => ({
  stop_reason: stopReason,
  content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }],
});

const withClient = (response) => {
  const create = vi.fn().mockResolvedValue(response);
  createClientSpy.mockReturnValue({ messages: { create } });
  return create;
};

beforeEach(() => {
  createClientSpy.mockReset();
  fromSpy.mockReset();
});

describe("talkGeneration: startOfMonthUtc", () => {
  it("returns the first instant of the UTC month", () => {
    expect(startOfMonthUtc(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10-01T00:00:00.000Z");
  });

  it("defaults to the current month", () => {
    expect(startOfMonthUtc()).toMatch(/-01T00:00:00.000Z$/);
  });
});

describe("talkGeneration: getUsage", () => {
  it("returns zeros without querying for a plan with no access", async () => {
    mockDb();
    const usage = await getUsage({ companyId: "c", companyType: "subcontractor", tier: "basic" });

    expect(usage).toEqual({ used: 0, limit: 0, remaining: 0 });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("counts this month's rows against the tier limit", async () => {
    const { query } = mockDb({ used: 4 });
    const usage = await getUsage(proUser);

    expect(usage).toEqual({ used: 4, limit: 10, remaining: 6 });
    expect(query.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(query.gte).toHaveBeenCalledWith("created_at", startOfMonthUtc());
  });

  it("never reports negative remaining", async () => {
    mockDb({ used: 12 });
    expect((await getUsage(proUser)).remaining).toBe(0);
  });
});

describe("talkGeneration: validateDraft", () => {
  it("accepts and trims a good draft", () => {
    expect(validateDraft({ ...goodDraft, title: "  Trench Safety  " })).toEqual(goodDraft);
  });

  it("drops blank list entries and defaults a missing trade/summary to empty", () => {
    const draft = validateDraft({
      ...goodDraft,
      tradeTag: undefined,
      summary: undefined,
      siteHazardsToCheck: ["", "  ", "Open edge"],
    });
    expect(draft.siteHazardsToCheck).toEqual(["Open edge"]);
    expect(draft.tradeTag).toBe("");
    expect(draft.summary).toBe("");
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a missing title", { ...goodDraft, title: "  " }],
    ["a non-string title", { ...goodDraft, title: 5 }],
    ["an over-long title", { ...goodDraft, title: "x".repeat(201) }],
    ["a non-list field", { ...goodDraft, talkingPoints: "nope" }],
    ["a non-string list entry", { ...goodDraft, talkingPoints: [1] }],
    ["an over-long entry", { ...goodDraft, talkingPoints: ["x".repeat(501)] }],
    ["too many items", { ...goodDraft, talkingPoints: Array(31).fill("point") }],
    ["no talking points", { ...goodDraft, talkingPoints: [" "] }],
    ["a fractional duration", { ...goodDraft, estimatedMinutes: 2.5 }],
    ["a zero duration", { ...goodDraft, estimatedMinutes: 0 }],
    ["an over-long duration", { ...goodDraft, estimatedMinutes: 481 }],
  ])("rejects %s with a 502", (_label, raw) => {
    expect(() => validateDraft(raw)).toThrow(expect.objectContaining({ statusCode: 502 }));
  });
});

describe("talkGeneration: generateTalkDraft", () => {
  it("503s when no API key is configured", async () => {
    createClientSpy.mockReturnValue(null);

    await expect(generateTalkDraft({ user: proUser, topic: "trenching" })).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it("429s with PLAN_LIMIT data once the monthly cap is used, without calling the model", async () => {
    mockDb({ used: 10 });
    const create = withClient(textResponse(goodDraft));

    await expect(generateTalkDraft({ user: proUser, topic: "trenching" })).rejects.toMatchObject({
      statusCode: 429,
      data: { code: "PLAN_LIMIT", usage: { used: 10, limit: 10, remaining: 0 } },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the validated draft, records one usage row, and reports the new usage", async () => {
    const { insert } = mockDb({ used: 3 });
    const create = withClient(textResponse(goodDraft));

    const result = await generateTalkDraft({ user: proUser, topic: "trenching", tradeTag: "Concrete" });

    expect(result).toEqual({ draft: goodDraft, usage: { used: 4, limit: 10, remaining: 6 } });
    expect(insert).toHaveBeenCalledWith({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      company_id: "company-1",
      user_id: "user-1",
    });
    const request = create.mock.calls[0][0];
    expect(request.model).toBe("claude-sonnet-5-5");
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.messages[0].content).toBe("Topic: trenching\nTrade: Concrete");
  });

  it("omits the trade line and tolerates a missing user id", async () => {
    const { insert } = mockDb();
    const create = withClient(textResponse(goodDraft));

    await generateTalkDraft({ user: { ...proUser, id: undefined }, topic: "trenching" });

    expect(create.mock.calls[0][0].messages[0].content).toBe("Topic: trenching");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));
  });

  it("502s (keeping the cause) and records nothing when the API call fails", async () => {
    const { insert } = mockDb();
    const boom = new Error("network");
    createClientSpy.mockReturnValue({ messages: { create: vi.fn().mockRejectedValue(boom) } });

    await expect(generateTalkDraft({ user: proUser, topic: "trenching" })).rejects.toMatchObject({
      statusCode: 502,
      cause: boom,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("422s on a refusal", async () => {
    mockDb();
    withClient({ stop_reason: "refusal", content: [] });

    await expect(generateTalkDraft({ user: proUser, topic: "x" })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it.each([
    ["a truncated response", { stop_reason: "max_tokens", content: [] }],
    ["a response with no text block", { stop_reason: "end_turn", content: [{ type: "thinking" }] }],
    ["a response with no content", { stop_reason: "end_turn" }],
    ["non-JSON text", textResponse("not json")],
    ["a draft that fails validation", textResponse({ ...goodDraft, talkingPoints: [] })],
  ])("502s and records nothing for %s", async (_label, response) => {
    const { insert } = mockDb();
    withClient(response);

    await expect(generateTalkDraft({ user: proUser, topic: "trenching" })).rejects.toMatchObject({
      statusCode: 502,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("502s when the usage row can't be recorded", async () => {
    mockDb({ insertError: { message: "db down" } });
    withClient(textResponse(goodDraft));

    await expect(generateTalkDraft({ user: proUser, topic: "trenching" })).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});

describe("talkGeneration: createClient", () => {
  it("returns null without a key and a client with one", () => {
    createClientSpy.mockRestore();
    const envUtils = require("../utility/envUtils");
    const keysSpy = vi.spyOn(envUtils, "keysBasedOnEnv");

    keysSpy.mockReturnValue({});
    expect(service.createClient()).toBeNull();

    keysSpy.mockReturnValue({ anthropic: { apiKey: "sk-test" } });
    expect(service.createClient()).toEqual(expect.objectContaining({ messages: expect.anything() }));

    keysSpy.mockRestore();
    createClientSpy.mockImplementation(() => null);
  });
});
