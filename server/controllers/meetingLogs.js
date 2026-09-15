const meetingLogsService = require("../services/meetingLogs");

// req.user is set by loadUserContext (which runs after requireAuth) — the
// caller's company and id always come from there, never from req.body/req.params.

exports.listMeetings = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const data = await meetingLogsService.listForCompany(req.user.companyId, {
      projectId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getMeeting = async (req, res, next) => {
  try {
    const data = await meetingLogsService.getById(
      req.params.id,
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// `foremanId` is always the authenticated caller, never accepted from the
// request body — the person running the meeting is whoever is signed in.
exports.createMeeting = async (req, res, next) => {
  try {
    const { id, projectId, talkId } = req.body;
    const data = await meetingLogsService.create({
      id,
      companyId: req.user.companyId,
      projectId,
      talkId,
      foremanId: req.user.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.completeMeeting = async (req, res, next) => {
  try {
    const data = await meetingLogsService.complete({
      id: req.params.id,
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// req.body is a raw Buffer here (see the route's `express.raw` middleware),
// not the parsed JSON object every other controller in this file sees.
exports.uploadCrewPhoto = async (req, res, next) => {
  try {
    const data = await meetingLogsService.uploadCrewPhoto({
      id: req.params.id,
      companyId: req.user.companyId,
      buffer: req.body,
      contentType: req.get("Content-Type"),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getCrewPhotoUrl = async (req, res, next) => {
  try {
    const url = await meetingLogsService.getCrewPhotoUrl(
      req.params.id,
      req.user.companyId,
    );
    return res.status(200).json({ success: true, data: { url } });
  } catch (error) {
    return next(error);
  }
};
