const { AppError } = require("./AppError");

// Awaits a `{ count: "exact", head: true }` Supabase query and returns its
// count (null -> 0). Any query failure becomes a 502 with `failureMessage`.
// Shared by the plan-limit checks (seats, jobsite caps, sponsorship).
const countRows = async (query, failureMessage) => {
  const { count, error } = await query;
  if (error) {
    throw new AppError(failureMessage, 502, { cause: error });
  }
  return count ?? 0;
};

module.exports = { countRows };
