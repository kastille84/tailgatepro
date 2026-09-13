const favoritesService = require("../services/favorites");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's own id, never req.body/req.params, scopes every read/write here.

exports.listFavorites = async (req, res, next) => {
  try {
    const data = await favoritesService.listForUser(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.addFavorite = async (req, res, next) => {
  try {
    const data = await favoritesService.add({
      userId: req.user.id,
      talkId: req.body.talkId,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const data = await favoritesService.remove({
      userId: req.user.id,
      talkId: req.params.talkId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
