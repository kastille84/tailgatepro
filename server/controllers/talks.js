const talksService = require("../services/talks");

exports.listTalks = async (req, res, next) => {
  try {
    const data = await talksService.listGlobal();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getTalk = async (req, res, next) => {
  try {
    const data = await talksService.getById(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
