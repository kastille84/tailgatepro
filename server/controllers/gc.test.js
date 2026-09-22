// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const gcDashboardService = require("../services/gcDashboard");
const { getOverview, listMeetings, getMeeting, getMeetingPdfUrl } = require("./gc");

const getOverviewSpy = vi.spyOn(gcDashboardService, "getOverview");
const listMeetingsSpy = vi.spyOn(gcDashboardService, "listMeetings");
const getMeetingSpy = vi.spyOn(gcDashboardService, "getMeeting");
const getMeetingPdfUrlSpy = vi.spyOn(gcDashboardService, "getMeetingPdfUrl");

describe("gc controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    getOverviewSpy.mockReset();
    listMeetingsSpy.mockReset();
    getMeetingSpy.mockReset();
    getMeetingPdfUrlSpy.mockReset();

    req = {
      params: {},
      query: {},
      user: { id: "user-1", companyId: "gc-1", companyType: "gc" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("getOverview", () => {
    it("should pass date/tzOffset through and respond with the service's data", async () => {
      // Arrange
      req.query = { date: "2026-09-21", tzOffset: "240" };
      const data = { jobsites: [], totals: { subs: 0, logged: 0, missing: 0 } };
      getOverviewSpy.mockResolvedValue(data);

      // Act
      await getOverview(req, res, next);

      // Assert
      expect(getOverviewSpy).toHaveBeenCalledWith("gc-1", { date: "2026-09-21", tzOffset: 240 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      getOverviewSpy.mockRejectedValue(error);

      // Act
      await getOverview(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("listMeetings", () => {
    it("should pass query params through and respond with the service's data", async () => {
      // Arrange
      req.query = { projectId: "project-1", from: "2026-09-01", to: "2026-09-08" };
      const data = [{ id: "meeting-1" }];
      listMeetingsSpy.mockResolvedValue(data);

      // Act
      await listMeetings(req, res, next);

      // Assert
      expect(listMeetingsSpy).toHaveBeenCalledWith("gc-1", {
        projectId: "project-1",
        from: "2026-09-01",
        to: "2026-09-08",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      listMeetingsSpy.mockRejectedValue(error);

      // Act
      await listMeetings(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getMeeting", () => {
    it("should respond with the meeting detail from the service", async () => {
      // Arrange
      req.params.id = "meeting-1";
      const data = { id: "meeting-1", signers: [] };
      getMeetingSpy.mockResolvedValue(data);

      // Act
      await getMeeting(req, res, next);

      // Assert
      expect(getMeetingSpy).toHaveBeenCalledWith("meeting-1", "gc-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      getMeetingSpy.mockRejectedValue(error);

      // Act
      await getMeeting(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getMeetingPdfUrl", () => {
    it("should respond with the signed url from the service", async () => {
      // Arrange
      req.params.id = "meeting-1";
      getMeetingPdfUrlSpy.mockResolvedValue("https://signed.example/report.pdf");

      // Act
      await getMeetingPdfUrl(req, res, next);

      // Assert
      expect(getMeetingPdfUrlSpy).toHaveBeenCalledWith("meeting-1", "gc-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { url: "https://signed.example/report.pdf" },
      });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      getMeetingPdfUrlSpy.mockRejectedValue(error);

      // Act
      await getMeetingPdfUrl(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
