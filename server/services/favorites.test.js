// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
// `supabase.from` is looked up fresh at call time (not destructured), so a
// single module-scope spy reconfigured per test is enough — no re-spying.
const { supabase } = require("../utility/supabaseClient");
const { listForUser, add, remove } = require("./favorites");

const FAVORITE_COLUMNS = "talk_id, created_at";

const dbRow = {
  talk_id: "talk-1",
  created_at: "2026-09-09T00:00:00.000Z",
};

const mappedFavorite = {
  talkId: "talk-1",
  createdAt: "2026-09-09T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");

describe("favorites service: listForUser", () => {
  let order;
  let eq;
  let select;

  beforeEach(() => {
    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    eq = vi.fn(() => ({ order }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "user_favorites") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should query the caller's favorites newest first and map rows to camelCase", async () => {
    // Act
    const result = await listForUser("user-1");

    // Assert
    expect(select).toHaveBeenCalledWith(FAVORITE_COLUMNS);
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([mappedFavorite]);
  });

  it("should throw a 502 AppError when the query fails", async () => {
    // Arrange
    order.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(listForUser("user-1")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load favorites",
    });
  });
});

describe("favorites service: add", () => {
  let upsertSelect;
  let upsert;
  let single;
  let getOneEq2;
  let getOneEq1;
  let getOneSelect;

  const payload = { userId: "user-1", talkId: "talk-1" };

  beforeEach(() => {
    upsertSelect = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    upsert = vi.fn(() => ({ select: upsertSelect }));

    single = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    getOneEq2 = vi.fn(() => ({ single }));
    getOneEq1 = vi.fn(() => ({ eq: getOneEq2 }));
    getOneSelect = vi.fn(() => ({ eq: getOneEq1 }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "user_favorites") return { upsert, select: getOneSelect };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should upsert with ignoreDuplicates and return the mapped row for a new favorite", async () => {
    // Act
    const result = await add(payload);

    // Assert
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", talk_id: "talk-1" },
      { onConflict: "user_id,talk_id", ignoreDuplicates: true },
    );
    expect(upsertSelect).toHaveBeenCalledWith(FAVORITE_COLUMNS);
    expect(result).toEqual(mappedFavorite);
    expect(getOneSelect).not.toHaveBeenCalled();
  });

  it("should re-fetch the existing row when the write is skipped as a duplicate", async () => {
    // Arrange
    upsertSelect.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await add(payload);

    // Assert
    expect(getOneSelect).toHaveBeenCalledWith(FAVORITE_COLUMNS);
    expect(getOneEq1).toHaveBeenCalledWith("user_id", "user-1");
    expect(getOneEq2).toHaveBeenCalledWith("talk_id", "talk-1");
    expect(result).toEqual(mappedFavorite);
  });

  it("should throw a 404 AppError when the talk doesn't exist (FK violation)", async () => {
    // Arrange
    upsertSelect.mockResolvedValue({
      data: null,
      error: { code: "23503", message: "fk violation" },
    });

    // Act & Assert
    await expect(add(payload)).rejects.toMatchObject({
      statusCode: 404,
      message: "Talk not found",
    });
  });

  it("should throw a 502 AppError on any other upsert failure", async () => {
    // Arrange
    upsertSelect.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "unexpected" },
    });

    // Act & Assert
    await expect(add(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not add the favorite",
    });
  });

  it("should throw a 502 AppError when the duplicate backfill read fails", async () => {
    // Arrange
    upsertSelect.mockResolvedValue({ data: [], error: null });
    single.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "unexpected" },
    });

    // Act & Assert
    await expect(add(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not add the favorite",
    });
  });
});

describe("favorites service: remove", () => {
  let eqTalk;
  let eqUser;
  let deleteFn;

  beforeEach(() => {
    eqTalk = vi.fn().mockResolvedValue({ error: null });
    eqUser = vi.fn(() => ({ eq: eqTalk }));
    deleteFn = vi.fn(() => ({ eq: eqUser }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "user_favorites") return { delete: deleteFn };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should delete the row scoped to user and talk, and return the talk id", async () => {
    // Act
    const result = await remove({ userId: "user-1", talkId: "talk-1" });

    // Assert
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqTalk).toHaveBeenCalledWith("talk_id", "talk-1");
    expect(result).toEqual({ talkId: "talk-1" });
  });

  it("should throw a 502 AppError when the delete fails", async () => {
    // Arrange
    eqTalk.mockResolvedValue({ error: new Error("db down") });

    // Act & Assert
    await expect(
      remove({ userId: "user-1", talkId: "talk-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not remove the favorite",
    });
  });
});
