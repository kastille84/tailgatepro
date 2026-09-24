// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const companyInvitesService = require("../services/companyInvites");
const companiesService = require("../services/companies");
const emailService = require("../services/email");
const envUtils = require("../utility/envUtils");
const { inviteTeammate, previewInvite } = require("./companyInvites");

const createInviteSpy = vi.spyOn(companyInvitesService, "createInvite");
const previewInviteSpy = vi.spyOn(companyInvitesService, "previewInvite");
const getByIdSpy = vi.spyOn(companiesService, "getById");
const sendCompanyInviteEmailSpy = vi.spyOn(emailService, "sendCompanyInviteEmail");
const keysSpy = vi.spyOn(envUtils, "keysBasedOnEnv");

describe("companyInvites controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    createInviteSpy.mockReset();
    previewInviteSpy.mockReset();
    getByIdSpy.mockReset();
    sendCompanyInviteEmailSpy.mockReset().mockResolvedValue(undefined);
    keysSpy.mockReset().mockReturnValue({ clientUrl: "https://localhost:5173" });

    req = {
      params: {},
      body: {},
      user: { id: "user-1", name: "Alex Builder", companyId: "company-1", role: "admin" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("inviteTeammate", () => {
    beforeEach(() => {
      req.body = { email: "newhire@example.com", role: "foreman" };
    });

    it("creates the invite, emails it, and responds 201 without the token", async () => {
      // Arrange
      createInviteSpy.mockResolvedValue({
        id: "invite-1",
        companyId: "company-1",
        email: "newhire@example.com",
        role: "foreman",
        token: "a".repeat(64),
        expiresAt: "2026-01-08T00:00:00.000Z",
      });
      getByIdSpy.mockResolvedValue({ id: "company-1", name: "Rivera Electric" });

      // Act
      await inviteTeammate(req, res, next);

      // Assert
      expect(createInviteSpy).toHaveBeenCalledWith("company-1", "newhire@example.com", "foreman");
      expect(getByIdSpy).toHaveBeenCalledWith("company-1");
      expect(sendCompanyInviteEmailSpy).toHaveBeenCalledWith({
        to: "newhire@example.com",
        companyName: "Rivera Electric",
        inviterName: "Alex Builder",
        role: "Foreman",
        acceptUrl: `https://localhost:5173/invite/${"a".repeat(64)}`,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { email: "newhire@example.com", role: "foreman" },
      });
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.token).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards a createInvite failure to next", async () => {
      // Arrange
      const error = new Error("boom");
      createInviteSpy.mockRejectedValue(error);

      // Act
      await inviteTeammate(req, res, next);

      // Assert
      expect(getByIdSpy).not.toHaveBeenCalled();
      expect(sendCompanyInviteEmailSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("previewInvite", () => {
    beforeEach(() => {
      req.params = { token: "a".repeat(64) };
    });

    it("returns the invite preview", async () => {
      // Arrange
      previewInviteSpy.mockResolvedValue({
        companyName: "Rivera Electric",
        email: "newhire@example.com",
        role: "foreman",
      });

      // Act
      await previewInvite(req, res, next);

      // Assert
      expect(previewInviteSpy).toHaveBeenCalledWith("a".repeat(64));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { companyName: "Rivera Electric", email: "newhire@example.com", role: "foreman" },
      });
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
});
