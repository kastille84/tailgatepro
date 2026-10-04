// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { fetchAllPages } = require("./fetchAllPages");

const rowsOf = (count, start = 0) =>
  Array.from({ length: count }, (_, i) => ({ id: start + i }));

describe("fetchAllPages", () => {
  it("should return a single short page without a second query", async () => {
    // Arrange
    const buildPageQuery = vi.fn().mockResolvedValue({ data: rowsOf(3), error: null });

    // Act
    const result = await fetchAllPages(buildPageQuery, { pageSize: 5 });

    // Assert
    expect(result).toHaveLength(3);
    expect(buildPageQuery).toHaveBeenCalledTimes(1);
    expect(buildPageQuery).toHaveBeenCalledWith(0, 4);
  });

  it("should keep paging until a short page and concatenate every row in order", async () => {
    // Arrange
    const buildPageQuery = vi
      .fn()
      .mockResolvedValueOnce({ data: rowsOf(5, 0), error: null })
      .mockResolvedValueOnce({ data: rowsOf(5, 5), error: null })
      .mockResolvedValueOnce({ data: rowsOf(2, 10), error: null });

    // Act
    const result = await fetchAllPages(buildPageQuery, { pageSize: 5 });

    // Assert
    expect(result.map((row) => row.id)).toEqual([...Array(12).keys()]);
    expect(buildPageQuery.mock.calls).toEqual([
      [0, 4],
      [5, 9],
      [10, 14],
    ]);
  });

  it("should issue one more (empty) query when a page is exactly full", async () => {
    // Arrange
    const buildPageQuery = vi
      .fn()
      .mockResolvedValueOnce({ data: rowsOf(5), error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    // Act
    const result = await fetchAllPages(buildPageQuery, { pageSize: 5 });

    // Assert
    expect(result).toHaveLength(5);
    expect(buildPageQuery).toHaveBeenCalledTimes(2);
  });

  it("should default to PostgREST's 1,000-row page size", async () => {
    // Arrange
    const buildPageQuery = vi.fn().mockResolvedValue({ data: [], error: null });

    // Act
    await fetchAllPages(buildPageQuery);

    // Assert
    expect(buildPageQuery).toHaveBeenCalledWith(0, 999);
  });

  it("should throw a 502 AppError preserving the cause when a later page fails", async () => {
    // Arrange
    const cause = { code: "XX000" };
    const buildPageQuery = vi
      .fn()
      .mockResolvedValueOnce({ data: rowsOf(5), error: null })
      .mockResolvedValueOnce({ data: null, error: cause });

    // Act & Assert
    await expect(
      fetchAllPages(buildPageQuery, { pageSize: 5, errorMessage: "Could not load things" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load things",
      cause,
    });
  });
});
