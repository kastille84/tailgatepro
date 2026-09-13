/** One row from GET /api/favorites — mirrors server/services/favorites.js's
 *  `toFavorite` output. Just the talk id + when it was bookmarked; the full
 *  Talk is already held by useTalks(), so it isn't duplicated here. */
export interface FavoriteRow {
  talkId: string;
  createdAt: string;
}
