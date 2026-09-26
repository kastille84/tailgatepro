// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const meetingLogsService = require("../services/meetingLogs");
const companiesService = require("../services/companies");
const talksService = require("../services/talks");
const {
  listMeetings,
  listMeetingMonths,
  getMeeting,
  createMeeting,
  completeMeeting,
  uploadCrewPhoto,
  getCrewPhotoUrl,
  getPdfUrl,
} = require("./meetingLogs");

const listForCompanySpy = vi.spyOn(meetingLogsService, "listForCompany");
const countHiddenSpy = vi.spyOn(meetingLogsService, "countHiddenForCompany");
const listMonthSummariesSpy = vi.spyOn(meetingLogsService, "listMonthSummaries");
const getByIdSpy = vi.spyOn(meetingLogsService, "getById");
const createSpy = vi.spyOn(meetingLogsService, "create");
const completeSpy = vi.spyOn(meetingLogsService, "complete");
const uploadCrewPhotoSpy = vi.spyOn(meetingLogsService, "uploadCrewPhoto");
const getCrewPhotoUrlSpy = vi.spyOn(meetingLogsService, "getCrewPhotoUrl");
const getPdfUrlSpy = vi.spyOn(meetingLogsService, "getPdfUrl");
const getCompanySpy = vi.spyOn(companiesService, "getById");
const getTalkSpy = vi.spyOn(talksService, "getById");

const meeting = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  foremanId: "user-1",
  companyId: "company-1",
  crewPhotoUrl: null,
  finalPdfUrl: null,
  completedAt: null,
  heldAt: null,
  syncedAt: null,
  createdAt: "2026-09-14T00:00:00.000Z",
};

describe("meetingLogs controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    listForCompanySpy.mockReset();
    countHiddenSpy.mockReset().mockResolvedValue(0);
    listMonthSummariesSpy.mockReset();
    getByIdSpy.mockReset();
    createSpy.mockReset();
    completeSpy.mockReset();
    uploadCrewPhotoSpy.mockReset();
    getCrewPhotoUrlSpy.mockReset();
    getPdfUrlSpy.mockReset();
    getTalkSpy.mockReset().mockResolvedValue({ id: "talk-1" });
    getCompanySpy
      .mockReset()
      .mockResolvedValue({ id: "company-1", companyType: "subcontractor", tier: "premium" });
    req = {
      params: {},
      query: {},
      body: {},
      user: {
        id: "user-1",
        companyId: "company-1",
        companyType: "subcontractor",
        tier: "premium",
      },
      get: vi.fn().mockReturnValue("image/jpeg"),
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listMeetings", () => {
    it("should respond 200 with every meeting log visible to the caller's company", async () => {
      // Arrange
      listForCompanySpy.mockResolvedValue([meeting]);

      // Act
      await listMeetings(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        projectId: undefined,
        historyDays: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [meeting],
        meta: { hiddenCount: 0, historyDays: null },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the Free plan's 30-day history window to the service and report the hidden count", async () => {
      // Arrange
      getCompanySpy.mockResolvedValue({ id: "company-1", companyType: "subcontractor", tier: "basic" });
      listForCompanySpy.mockResolvedValue([meeting]);
      countHiddenSpy.mockResolvedValue(4);

      // Act
      await listMeetings(req, res, next);

      // Assert
      expect(getCompanySpy).toHaveBeenCalledWith("company-1");
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        projectId: undefined,
        historyDays: 30,
      });
      expect(countHiddenSpy).toHaveBeenCalledWith("company-1", {
        projectId: undefined,
        historyDays: 30,
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [meeting],
        meta: { hiddenCount: 4, historyDays: 30 },
      });
    });

    it("should pass a projectId query param through to the service", async () => {
      // Arrange
      req.query = { projectId: "project-1" };
      listForCompanySpy.mockResolvedValue([meeting]);

      // Act
      await listMeetings(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        projectId: "project-1",
        historyDays: null,
      });
    });

    it("should pass a from/to month range through to the service", async () => {
      // Arrange
      req.query = {
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      };
      listForCompanySpy.mockResolvedValue([meeting]);

      // Act
      await listMeetings(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        projectId: undefined,
        historyDays: null,
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      listForCompanySpy.mockRejectedValue(error);

      // Act
      await listMeetings(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("listMeetingMonths", () => {
    it("should respond 200 with the month summaries and the history meta", async () => {
      // Arrange
      req.query = { tzOffset: "300" };
      getCompanySpy.mockResolvedValue({
        id: "company-1",
        companyType: "subcontractor",
        tier: "basic",
      });
      listMonthSummariesSpy.mockResolvedValue([{ month: "2026-09", count: 3 }]);
      countHiddenSpy.mockResolvedValue(2);

      // Act
      await listMeetingMonths(req, res, next);

      // Assert
      expect(listMonthSummariesSpy).toHaveBeenCalledWith("company-1", {
        historyDays: 30,
        tzOffset: 300,
      });
      expect(countHiddenSpy).toHaveBeenCalledWith("company-1", {
        historyDays: 30,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ month: "2026-09", count: 3 }],
        meta: { hiddenCount: 2, historyDays: 30 },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      req.query = { tzOffset: "0" };
      const error = new Error("boom");
      listMonthSummariesSpy.mockRejectedValue(error);

      // Act
      await listMeetingMonths(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getMeeting", () => {
    it("should call the service with req.params.id + the caller's companyId and respond 200", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      getByIdSpy.mockResolvedValue(meeting);

      // Act
      await getMeeting(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("meeting-1", "company-1", {
        historyDays: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: meeting });
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the Free plan's history window when fetching one meeting", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      getCompanySpy.mockResolvedValue({ id: "company-1", companyType: "subcontractor", tier: "basic" });
      getByIdSpy.mockResolvedValue(meeting);

      // Act
      await getMeeting(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("meeting-1", "company-1", {
        historyDays: 30,
      });
    });

    it("should forward a service error to next() (e.g. the 404 not-found case)", async () => {
      // Arrange
      req.params = { id: "missing" };
      const error = new Error("Meeting not found");
      getByIdSpy.mockRejectedValue(error);

      // Act
      await getMeeting(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("createMeeting", () => {
    beforeEach(() => {
      req.body = { id: "meeting-1", projectId: "project-1", talkId: "talk-1" };
    });

    it("should call the service with the body fields, the caller's companyId, and the caller's own id as foremanId, then respond 201", async () => {
      // Arrange
      createSpy.mockResolvedValue(meeting);

      // Act
      await createMeeting(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({
        id: "meeting-1",
        companyId: "company-1",
        projectId: "project-1",
        talkId: "talk-1",
        foremanId: "user-1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: meeting });
      expect(next).not.toHaveBeenCalled();
    });

    it("should not check talk visibility for a plan with the full library", async () => {
      // Arrange
      createSpy.mockResolvedValue(meeting);

      // Act
      await createMeeting(req, res, next);

      // Assert
      expect(getTalkSpy).not.toHaveBeenCalled();
    });

    it("should let a Trade Free caller run a core talk", async () => {
      // Arrange
      req.user.tier = "basic";
      createSpy.mockResolvedValue(meeting);

      // Act
      await createMeeting(req, res, next);

      // Assert
      expect(getTalkSpy).toHaveBeenCalledWith("talk-1", "company-1", {
        fullLibrary: false,
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should reject a Trade Free caller running a non-core talk", async () => {
      // Arrange
      req.user.tier = "basic";
      const error = new Error("Talk not found");
      getTalkSpy.mockRejectedValue(error);

      // Act
      await createMeeting(req, res, next);

      // Assert
      expect(createSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it("should skip the talk check when no talk is attached", async () => {
      // Arrange
      req.user.tier = "basic";
      req.body.talkId = undefined;
      createSpy.mockResolvedValue(meeting);

      // Act
      await createMeeting(req, res, next);

      // Assert
      expect(getTalkSpy).not.toHaveBeenCalled();
    });

    it("should never take foremanId from the request body, even if one is supplied", async () => {
      // Arrange
      req.body.foremanId = "someone-elses-id";
      createSpy.mockResolvedValue(meeting);

      // Act
      await createMeeting(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ foremanId: "user-1" }),
      );
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      createSpy.mockRejectedValue(error);

      // Act
      await createMeeting(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("completeMeeting", () => {
    it("should call the service with req.params.id + the caller's companyId and respond 200", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      const completed = { ...meeting, completedAt: "2026-09-14T01:00:00.000Z" };
      completeSpy.mockResolvedValue(completed);

      // Act
      await completeMeeting(req, res, next);

      // Assert
      expect(completeSpy).toHaveBeenCalledWith({
        id: "meeting-1",
        companyId: "company-1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: completed });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward the client-reported req.body.heldAt to the service", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      req.body = { heldAt: "2026-09-20T22:30:00.000Z" };
      completeSpy.mockResolvedValue(meeting);

      // Act
      await completeMeeting(req, res, next);

      // Assert
      expect(completeSpy).toHaveBeenCalledWith({
        id: "meeting-1",
        companyId: "company-1",
        heldAt: "2026-09-20T22:30:00.000Z",
      });
    });

    it("should pass an undefined heldAt (not throw) when the request has no body at all", async () => {
      // Arrange — completions queued by an older client carry no body
      req.params = { id: "meeting-1" };
      req.body = undefined;
      completeSpy.mockResolvedValue(meeting);

      // Act
      await completeMeeting(req, res, next);

      // Assert
      expect(completeSpy.mock.calls[0][0].heldAt).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next() (e.g. the zero-signatures or already-completed guard)", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      const error = new Error(
        "A meeting needs at least one signature before it can be completed.",
      );
      completeSpy.mockRejectedValue(error);

      // Act
      await completeMeeting(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("uploadCrewPhoto", () => {
    it("should call the service with req.params.id, the caller's companyId, the raw body Buffer, and the Content-Type header, then respond 200", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      req.body = Buffer.from("jpg-bytes");
      const updated = { ...meeting, crewPhotoUrl: "meeting-1/photo.jpg" };
      uploadCrewPhotoSpy.mockResolvedValue(updated);

      // Act
      await uploadCrewPhoto(req, res, next);

      // Assert
      expect(uploadCrewPhotoSpy).toHaveBeenCalledWith({
        id: "meeting-1",
        companyId: "company-1",
        buffer: req.body,
        contentType: "image/jpeg",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next() (e.g. the already-completed 409 guard)", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      const error = new Error(
        "This meeting has already been completed and can't be changed.",
      );
      uploadCrewPhotoSpy.mockRejectedValue(error);

      // Act
      await uploadCrewPhoto(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getCrewPhotoUrl", () => {
    it("should call the service with req.params.id + the caller's companyId and respond 200 with the signed url", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      getCrewPhotoUrlSpy.mockResolvedValue("https://signed.example/photo.jpg");

      // Act
      await getCrewPhotoUrl(req, res, next);

      // Assert
      expect(getCrewPhotoUrlSpy).toHaveBeenCalledWith("meeting-1", "company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { url: "https://signed.example/photo.jpg" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next() (e.g. no crew photo uploaded yet)", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      const error = new Error("No crew photo has been uploaded for this meeting");
      getCrewPhotoUrlSpy.mockRejectedValue(error);

      // Act
      await getCrewPhotoUrl(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getPdfUrl", () => {
    it("should call the service with req.params.id + the caller's companyId and respond 200 with the signed url", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      getPdfUrlSpy.mockResolvedValue("https://signed.example/report.pdf");

      // Act
      await getPdfUrl(req, res, next);

      // Assert
      expect(getPdfUrlSpy).toHaveBeenCalledWith("meeting-1", "company-1", {
        historyDays: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { url: "https://signed.example/report.pdf" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the Free plan's history window so older PDFs are gated too", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      getCompanySpy.mockResolvedValue({ id: "company-1", companyType: "subcontractor", tier: "basic" });
      getPdfUrlSpy.mockResolvedValue("https://signed.example/report.pdf");

      // Act
      await getPdfUrl(req, res, next);

      // Assert
      expect(getPdfUrlSpy).toHaveBeenCalledWith("meeting-1", "company-1", {
        historyDays: 30,
      });
    });

    it("should forward a service error to next() (e.g. no PDF generated yet)", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      const error = new Error("No PDF has been generated for this meeting yet");
      getPdfUrlSpy.mockRejectedValue(error);

      // Act
      await getPdfUrl(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
