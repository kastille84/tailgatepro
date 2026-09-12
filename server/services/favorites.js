const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

// The columns every favorites query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service.
const FAVORITE_COLUMNS = "talk_id, created_at";

const toFavorite = (row) => ({
  talkId: row.talk_id,
  createdAt: row.created_at,
});

// Every talk the caller has favorited, newest first. Returns rows (not full
// Talk objects) — the client already holds the full talk list from
// GET /api/talks and only needs the set of favorited ids to merge in.
const listForUser = async (userId) => {
  const { data, error } = await supabase
    .from("user_favorites")
    .select(FAVORITE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("Could not load favorites", 502, { cause: error });
  }

  return data.map(toFavorite);
};

// Re-fetches one favorite row. Used by `add` when the upsert-ignore-duplicates
// write is skipped (the favorite already existed) so the response shape is
// always { talkId, createdAt } regardless of whether this call created the
// row or found it already there.
const getOne = async ({ userId, talkId }) => {
  const { data, error } = await supabase
    .from("user_favorites")
    .select(FAVORITE_COLUMNS)
    .eq("user_id", userId)
    .eq("talk_id", talkId)
    .single();

  if (error) {
    throw new AppError("Could not add the favorite", 502, { cause: error });
  }

  return toFavorite(data);
};

// Favorites a talk for the caller. Idempotent: favoriting an
// already-favorited talk succeeds and returns the existing row rather than
// erroring on the composite-PK conflict. `ignoreDuplicates: true` turns the
// conflict into a Postgres `ON CONFLICT DO NOTHING`, so on a duplicate the
// insert is silently skipped and `.select()` returns an empty array (no
// error) — that's the branch `getOne` backfills.
//
// Resolved (2d): a company's own custom talks plus every global talk are the
// only ids the client ever sees (talks.listForCompany's scoped `.or()`), so
// the FK-violation-on-unknown-talk-id 404 below is sufficient — there's no
// separate "can this user favorite this talk" check to add.
const add = async ({ userId, talkId }) => {
  const { data, error } = await supabase
    .from("user_favorites")
    .upsert(
      { user_id: userId, talk_id: talkId },
      { onConflict: "user_id,talk_id", ignoreDuplicates: true },
    )
    .select(FAVORITE_COLUMNS);

  if (error) {
    // 23503 = foreign_key_violation on user_favorites.talk_id — the talk
    // doesn't exist.
    if (error.code === "23503") {
      throw new AppError("Talk not found", 404, { cause: error });
    }
    throw new AppError("Could not add the favorite", 502, { cause: error });
  }

  // Duplicate: the write was skipped, so no row came back — go get it.
  if (data.length === 0) {
    return getOne({ userId, talkId });
  }

  return toFavorite(data[0]);
};

// Unfavorites a talk for the caller. Idempotent: removing a talk that isn't
// favorited is a no-op (DELETE matching zero rows is not an error in
// Postgrest) — the caller always gets a clean 200, no need to check first.
const remove = async ({ userId, talkId }) => {
  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("talk_id", talkId);

  if (error) {
    throw new AppError("Could not remove the favorite", 502, { cause: error });
  }

  return { talkId };
};

module.exports = { listForUser, add, remove };
