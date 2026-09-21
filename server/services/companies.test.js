// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } = require("../utility/joinCode");
const {
  getById,
  updateLogo,
  getOrCreateJoinCode,
  getByJoinCode,
} = require("./companies");

const JOIN_CODE_PATTERN = new RegExp(
  `^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`,
);

const COMPANY_COLUMNS = "id, name, company_type, tier, logo_path";

const dbRow = {
  id: "company-1",
  name: "Acme Roofing",
  company_type: "subcontractor",
  tier: "premium",
  logo_path: "company-1/logo",
};

const mappedCompany = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor",
  tier: "premium",
  logoPath: "company-1/logo",
};

const fromSpy = vi.spyOn(supabase, "from");

describe("companies service: getById", () => {
  let single;
  let eqId;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    eqId = vi.fn(() => ({ single }));
    select = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should fetch one company by id, mapped to camelCase, including logoPath", async () => {
    // Act
    const result = await getById("company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(COMPANY_COLUMNS);
    expect(eqId).toHaveBeenCalledWith("id", "company-1");
    expect(result).toEqual(mappedCompany);
  });

  it("should map a null logo_path to a null logoPath", async () => {
    // Arrange
    single.mockResolvedValue({ data: { ...dbRow, logo_path: null }, error: null });

    // Act
    const result = await getById("company-1");

    // Assert
    expect(result.logoPath).toBeNull();
  });

  it("should throw a 404 AppError when no row matches the id", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(getById("missing")).rejects.toMatchObject({
      statusCode: 404,
      message: "Company not found",
    });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(getById("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the company",
    });
  });
});

describe("companies service: updateLogo", () => {
  let single;
  let select;
  let eqId;
  let update;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    select = vi.fn(() => ({ single }));
    eqId = vi.fn(() => ({ select }));
    update = vi.fn(() => ({ eq: eqId }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") return { update };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should update the company's logo_path and return the mapped row", async () => {
    // Act
    const result = await updateLogo("company-1", "company-1/logo");

    // Assert
    expect(update).toHaveBeenCalledWith({ logo_path: "company-1/logo" });
    expect(eqId).toHaveBeenCalledWith("id", "company-1");
    expect(select).toHaveBeenCalledWith(COMPANY_COLUMNS);
    expect(result).toEqual(mappedCompany);
  });

  it("should throw a 404 AppError when no row matches the company id", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(updateLogo("missing", "missing/logo")).rejects.toMatchObject({
      statusCode: 404,
      message: "Company not found",
    });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(updateLogo("company-1", "company-1/logo")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not save the company logo",
    });
  });
});

describe("companies service: getOrCreateJoinCode", () => {
  let readSingle;
  let readEq;
  let readSelect;
  let updateSelect;
  let updateIs;
  let updateEq;
  let update;

  beforeEach(() => {
    // Read chain: select("join_code").eq("id", ...).single()
    readSingle = vi.fn().mockResolvedValue({
      data: { join_code: null },
      error: null,
    });
    readEq = vi.fn(() => ({ single: readSingle }));
    readSelect = vi.fn(() => ({ eq: readEq }));
    // Write chain: update({ join_code }).eq("id", ...).is("join_code", null).select("join_code")
    updateSelect = vi.fn().mockResolvedValue({
      data: [{ join_code: "PLACEHOLDER" }],
      error: null,
    });
    updateIs = vi.fn(() => ({ select: updateSelect }));
    updateEq = vi.fn(() => ({ is: updateIs }));
    update = vi.fn(() => ({ eq: updateEq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") return { select: readSelect, update };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should return the existing code without writing when one is already set", async () => {
    // Arrange
    readSingle.mockResolvedValue({ data: { join_code: "ABCD2345" }, error: null });

    // Act
    const result = await getOrCreateJoinCode("company-1");

    // Assert
    expect(result).toBe("ABCD2345");
    expect(readSelect).toHaveBeenCalledWith("join_code");
    expect(readEq).toHaveBeenCalledWith("id", "company-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("should generate and store a code only where join_code is still NULL, and return it", async () => {
    // Arrange
    updateSelect.mockImplementation(async () => ({
      data: [{ join_code: update.mock.calls[0][0].join_code }],
      error: null,
    }));

    // Act
    const result = await getOrCreateJoinCode("company-1");

    // Assert
    const written = update.mock.calls[0][0].join_code;
    expect(written).toMatch(JOIN_CODE_PATTERN);
    expect(updateEq).toHaveBeenCalledWith("id", "company-1");
    expect(updateIs).toHaveBeenCalledWith("join_code", null);
    expect(updateSelect).toHaveBeenCalledWith("join_code");
    expect(result).toBe(written);
  });

  it("should retry with a new code after a unique-violation collision", async () => {
    // Arrange
    updateSelect
      .mockResolvedValueOnce({ data: null, error: { code: "23505" } })
      .mockImplementationOnce(async () => ({
        data: [{ join_code: update.mock.calls[1][0].join_code }],
        error: null,
      }));

    // Act
    const result = await getOrCreateJoinCode("company-1");

    // Assert
    expect(update).toHaveBeenCalledTimes(2);
    expect(result).toBe(update.mock.calls[1][0].join_code);
  });

  it("should throw a 502 AppError after exhausting every attempt on collisions", async () => {
    // Arrange
    updateSelect.mockResolvedValue({ data: null, error: { code: "23505" } });

    // Act & Assert
    await expect(getOrCreateJoinCode("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create a join code, please try again",
    });
    expect(update).toHaveBeenCalledTimes(5);
  });

  it("should re-read and return the stored code when another request won the race", async () => {
    // Arrange
    readSingle
      .mockResolvedValueOnce({ data: { join_code: null }, error: null })
      .mockResolvedValueOnce({ data: { join_code: "WINNER22" }, error: null });
    updateSelect.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await getOrCreateJoinCode("company-1");

    // Assert
    expect(result).toBe("WINNER22");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("should throw a 502 AppError on a non-collision write failure", async () => {
    // Arrange
    updateSelect.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(getOrCreateJoinCode("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the join code",
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("should throw a 404 AppError when the company row does not exist", async () => {
    // Arrange
    readSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(getOrCreateJoinCode("missing")).rejects.toMatchObject({
      statusCode: 404,
      message: "Company not found",
    });
  });

  it("should throw a 502 AppError when the initial read fails", async () => {
    // Arrange
    readSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(getOrCreateJoinCode("company-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the join code",
    });
  });
});

describe("companies service: getByJoinCode", () => {
  let single;
  let eq;
  let select;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: { id: "gc-1", name: "Turner Construction Inc." },
      error: null,
    });
    eq = vi.fn(() => ({ single }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "companies") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should look the code up trimmed and uppercased, and return only { id, name }", async () => {
    // Act
    const result = await getByJoinCode("  abcd2345 ");

    // Assert
    expect(select).toHaveBeenCalledWith("id, name");
    expect(eq).toHaveBeenCalledWith("join_code", "ABCD2345");
    expect(result).toEqual({ id: "gc-1", name: "Turner Construction Inc." });
  });

  it("should throw a 404 AppError when no company has that code", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    // Act & Assert
    await expect(getByJoinCode("NOPE2345")).rejects.toMatchObject({
      statusCode: 404,
      message: "Join code not found",
    });
  });

  it("should throw a 502 AppError on any other query failure", async () => {
    // Arrange
    single.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(getByJoinCode("ABCD2345")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not look up the join code",
    });
  });
});
