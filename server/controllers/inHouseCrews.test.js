// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const inHouseCrewsService = require("../services/inHouseCrews");
const jobsitesService = require("../services/jobsites");
const siteScopeService = require("../services/siteScope");
const companiesService = require("../services/companies");
const companyInvitesService = require("../services/companyInvites");
const crewJoinLinksService = require("../services/crewJoinLinks");
const crewMembersService = require("../services/crewMembers");
const emailService = require("../services/email");
const envUtils = require("../utility/envUtils");
const {
  listCrews,
  createCrew,
  updateCrew,
  deleteCrew,
  attachCrew,
  inviteCrewMember,
  getJoinLink,
  createJoinLink,
  deleteJoinLink,
  previewJoinLink,
  listCrewMembers,
  removeCrewMember,
} = require("./inHouseCrews");

const listSpy = vi.spyOn(inHouseCrewsService, "listForGc");
const createSpy = vi.spyOn(inHouseCrewsService, "create");
const updateSpy = vi.spyOn(inHouseCrewsService, "update");
const removeSpy = vi.spyOn(inHouseCrewsService, "remove");
const attachSpy = vi.spyOn(jobsitesService, "attachInHouseCrew");
const getAllowedSpy = vi.spyOn(siteScopeService, "getAllowedJobsiteIds");
const getOwnedCrewSpy = vi.spyOn(companiesService, "getOwnedCrew");
const createInviteSpy = vi.spyOn(companyInvitesService, "createInvite");
const sendInviteEmailSpy = vi.spyOn(emailService, "sendCompanyInviteEmail");
const keysSpy = vi.spyOn(envUtils, "keysBasedOnEnv");
const getForCrewSpy = vi.spyOn(crewJoinLinksService, "getForCrew");
const createForCrewSpy = vi.spyOn(crewJoinLinksService, "createForCrew");
const removeForCrewSpy = vi.spyOn(crewJoinLinksService, "removeForCrew");
const previewByTokenSpy = vi.spyOn(crewJoinLinksService, "previewByToken");
const listMembersSpy = vi.spyOn(crewMembersService, "listMembers");
const removeMemberSpy = vi.spyOn(crewMembersService, "removeMember");

const crew = {
  id: "crew-1",
  name: "Hyperion - Framing",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("inHouseCrews controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    [listSpy, createSpy, updateSpy, removeSpy, attachSpy].forEach((spy) => spy.mockReset());
    getAllowedSpy.mockReset().mockResolvedValue(null);
    [getOwnedCrewSpy, createInviteSpy].forEach((spy) => spy.mockReset());
    sendInviteEmailSpy.mockReset().mockResolvedValue(undefined);
    keysSpy.mockReset().mockReturnValue({ clientUrl: "https://localhost:5173" });
    req = {
      params: {},
      body: {},
      user: { id: "user-1", name: "Alex Builder", companyId: "gc-1", role: "admin" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listCrews", () => {
    it("returns the caller's GC company's crews", async () => {
      // Arrange
      listSpy.mockResolvedValue([crew]);

      // Act
      await listCrews(req, res, next);

      // Assert
      expect(listSpy).toHaveBeenCalledWith("gc-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [crew] });
    });

    it("forwards a service failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      listSpy.mockRejectedValue(error);

      // Act
      await listCrews(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("createCrew", () => {
    it("creates under the caller's company, ignoring any parent in the body", async () => {
      // Arrange
      req.body = { name: "Hyperion - Framing", parentGcCompanyId: "other-gc" };
      createSpy.mockResolvedValue(crew);

      // Act
      await createCrew(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({
        gcCompanyId: "gc-1",
        name: "Hyperion - Framing",
        jobsiteIds: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: crew });
    });

    it("passes the chosen job site ids through", async () => {
      // Arrange
      req.body = { name: "Hyperion - Framing", jobsiteIds: ["site-1", "site-2"] };
      createSpy.mockResolvedValue(crew);

      // Act
      await createCrew(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({
        gcCompanyId: "gc-1",
        name: "Hyperion - Framing",
        jobsiteIds: ["site-1", "site-2"],
      });
    });

    it("forwards a service failure to next", async () => {
      // Arrange
      const error = new Error("duplicate");
      createSpy.mockRejectedValue(error);

      // Act
      await createCrew(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateCrew", () => {
    it("passes the id, the caller's company and only name/archived", async () => {
      // Arrange
      req.params = { id: "crew-1" };
      req.body = { name: "Renamed", archived: true, tier: "enterprise" };
      updateSpy.mockResolvedValue(crew);

      // Act
      await updateCrew(req, res, next);

      // Assert
      expect(updateSpy).toHaveBeenCalledWith({
        id: "crew-1",
        gcCompanyId: "gc-1",
        patch: { name: "Renamed", archived: true },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: crew });
    });

    it("forwards a service failure to next", async () => {
      // Arrange
      const error = new Error("not found");
      updateSpy.mockRejectedValue(error);

      // Act
      await updateCrew(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteCrew", () => {
    it("deletes within the caller's company", async () => {
      // Arrange
      req.params = { id: "crew-1" };
      removeSpy.mockResolvedValue({ id: "crew-1" });

      // Act
      await deleteCrew(req, res, next);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith({ id: "crew-1", gcCompanyId: "gc-1" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: "crew-1" } });
    });

    it("forwards a service failure to next", async () => {
      // Arrange
      const error = new Error("has history");
      removeSpy.mockRejectedValue(error);

      // Act
      await deleteCrew(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("inviteCrewMember", () => {
    beforeEach(() => {
      req.params = { id: "crew-1" };
      req.body = { email: "foreman@example.com", role: "foreman" };
    });

    it("invites into the crew, emails with the crew name, and omits the token", async () => {
      // Arrange
      getOwnedCrewSpy.mockResolvedValue(crew);
      createInviteSpy.mockResolvedValue({
        id: "invite-1",
        companyId: "crew-1",
        email: "foreman@example.com",
        role: "foreman",
        token: "a".repeat(64),
        expiresAt: "2026-01-08T00:00:00.000Z",
      });

      // Act
      await inviteCrewMember(req, res, next);

      // Assert
      expect(getOwnedCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
      expect(createInviteSpy).toHaveBeenCalledWith("crew-1", "foreman@example.com", "foreman");
      expect(sendInviteEmailSpy).toHaveBeenCalledWith({
        to: "foreman@example.com",
        companyName: "Hyperion - Framing",
        inviterName: "Alex Builder",
        role: "Foreman",
        acceptUrl: `https://localhost:5173/invite/${"a".repeat(64)}`,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { email: "foreman@example.com", role: "foreman" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("falls back to the raw role when it has no label", async () => {
      // Arrange
      getOwnedCrewSpy.mockResolvedValue(crew);
      createInviteSpy.mockResolvedValue({
        email: "foreman@example.com",
        role: "mystery_role",
        token: "b".repeat(64),
      });

      // Act
      await inviteCrewMember(req, res, next);

      // Assert
      expect(sendInviteEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({ role: "mystery_role" }),
      );
    });

    it("forwards the not-found error for a crew the caller's GC does not own", async () => {
      // Arrange
      const error = new Error("Crew not found");
      getOwnedCrewSpy.mockRejectedValue(error);

      // Act
      await inviteCrewMember(req, res, next);

      // Assert
      expect(createInviteSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it("rejects an archived crew with a 409 and sends nothing", async () => {
      // Arrange
      getOwnedCrewSpy.mockResolvedValue({ ...crew, archivedAt: "2026-02-01T00:00:00.000Z" });

      // Act
      await inviteCrewMember(req, res, next);

      // Assert
      expect(createInviteSpy).not.toHaveBeenCalled();
      expect(sendInviteEmailSpy).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(409);
    });

    it("forwards a createInvite failure (e.g. PLAN_LIMIT) without emailing", async () => {
      // Arrange
      const error = new Error("seat limit");
      getOwnedCrewSpy.mockResolvedValue(crew);
      createInviteSpy.mockRejectedValue(error);

      // Act
      await inviteCrewMember(req, res, next);

      // Assert
      expect(sendInviteEmailSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("attachCrew", () => {
    it("attaches the crew to the jobsite with the caller's site scope", async () => {
      // Arrange
      req.params = { id: "jobsite-1", crewId: "crew-1" };
      getAllowedSpy.mockResolvedValue(["jobsite-1"]);
      attachSpy.mockResolvedValue({ alreadyAttached: false });

      // Act
      await attachCrew(req, res, next);

      // Assert
      expect(getAllowedSpy).toHaveBeenCalledWith(req.user);
      expect(attachSpy).toHaveBeenCalledWith({
        jobsiteId: "jobsite-1",
        crewId: "crew-1",
        gcCompanyId: "gc-1",
        allowedJobsiteIds: ["jobsite-1"],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { alreadyAttached: false } });
    });

    it("forwards a service failure to next", async () => {
      // Arrange
      const error = new Error("archived");
      attachSpy.mockRejectedValue(error);

      // Act
      await attachCrew(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

describe("inHouseCrews controller: join link and members (Phase 13f-join)", () => {
  const TOKEN = "a".repeat(64);
  const link = { token: TOKEN, expiresAt: "2026-02-01T00:00:00.000Z", usesLeft: 7 };
  const joinUrl = `https://localhost:5173/crew-join/${TOKEN}`;
  let req;
  let res;
  let next;

  beforeEach(() => {
    [
      getForCrewSpy,
      createForCrewSpy,
      removeForCrewSpy,
      previewByTokenSpy,
      listMembersSpy,
      removeMemberSpy,
    ].forEach((spy) => spy.mockReset());
    keysSpy.mockReset().mockReturnValue({ clientUrl: "https://localhost:5173" });
    req = {
      params: { id: "crew-1" },
      body: {},
      user: { id: "user-1", name: "Alex Builder", companyId: "gc-1", role: "admin" },
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  it("getJoinLink returns the link as a URL, never the bare token", async () => {
    getForCrewSpy.mockResolvedValue(link);

    await getJoinLink(req, res, next);

    expect(getForCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { joinUrl, expiresAt: link.expiresAt, usesLeft: 7 },
    });
  });

  it("getJoinLink returns null when the crew has no link", async () => {
    getForCrewSpy.mockResolvedValue(null);

    await getJoinLink(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it("createJoinLink returns 201 with the new URL", async () => {
    createForCrewSpy.mockResolvedValue(link);

    await createJoinLink(req, res, next);

    expect(createForCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { joinUrl, expiresAt: link.expiresAt, usesLeft: 7 },
    });
  });

  it("deleteJoinLink turns the link off", async () => {
    removeForCrewSpy.mockResolvedValue(undefined);

    await deleteJoinLink(req, res, next);

    expect(removeForCrewSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it("previewJoinLink returns the public preview for the token", async () => {
    req.params = { token: TOKEN };
    previewByTokenSpy.mockResolvedValue({ crewName: "Crew", gcName: "GC" });

    await previewJoinLink(req, res, next);

    expect(previewByTokenSpy).toHaveBeenCalledWith(TOKEN);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { crewName: "Crew", gcName: "GC" },
    });
  });

  it("listCrewMembers returns the crew's people", async () => {
    const people = [{ id: "u1", name: "Jamie", role: "foreman", email: "j@example.com" }];
    listMembersSpy.mockResolvedValue(people);

    await listCrewMembers(req, res, next);

    expect(listMembersSpy).toHaveBeenCalledWith("crew-1", "gc-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: people });
  });

  it("removeCrewMember removes the person from the crew", async () => {
    req.params = { id: "crew-1", userId: "u1" };
    removeMemberSpy.mockResolvedValue(undefined);

    await removeCrewMember(req, res, next);

    expect(removeMemberSpy).toHaveBeenCalledWith("crew-1", "u1", "gc-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it.each([
    ["getJoinLink", getJoinLink, getForCrewSpy],
    ["createJoinLink", createJoinLink, createForCrewSpy],
    ["deleteJoinLink", deleteJoinLink, removeForCrewSpy],
    ["previewJoinLink", previewJoinLink, previewByTokenSpy],
    ["listCrewMembers", listCrewMembers, listMembersSpy],
    ["removeCrewMember", removeCrewMember, removeMemberSpy],
  ])("%s forwards a service failure to next", async (_name, handler, spy) => {
    const error = new Error("boom");
    spy.mockRejectedValue(error);

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
