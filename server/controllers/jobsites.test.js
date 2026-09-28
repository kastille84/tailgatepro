// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const jobsitesService = require("../services/jobsites");
const emailService = require("../services/email");
const envUtils = require("../utility/envUtils");
const siteScopeService = require("../services/siteScope");
const {
  listJobsites,
  createJobsite,
  updateJobsite,
  inviteSubcontractor,
  previewInvite,
  acceptInvite,
  getJoinLink,
  previewJoinLink,
  acceptJoinLink,
  removeSubcontractor,
  listMembers,
  setMembers,
} = require("./jobsites");
const jobsiteMembersService = require("../services/jobsiteMembers");
const listMembersSpy = vi.spyOn(jobsiteMembersService, "listForJobsite");
const setMembersSpy = vi.spyOn(jobsiteMembersService, "setMembers");

const listForGcSpy = vi.spyOn(jobsitesService, "listForGc");
const createSpy = vi.spyOn(jobsitesService, "create");
const updateSpy = vi.spyOn(jobsitesService, "update");
const createInviteSpy = vi.spyOn(jobsitesService, "createInvite");
const previewInviteSpy = vi.spyOn(jobsitesService, "previewInvite");
const acceptInviteSpy = vi.spyOn(jobsitesService, "acceptInvite");
const getOrCreateJoinTokenSpy = vi.spyOn(jobsitesService, "getOrCreateJoinToken");
const previewJoinLinkSpy = vi.spyOn(jobsitesService, "previewJoinLink");
const acceptJoinLinkSpy = vi.spyOn(jobsitesService, "acceptJoinLink");
const removeSubcontractorSpy = vi.spyOn(jobsitesService, "removeSubcontractor");
const sendJobsiteInviteEmailSpy = vi.spyOn(emailService, "sendJobsiteInviteEmail");
const keysSpy = vi.spyOn(envUtils, "keysBasedOnEnv");
// The test users below are admins, so real behavior is "unscoped" (null).
const getAllowedSpy = vi.spyOn(siteScopeService, "getAllowedJobsiteIds");

const jobsite = {
  id: "jobsite-1",
  gcCompanyId: "gc-1",
  name: "Riverside Tower",
  status: "active",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("jobsites controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    getAllowedSpy.mockReset().mockResolvedValue(null);
    listForGcSpy.mockReset();
    createSpy.mockReset();
    updateSpy.mockReset();
    req = {
      params: {},
      body: {},
      user: { id: "user-1", companyId: "gc-1", role: "admin" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listJobsites", () => {
    it("returns the caller's GC company's jobsites", async () => {
      // Arrange
      listForGcSpy.mockResolvedValue([jobsite]);

      // Act
      await listJobsites(req, res, next);

      // Assert
      expect(listForGcSpy).toHaveBeenCalledWith("gc-1", null);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [jobsite] });
      expect(next).not.toHaveBeenCalled();
    });

    it("limits a superintendent to their assigned jobsites", async () => {
      // Arrange
      req.user = { ...req.user, role: "superintendent", companyType: "gc", tier: "premium" };
      getAllowedSpy.mockResolvedValueOnce(["jobsite-1"]);
      listForGcSpy.mockResolvedValue([jobsite]);

      // Act
      await listJobsites(req, res, next);

      // Assert
      expect(getAllowedSpy).toHaveBeenCalledWith(req.user);
      expect(listForGcSpy).toHaveBeenCalledWith("gc-1", ["jobsite-1"]);
    });

    it("forwards a jobsitesService.listForGc failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      listForGcSpy.mockRejectedValue(error);

      // Act
      await listJobsites(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createJobsite", () => {
    it("creates a jobsite for the caller's GC company", async () => {
      // Arrange
      req.body = { name: "Riverside Tower" };
      createSpy.mockResolvedValue(jobsite);

      // Act
      await createJobsite(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({ gcCompanyId: "gc-1", name: "Riverside Tower" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: jobsite });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards a jobsitesService.create failure to next", async () => {
      // Arrange
      req.body = { name: "Riverside Tower" };
      const error = new Error("boom");
      createSpy.mockRejectedValue(error);

      // Act
      await createJobsite(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateJobsite", () => {
    it("patches a jobsite the caller's GC company owns", async () => {
      // Arrange
      req.params.id = "jobsite-1";
      req.body = { name: "New Name", status: "completed", archived: true };
      updateSpy.mockResolvedValue(jobsite);

      // Act
      await updateJobsite(req, res, next);

      // Assert
      expect(updateSpy).toHaveBeenCalledWith({
        id: "jobsite-1",
        gcCompanyId: "gc-1",
        patch: { name: "New Name", status: "completed", archived: true },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: jobsite });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards a jobsitesService.update failure to next", async () => {
      // Arrange
      req.params.id = "jobsite-1";
      const error = new Error("boom");
      updateSpy.mockRejectedValue(error);

      // Act
      await updateJobsite(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

describe("jobsites controller: invites (Phase 8d)", () => {
  const TOKEN = "a".repeat(64);
  let req;
  let res;
  let next;

  beforeEach(() => {
    getAllowedSpy.mockReset().mockResolvedValue(null);
    createInviteSpy.mockReset();
    previewInviteSpy.mockReset();
    acceptInviteSpy.mockReset();
    getOrCreateJoinTokenSpy.mockReset();
    previewJoinLinkSpy.mockReset();
    acceptJoinLinkSpy.mockReset();
    removeSubcontractorSpy.mockReset();
    sendJobsiteInviteEmailSpy.mockReset().mockResolvedValue(undefined);
    keysSpy.mockReset().mockReturnValue({ clientUrl: "https://localhost:5173" });

    req = {
      params: {},
      body: {},
      userEmail: "jane@acme.com",
      user: { id: "user-1", name: "Alex Builder", companyId: "gc-1", role: "admin" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("inviteSubcontractor", () => {
    beforeEach(() => {
      req.params = { id: "jobsite-1" };
      req.body = { email: "jane@acme.com" };
    });

    it("creates the invite, emails the accept link, and responds 201 with only the email (never the token)", async () => {
      // Arrange
      createInviteSpy.mockResolvedValue({
        id: "roster-1",
        jobsiteId: "jobsite-1",
        email: "jane@acme.com",
        token: TOKEN,
        expiresAt: "2026-01-08T00:00:00.000Z",
        jobsiteName: "Riverside Tower",
        gcCompanyName: "Turner Construction",
      });

      // Act
      await inviteSubcontractor(req, res, next);

      // Assert
      expect(createInviteSpy).toHaveBeenCalledWith({
        jobsiteId: "jobsite-1",
        gcCompanyId: "gc-1",
        email: "jane@acme.com",
        allowedJobsiteIds: null,
      });
      expect(sendJobsiteInviteEmailSpy).toHaveBeenCalledWith({
        to: "jane@acme.com",
        gcCompanyName: "Turner Construction",
        jobsiteName: "Riverside Tower",
        inviterName: "Alex Builder",
        acceptUrl: `https://localhost:5173/jobsite-invite/${TOKEN}`,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { email: "jane@acme.com" } });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards a createInvite failure to next without sending an email", async () => {
      // Arrange
      const error = new Error("boom");
      createInviteSpy.mockRejectedValue(error);

      // Act
      await inviteSubcontractor(req, res, next);

      // Assert
      expect(sendJobsiteInviteEmailSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("previewInvite", () => {
    beforeEach(() => {
      req.params = { token: TOKEN };
    });

    it("returns the invite preview", async () => {
      // Arrange
      const preview = { gcCompanyName: "Turner Construction", jobsiteName: "Riverside Tower", email: "jane@acme.com" };
      previewInviteSpy.mockResolvedValue(preview);

      // Act
      await previewInvite(req, res, next);

      // Assert
      expect(previewInviteSpy).toHaveBeenCalledWith(TOKEN);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: preview });
    });

    it("forwards a previewInvite failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      previewInviteSpy.mockRejectedValue(error);

      // Act
      await previewInvite(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("acceptInvite", () => {
    beforeEach(() => {
      req.params = { token: TOKEN };
      req.body = { email: "someone-else@evil.com" };
      req.user = { id: "user-2", name: "Jane", companyId: "company-9", role: "admin" };
    });

    it("accepts using the token-verified req.userEmail (never the body) and the caller's company, responding 200 with the project", async () => {
      // Arrange
      const project = { id: "project-9", jobsiteId: "jobsite-1" };
      acceptInviteSpy.mockResolvedValue(project);

      // Act
      await acceptInvite(req, res, next);

      // Assert
      expect(acceptInviteSpy).toHaveBeenCalledWith({
        token: TOKEN,
        email: "jane@acme.com",
        companyId: "company-9",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: project });
    });

    it("forwards an acceptInvite failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      acceptInviteSpy.mockRejectedValue(error);

      // Act
      await acceptInvite(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getJoinLink (Phase 9e)", () => {
    beforeEach(() => {
      req.params = { id: "jobsite-1" };
    });

    it("creates/reads the join token and responds 200 with the full join URL", async () => {
      // Arrange
      getOrCreateJoinTokenSpy.mockResolvedValue("b".repeat(64));

      // Act
      await getJoinLink(req, res, next);

      // Assert
      expect(getOrCreateJoinTokenSpy).toHaveBeenCalledWith({
        jobsiteId: "jobsite-1",
        gcCompanyId: "gc-1",
        allowedJobsiteIds: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { joinUrl: `https://localhost:5173/jobsite-join/${"b".repeat(64)}` },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards a getOrCreateJoinToken failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      getOrCreateJoinTokenSpy.mockRejectedValue(error);

      // Act
      await getJoinLink(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("previewJoinLink (Phase 9e)", () => {
    beforeEach(() => {
      req.params = { token: TOKEN };
    });

    it("returns the join link preview", async () => {
      // Arrange
      const preview = { gcCompanyName: "Turner Construction", jobsiteName: "Riverside Tower" };
      previewJoinLinkSpy.mockResolvedValue(preview);

      // Act
      await previewJoinLink(req, res, next);

      // Assert
      expect(previewJoinLinkSpy).toHaveBeenCalledWith(TOKEN);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: preview });
    });

    it("forwards a previewJoinLink failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      previewJoinLinkSpy.mockRejectedValue(error);

      // Act
      await previewJoinLink(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("acceptJoinLink (Phase 9e)", () => {
    beforeEach(() => {
      req.params = { token: TOKEN };
      req.user = { id: "user-2", name: "Jane", companyId: "company-9", role: "admin" };
    });

    it("accepts using the caller's own company (no email involved) and responds 200 with the result", async () => {
      // Arrange
      const result = { id: "project-9", jobsiteId: "jobsite-1", alreadyMember: false };
      acceptJoinLinkSpy.mockResolvedValue(result);

      // Act
      await acceptJoinLink(req, res, next);

      // Assert
      expect(acceptJoinLinkSpy).toHaveBeenCalledWith({ token: TOKEN, companyId: "company-9" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
    });

    it("forwards an acceptJoinLink failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      acceptJoinLinkSpy.mockRejectedValue(error);

      // Act
      await acceptJoinLink(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("members (Phase 9d-2)", () => {
    beforeEach(() => {
      listMembersSpy.mockReset();
      setMembersSpy.mockReset();
      req.params = { id: "jobsite-1" };
    });

    it("listMembers responds 200 with the jobsite's superintendents for the caller's company", async () => {
      // Arrange
      const data = { members: [{ userId: "u-1", name: "Ann", assigned: true }] };
      listMembersSpy.mockResolvedValue(data);

      // Act
      await listMembers(req, res, next);

      // Assert
      expect(listMembersSpy).toHaveBeenCalledWith({ jobsiteId: "jobsite-1", gcCompanyId: "gc-1" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("listMembers forwards a failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      listMembersSpy.mockRejectedValue(error);

      // Act
      await listMembers(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });

    it("setMembers assigns the given users scoped to the caller's company and responds 200", async () => {
      // Arrange
      req.body = { userIds: ["u-1"] };
      const data = { members: [] };
      setMembersSpy.mockResolvedValue(data);

      // Act
      await setMembers(req, res, next);

      // Assert
      expect(setMembersSpy).toHaveBeenCalledWith({
        jobsiteId: "jobsite-1",
        gcCompanyId: "gc-1",
        userIds: ["u-1"],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("setMembers forwards a failure to next", async () => {
      // Arrange
      req.body = { userIds: [] };
      const error = new Error("boom");
      setMembersSpy.mockRejectedValue(error);

      // Act
      await setMembers(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("removeSubcontractor", () => {
    beforeEach(() => {
      req.params = { id: "jobsite-1", subId: "roster-1" };
    });

    it("removes the sub scoped to the caller's GC company and responds 200", async () => {
      // Arrange
      removeSubcontractorSpy.mockResolvedValue({ id: "roster-1" });

      // Act
      await removeSubcontractor(req, res, next);

      // Assert
      expect(removeSubcontractorSpy).toHaveBeenCalledWith({
        jobsiteId: "jobsite-1",
        subId: "roster-1",
        gcCompanyId: "gc-1",
        allowedJobsiteIds: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: "roster-1" } });
    });

    it("forwards a removeSubcontractor failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      removeSubcontractorSpy.mockRejectedValue(error);

      // Act
      await removeSubcontractor(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
