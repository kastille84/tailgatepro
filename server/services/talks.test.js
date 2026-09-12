// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// `supabase.from` is looked up fresh at call time (not destructured), so a
// single module-scope spy reconfigured per test is enough — no re-spying.
const { supabase } = require("../utility/supabaseClient");
const { listForCompany, getById, create } = require("./talks");

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

describe("talks service: listForCompany", () => {
  let order;
  let or;
  let select;

  beforeEach(() => {
    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    or = vi.fn(() => ({ order }));
    select = vi.fn(() => ({ or }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should query the global library + the caller's own custom talks, alphabetically, and map rows to camelCase", async () => {
    // Act
    const result = await listForCompany("company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(TALK_COLUMNS);
    expect(or).toHaveBeenCalledWith("is_global.eq.true,company_id.eq.company-1");
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
    const [result] = await listForCompany("company-1");

    // Assert
    expect(result.structured).toBeNull();
    expect(result.attribution).toBeNull();
    expect(result.tradeTags).toEqual([]);
  });

  it("should throw a 502 AppError when the query fails", async () => {
    // Arrange
    order.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(listForCompany("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load toolbox talks",
    });
  });
});

describe("talks service: getById", () => {
  let single;
  let or;
  let eq;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    or = vi.fn(() => ({ single }));
    eq = vi.fn(() => ({ or }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should fetch one talk by id (scoped to global + the caller's company) and map it to camelCase", async () => {
    // Act
    const result = await getById("talk-1", "company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(TALK_COLUMNS);
    expect(eq).toHaveBeenCalledWith("id", "talk-1");
    expect(or).toHaveBeenCalledWith("is_global.eq.true,company_id.eq.company-1");
    expect(result).toEqual(mappedTalk);
  });

  it("should throw a 404 AppError when no row matches the id (missing, or belongs to another company)", async () => {
    // Arrange
    single.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    // Act & Assert
    await expect(getById("missing", "company-1")).rejects.toMatchObject({
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
    await expect(getById("talk-1", "company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the talk",
    });
  });
});

describe("talks service: create", () => {
  const customDbRow = {
    id: "talk-2",
    slug: null,
    title: "Ladder Safety Refresher",
    trade_tag: "Roofing",
    trade_tags: ["Roofing"],
    content: "# Ladder Safety Refresher\n",
    structured: {
      summary: null,
      talking_points: ["Inspect rungs before use"],
      site_hazards_to_check: [],
      discussion_questions: [],
      osha_standards: [],
      estimated_minutes: null,
    },
    attribution: null,
    is_global: false,
    company_id: "company-1",
    created_at: "2026-09-12T00:00:00.000Z",
  };

  const mappedCustomTalk = {
    id: "talk-2",
    slug: null,
    title: "Ladder Safety Refresher",
    tradeTag: "Roofing",
    tradeTags: ["Roofing"],
    content: "# Ladder Safety Refresher\n",
    structured: customDbRow.structured,
    attribution: null,
    isGlobal: false,
    companyId: "company-1",
    createdAt: "2026-09-12T00:00:00.000Z",
  };

  let single;
  let select;
  let insert;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: customDbRow, error: null });
    select = vi.fn(() => ({ single }));
    insert = vi.fn(() => ({ select }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { insert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should insert a company-scoped, non-global row and return it mapped to camelCase", async () => {
    // Act
    const result = await create({
      id: "talk-2",
      companyId: "company-1",
      title: "Ladder Safety Refresher",
      tradeTag: "Roofing",
      talkingPoints: ["Inspect rungs before use"],
    });

    // Assert
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "talk-2",
        slug: null,
        title: "Ladder Safety Refresher",
        trade_tag: "Roofing",
        trade_tags: ["Roofing"],
        is_global: false,
        attribution: null,
        company_id: "company-1",
        structured: expect.objectContaining({
          talking_points: ["Inspect rungs before use"],
          site_hazards_to_check: [],
          discussion_questions: [],
          osha_standards: [],
          summary: null,
          estimated_minutes: null,
        }),
      }),
    );
    const insertedRow = insert.mock.calls[0][0];
    expect(insertedRow.content).toContain("# Ladder Safety Refresher");
    expect(select).toHaveBeenCalledWith(TALK_COLUMNS);
    expect(result).toEqual(mappedCustomTalk);
  });

  it("should default trade_tags to [] when no tradeTag is given", async () => {
    // Act
    await create({
      id: "talk-2",
      companyId: "company-1",
      title: "No Trade",
      talkingPoints: ["A point"],
    });

    // Assert
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ trade_tag: null, trade_tags: [] }),
    );
  });

  it("should throw a 409 AppError when the id already exists", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "23505" } });

    // Act & Assert
    await expect(
      create({
        id: "talk-2",
        companyId: "company-1",
        title: "Dup",
        talkingPoints: ["x"],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "This talk already exists",
    });
  });

  it("should throw a 502 AppError on any other insert failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(
      create({
        id: "talk-2",
        companyId: "company-1",
        title: "Fail",
        talkingPoints: ["x"],
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the talk",
    });
  });
});
