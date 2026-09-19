// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { getById } = require("./companies");

const COMPANY_COLUMNS = "id, name, company_type, tier";

const dbRow = {
  id: "company-1",
  name: "Acme Roofing",
  company_type: "subcontractor",
  tier: "premium",
};

const mappedCompany = {
  id: "company-1",
  name: "Acme Roofing",
  companyType: "subcontractor",
  tier: "premium",
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

  it("should fetch one company by id, mapped to camelCase", async () => {
    // Act
    const result = await getById("company-1");

    // Assert
    expect(select).toHaveBeenCalledWith(COMPANY_COLUMNS);
    expect(eqId).toHaveBeenCalledWith("id", "company-1");
    expect(result).toEqual(mappedCompany);
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
