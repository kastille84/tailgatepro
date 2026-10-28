const publicVerifyService = require("../services/publicVerify");

// GET /api/public/meetings/:id/verify -- unauthenticated; the target of the QR
// code printed on every report (docs/tamper-evidence-design.md "PDF seal").
exports.verifyRecord = async (req, res, next) => {
  try {
    const data = await publicVerifyService.verifyRecord(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/public/meetings/:id/verify-file -- body { sha256 }. The browser
// hashes the dropped PDF; the file itself is never uploaded.
exports.verifyFile = async (req, res, next) => {
  try {
    const data = await publicVerifyService.verifyFile(
      req.params.id,
      req.body.sha256.toLowerCase(),
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
