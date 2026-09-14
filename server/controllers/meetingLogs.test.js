// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const meetingLogsService = require("../services/meetingLogs");
const {
  listMeetings,
  getMeeting,
  createMeeting,
  completeMeeting,
} = require("./meetingLogs");

const listForCompanySpy = vi.spyOn(meetingLogsService, "listForCompany");
const getByIdSpy = vi.spyOn(meetingLogsService, "getById");
const createSpy = vi.spyOn(meetingLogsService, "create");
const completeSpy = vi.spyOn(meetingLogsService, "complete");

const meeting = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  foremanId: "user-1",
  companyId: "company-1",
  crewPhotoUrl: null,
  finalPdfUrl: null,
  completedAt: null,
  syncedAt: null,
  createdAt: "2026-09-14T00:00:00.000Z",
};

describe("meetingLogs controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    listForCompanySpy.mockReset();
    getByIdSpy.mockReset();
    createSpy.mockReset();
    completeSpy.mockReset();
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: "user-1", companyId: "company-1" },
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
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [meeting] });
      expect(next).not.toHaveBeenCalled();
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

  describe("getMeeting", () => {
    it("should call the service with req.params.id + the caller's companyId and respond 200", async () => {
      // Arrange
      req.params = { id: "meeting-1" };
      getByIdSpy.mockResolvedValue(meeting);

      // Act
      await getMeeting(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("meeting-1", "company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: meeting });
      expect(next).not.toHaveBeenCalled();
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
});
