// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// `supabase.from` is looked up fresh at call time (not destructured), so a
// single module-scope spy reconfigured per test is enough — no re-spying.
const { supabase } = require("../utility/supabaseClient");
const { listGlobal, getById } = require("./talks");

const TALK_COLUMNS =
  "id, slug, title, trade_tag, trade_tags, content, structured, attribution, is_global, company_id, created_at";

const dbRow = {
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  trade_tag: "General Construction",
  trade_tags: ["General Construction", "Welding"],
  content: "# Eye Protection on the Jobsite\n",
  structured: { summary: "...", talking_points: [] },
  attribution: { source: "NIOSH" },
  is_global: true,
  company_id: null,
  created_at: "2026-09-09T00:00:00.000Z",
};

const mappedTalk = {
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction", "Welding"],
  content: "# Eye Protection on the Jobsite\n",
  structured: { summary: "...", talking_points: [] },
  attribution: { source: "NIOSH" },
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");

describe("talks service: listGlobal", () => {
  let order;
  let eq;
  let select;

  beforeEach(() => {
    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    eq = vi.fn(() => ({ order }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should query the global library alphabetically and map rows to camelCase", async () => {
    // Act
    const result = await listGlobal();

    // Assert
    expect(select).toHaveBeenCalledWith(TALK_COLUMNS);
    expect(eq).toHaveBeenCalledWith("is_global", true);
    expect(order).toHaveBeenCalledWith("title", { ascending: true });
    expect(result).toEqual([mappedTalk]);
  });

  it("should default missing structured/attribution/trade_tags to []/null", async () => {
    // Arrange
    order.mockResolvedValue({
      data: [{ ...dbRow, structured: null, attribution: null, trade_tags: null }],
      error: null,
    });

    // Act
    const [result] = await listGlobal();

    // Assert
    expect(result.structured).toBeNull();
    expect(result.attribution).toBeNull();
    expect(result.tradeTags).toEqual([]);
  });

  it("should throw a 502 AppError when the query fails", async () => {
    // Arrange
    order.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(listGlobal()).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load toolbox talks",
    });
  });
});

describe("talks service: getById", () => {
  let single;
  let eq;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    eq = vi.fn(() => ({ single }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should fetch one talk by id and map it to camelCase", async () => {
    // Act
    const result = await getById("talk-1");

    // Assert
    expect(select).toHaveBeenCalledWith(TALK_COLUMNS);
    expect(eq).toHaveBeenCalledWith("id", "talk-1");
    expect(result).toEqual(mappedTalk);
  });

  it("should throw a 404 AppError when no row matches the id", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    // Act & Assert
    await expect(getById("missing")).rejects.toMatchObject({
      statusCode: 404,
      message: "Talk not found",
    });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "unexpected" },
    });

    // Act & Assert
    await expect(getById("talk-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the talk",
    });
  });
});
