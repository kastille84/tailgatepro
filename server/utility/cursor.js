const { AppError } = require("./AppError");

// Opaque keyset-pagination cursor: the last row's sort value + id, so the next
// page resumes strictly after it even when rows are inserted at the top.
//
// The decoded values are interpolated into a PostgREST `.or()` filter string,
// so they are validated strictly (ISO timestamp + UUID) rather than trusted —
// a crafted cursor must never be able to inject filter syntax.
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encodeCursor = ({ value, id }) =>
  Buffer.from(JSON.stringify({ value, id })).toString("base64url");

const decodeCursor = (cursor) => {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch (error) {
    throw new AppError("Invalid cursor", 400, { cause: error });
  }

  if (
    typeof parsed?.value !== "string" ||
    typeof parsed?.id !== "string" ||
    !TIMESTAMP_PATTERN.test(parsed.value) ||
    !UUID_PATTERN.test(parsed.id)
  ) {
    throw new AppError("Invalid cursor", 400);
  }

  return { value: parsed.value, id: parsed.id };
};

module.exports = { encodeCursor, decodeCursor };
