const { AppError } = require("./AppError");

// PostgREST caps a single response at 1,000 rows and truncates silently past
// it, so any read that needs *every* row (compliance counts, month buckets)
// has to page. `buildPageQuery(from, to)` returns the Supabase query for one
// inclusive `.range(from, to)` slice; it must apply a deterministic order
// (a unique tiebreaker like `id` last) or pages can skip/duplicate rows.
const DEFAULT_PAGE_SIZE = 1000;

const fetchAllPages = async (
  buildPageQuery,
  { pageSize = DEFAULT_PAGE_SIZE, errorMessage } = {},
) => {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildPageQuery(offset, offset + pageSize - 1);

    if (error) {
      throw new AppError(errorMessage, 502, { cause: error });
    }

    rows.push(...data);

    if (data.length < pageSize) return rows;
  }
};

module.exports = { fetchAllPages, DEFAULT_PAGE_SIZE };
