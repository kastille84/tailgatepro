// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const gcDashboardService = require("../services/gcDashboard");
const scorecardsService = require("../services/scorecards");
const policyPushService = require("../services/policyPush");
const siteScopeService = require("../services/siteScope");
const zipBundleService = require("../services/zipBundle");
const {
  getOverview,
  listMeetings,
  getMeeting,
  getMeetingPdfUrl,
  getDefenseBundle,
  listSubcontractorScorecards,
  getSubcontractorScorecard,
  getPolicyPush,
  listPolicyPushTalks,
  pushPolicyTopic,
  clearPolicyPush,
} = require("./gc");

const getOverviewSpy = vi.spyOn(gcDashboardService, "getOverview");
const listMeetingsSpy = vi.spyOn(gcDashboardService, "listMeetings");
const getMeetingSpy = vi.spyOn(gcDashboardService, "getMeeting");
const getMeetingPdfUrlSpy = vi.spyOn(gcDashboardService, "getMeetingPdfUrl");
const getDefenseBundleEntriesSpy = vi.spyOn(gcDashboardService, "getDefenseBundleEntries");
const streamJobsiteBundleSpy = vi.spyOn(zipBundleService, "streamBundle");
const listSubcontractorScorecardsSpy = vi.spyOn(scorecardsService, "listSubcontractorScorecards");
const getSubcontractorScorecardSpy = vi.spyOn(scorecardsService, "getSubcontractorScorecard");
const getComplianceRollupSpy = vi.spyOn(policyPushService, "getComplianceRollup");
const listPickerTalksSpy = vi.spyOn(policyPushService, "listPickerTalks");
const pushRequiredTopicSpy = vi.spyOn(policyPushService, "pushRequiredTopic");
const clearRequiredTopicSpy = vi.spyOn(policyPushService, "clearRequiredTopic");
const getAllowedSpy = vi.spyOn(siteScopeService, "getAllowedJobsiteIds");

describe("gc controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    getOverviewSpy.mockReset();
    listMeetingsSpy.mockReset();
    getMeetingSpy.mockReset();
    getMeetingPdfUrlSpy.mockReset();
    getDefenseBundleEntriesSpy.mockReset();
    streamJobsiteBundleSpy.mockReset();
    listSubcontractorScorecardsSpy.mockReset();
    getSubcontractorScorecardSpy.mockReset();
    getComplianceRollupSpy.mockReset();
    listPickerTalksSpy.mockReset();
    pushRequiredTopicSpy.mockReset();
    clearRequiredTopicSpy.mockReset();
    // Real behavior by default: a req.user without the superintendent role is unscoped (null).
    getAllowedSpy.mockReset().mockResolvedValue(null);

    req = {
      params: {},
      query: {},
      user: { id: "user-1", companyId: "gc-1", companyType: "gc" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      headersSent: false,
      destroy: vi.fn(),
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
      expect(getOverviewSpy).toHaveBeenCalledWith("gc-1", {
        date: "2026-09-21",
        tzOffset: 240,
        allowedJobsiteIds: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
      expect(next).not.toHaveBeenCalled();
    });

    it("should scope a superintendent to their assigned jobsites", async () => {
      // Arrange
      req.query = { date: "2026-09-21", tzOffset: "240" };
      req.user = { ...req.user, role: "superintendent", tier: "premium" };
      getAllowedSpy.mockResolvedValue(["site-a"]);
      getOverviewSpy.mockResolvedValue({ jobsites: [], totals: {} });

      // Act
      await getOverview(req, res, next);

      // Assert
      expect(getAllowedSpy).toHaveBeenCalledWith(req.user);
      expect(getOverviewSpy).toHaveBeenCalledWith("gc-1", {
        date: "2026-09-21",
        tzOffset: 240,
        allowedJobsiteIds: ["site-a"],
      });
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
        allowedJobsiteIds: null,
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
      expect(getMeetingSpy).toHaveBeenCalledWith("meeting-1", "gc-1", null);
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
      expect(getMeetingPdfUrlSpy).toHaveBeenCalledWith("meeting-1", "gc-1", null);
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

  describe("listSubcontractorScorecards", () => {
    it("should pass date/tzOffset through and respond with the service's data", async () => {
      // Arrange
      req.query = { date: "2026-09-21", tzOffset: "240" };
      const data = [{ companyId: "sub-1", companyName: "Acme Roofing", overallScore: 87 }];
      listSubcontractorScorecardsSpy.mockResolvedValue(data);

      // Act
      await listSubcontractorScorecards(req, res, next);

      // Assert
      expect(listSubcontractorScorecardsSpy).toHaveBeenCalledWith("gc-1", {
        date: "2026-09-21",
        tzOffset: 240,
        allowedJobsiteIds: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should scope a superintendent to their assigned jobsites", async () => {
      // Arrange
      req.query = { date: "2026-09-21", tzOffset: "240" };
      req.user = { ...req.user, role: "superintendent", tier: "premium" };
      getAllowedSpy.mockResolvedValue(["site-a"]);
      listSubcontractorScorecardsSpy.mockResolvedValue([]);

      // Act
      await listSubcontractorScorecards(req, res, next);

      // Assert
      expect(listSubcontractorScorecardsSpy).toHaveBeenCalledWith("gc-1", {
        date: "2026-09-21",
        tzOffset: 240,
        allowedJobsiteIds: ["site-a"],
      });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      listSubcontractorScorecardsSpy.mockRejectedValue(error);

      // Act
      await listSubcontractorScorecards(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("getSubcontractorScorecard", () => {
    it("should respond with one sub's scorecard from the service", async () => {
      // Arrange
      req.params.companyId = "sub-1";
      req.query = { date: "2026-09-21", tzOffset: "240" };
      const data = { companyId: "sub-1", companyName: "Acme Roofing", overallScore: 87, jobsites: [] };
      getSubcontractorScorecardSpy.mockResolvedValue(data);

      // Act
      await getSubcontractorScorecard(req, res, next);

      // Assert
      expect(getSubcontractorScorecardSpy).toHaveBeenCalledWith("sub-1", "gc-1", {
        date: "2026-09-21",
        tzOffset: 240,
        allowedJobsiteIds: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      getSubcontractorScorecardSpy.mockRejectedValue(error);

      // Act
      await getSubcontractorScorecard(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getPolicyPush", () => {
    it("should pass date/tzOffset through and respond with the service's data", async () => {
      // Arrange
      req.query = { date: "2026-09-21", tzOffset: "240" };
      const data = { talkId: "talk-1", talkTitle: "Fall Protection", jobsites: [], totals: {} };
      getComplianceRollupSpy.mockResolvedValue(data);

      // Act
      await getPolicyPush(req, res, next);

      // Assert
      expect(getComplianceRollupSpy).toHaveBeenCalledWith("gc-1", {
        date: "2026-09-21",
        tzOffset: 240,
        allowedJobsiteIds: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      getComplianceRollupSpy.mockRejectedValue(error);

      // Act
      await getPolicyPush(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("listPolicyPushTalks", () => {
    it("should respond with the picker's talk list", async () => {
      // Arrange
      const data = [{ id: "talk-1", title: "Fall Protection" }];
      listPickerTalksSpy.mockResolvedValue(data);

      // Act
      await listPolicyPushTalks(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      listPickerTalksSpy.mockRejectedValue(error);

      // Act
      await listPolicyPushTalks(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("pushPolicyTopic", () => {
    it("should push the body's talkId under the caller's id and respond with the service's data", async () => {
      // Arrange
      req.body = { talkId: "talk-1" };
      const data = { talkId: "talk-1", talkTitle: "Fall Protection", pushedAt: "now", pushedByName: "Jane" };
      pushRequiredTopicSpy.mockResolvedValue(data);

      // Act
      await pushPolicyTopic(req, res, next);

      // Assert
      expect(pushRequiredTopicSpy).toHaveBeenCalledWith("gc-1", {
        talkId: "talk-1",
        pushedByUserId: "user-1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      req.body = { talkId: "talk-1" };
      const error = new Error("boom");
      pushRequiredTopicSpy.mockRejectedValue(error);

      // Act
      await pushPolicyTopic(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("clearPolicyPush", () => {
    it("should clear the topic and respond with null data", async () => {
      // Arrange
      clearRequiredTopicSpy.mockResolvedValue(undefined);

      // Act
      await clearPolicyPush(req, res, next);

      // Assert
      expect(clearRequiredTopicSpy).toHaveBeenCalledWith("gc-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
    });

    it("should forward a service error to next", async () => {
      // Arrange
      const error = new Error("boom");
      clearRequiredTopicSpy.mockRejectedValue(error);

      // Act
      await clearPolicyPush(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getDefenseBundle", () => {
    it("should set the zip headers and stream the bundle from the service's entries", async () => {
      // Arrange
      req.params.id = "jobsite-1";
      getDefenseBundleEntriesSpy.mockResolvedValue({
        jobsiteName: "Riverside Tower",
        entries: [{ path: "meeting-1/report.pdf", filename: "acme-riverside-tower.pdf" }],
        skippedCount: 1,
      });
      streamJobsiteBundleSpy.mockResolvedValue(undefined);

      // Act
      await getDefenseBundle(req, res, next);

      // Assert
      expect(getDefenseBundleEntriesSpy).toHaveBeenCalledWith("jobsite-1", "gc-1", null);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/zip");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="riverside-tower-defense-bundle.zip"',
      );
      expect(streamJobsiteBundleSpy).toHaveBeenCalledWith(
        [{ path: "meeting-1/report.pdf", filename: "acme-riverside-tower.pdf" }],
        res,
        { skippedCount: 1 },
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.destroy).not.toHaveBeenCalled();
    });

    it("should scope a superintendent to their assigned jobsites", async () => {
      // Arrange
      req.params.id = "jobsite-1";
      req.user = { ...req.user, role: "superintendent", tier: "enterprise" };
      getAllowedSpy.mockResolvedValue(["jobsite-1"]);
      getDefenseBundleEntriesSpy.mockResolvedValue({ jobsiteName: "Site", entries: [], skippedCount: 0 });
      streamJobsiteBundleSpy.mockResolvedValue(undefined);

      // Act
      await getDefenseBundle(req, res, next);

      // Assert
      expect(getDefenseBundleEntriesSpy).toHaveBeenCalledWith("jobsite-1", "gc-1", ["jobsite-1"]);
    });

    it("should forward a service error to next when headers haven't been sent yet", async () => {
      // Arrange
      const error = Object.assign(new Error("Upgrade this job site to Site Pro"), { statusCode: 403 });
      getDefenseBundleEntriesSpy.mockRejectedValue(error);

      // Act
      await getDefenseBundle(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.destroy).not.toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it("should destroy the response instead of calling next when a mid-stream failure happens after headers are sent", async () => {
      // Arrange
      req.params.id = "jobsite-1";
      getDefenseBundleEntriesSpy.mockResolvedValue({ jobsiteName: "Site", entries: [], skippedCount: 0 });
      const streamError = new Error("Could not download the file");
      streamJobsiteBundleSpy.mockRejectedValue(streamError);
      res.headersSent = true;

      // Act
      await getDefenseBundle(req, res, next);

      // Assert
      expect(res.destroy).toHaveBeenCalledWith(streamError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
