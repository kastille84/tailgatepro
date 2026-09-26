// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const talksService = require("../services/talks");
const translationService = require("../services/translation");
const {
  listTalks,
  getTalk,
  createTalk,
  updateTalk,
  deleteTalk,
  listTranslationLanguages,
} = require("./talks");

const listForCompanySpy = vi.spyOn(talksService, "listForCompany");
const getByIdSpy = vi.spyOn(talksService, "getById");
const createSpy = vi.spyOn(talksService, "create");
const updateSpy = vi.spyOn(talksService, "update");
const removeSpy = vi.spyOn(talksService, "remove");
const getSupportedLanguagesSpy = vi.spyOn(
  translationService,
  "getSupportedLanguages",
);

const talk = {
  id: "talk-1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction", "Welding"],
  content: "# Eye Protection on the Jobsite\n",
  structured: { summary: "...", talking_points: [] },
  attribution: { source: "NIOSH" },
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("talks controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    listForCompanySpy.mockReset();
    getByIdSpy.mockReset();
    createSpy.mockReset();
    updateSpy.mockReset();
    removeSpy.mockReset();
    getSupportedLanguagesSpy.mockReset();
    req = {
      params: {},
      body: {},
      user: {
        id: "user-1",
        companyId: "company-1",
        companyType: "subcontractor",
        tier: "premium",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listTalks", () => {
    it("should respond 200 with every talk visible to the caller's company", async () => {
      // Arrange
      listForCompanySpy.mockResolvedValue([talk]);

      // Act
      await listTalks(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        fullLibrary: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [talk] });
      expect(next).not.toHaveBeenCalled();
    });

    it("should narrow the list to core talks for a Trade Free caller", async () => {
      // Arrange
      req.user.tier = "basic";
      listForCompanySpy.mockResolvedValue([talk]);

      // Act
      await listTalks(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        fullLibrary: false,
      });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      listForCompanySpy.mockRejectedValue(error);

      // Act
      await listTalks(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getTalk", () => {
    it("should call the service with req.params.id + the caller's companyId and respond 200", async () => {
      // Arrange
      req.params = { id: "talk-1" };
      getByIdSpy.mockResolvedValue(talk);

      // Act
      await getTalk(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("talk-1", "company-1", {
        fullLibrary: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: talk });
      expect(next).not.toHaveBeenCalled();
    });

    it("should scope a Trade Free caller to core talks", async () => {
      // Arrange
      req.user.tier = "basic";
      req.params = { id: "talk-1" };
      getByIdSpy.mockResolvedValue(talk);

      // Act
      await getTalk(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("talk-1", "company-1", {
        fullLibrary: false,
      });
    });

    it("should forward a service error to next() (e.g. the 404 not-found case)", async () => {
      // Arrange
      req.params = { id: "missing" };
      const error = new Error("Talk not found");
      getByIdSpy.mockRejectedValue(error);

      // Act
      await getTalk(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("createTalk", () => {
    const customTalk = { ...talk, id: "talk-2", isGlobal: false, companyId: "company-1" };

    beforeEach(() => {
      req.body = {
        id: "talk-2",
        title: "Ladder Safety Refresher",
        tradeTag: "Roofing",
        summary: "Keep three points of contact.",
        talkingPoints: ["Inspect rungs before use"],
        siteHazardsToCheck: [],
        discussionQuestions: [],
        oshaStandards: [],
        estimatedMinutes: 5,
      };
    });

    it("should call the service with the assembled fields + the caller's companyId and respond 201", async () => {
      // Arrange
      createSpy.mockResolvedValue(customTalk);

      // Act
      await createTalk(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({
        id: "talk-2",
        companyId: "company-1",
        title: "Ladder Safety Refresher",
        tradeTag: "Roofing",
        summary: "Keep three points of contact.",
        talkingPoints: ["Inspect rungs before use"],
        siteHazardsToCheck: [],
        discussionQuestions: [],
        oshaStandards: [],
        estimatedMinutes: 5,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: customTalk });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      createSpy.mockRejectedValue(error);

      // Act
      await createTalk(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should pass targetLanguages through to the service when the caller's tier has translation access", async () => {
      // Arrange
      req.body.targetLanguages = ["es"];
      req.user.tier = "premium";
      createSpy.mockResolvedValue(customTalk);

      // Act
      await createTalk(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ targetLanguages: ["es"] }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should reject with a 403 AppError, without calling the service, when targetLanguages is given but the tier lacks translation access", async () => {
      // Arrange
      req.body.targetLanguages = ["es"];
      req.user.tier = "basic";

      // Act
      await createTalk(req, res, next);

      // Assert
      expect(createSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to Trade Pro to unlock multi-language talks",
        }),
      );
    });

    it("should not require translation access when targetLanguages isn't given", async () => {
      // Arrange
      req.user.tier = "basic";
      createSpy.mockResolvedValue(customTalk);

      // Act
      await createTalk(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateTalk", () => {
    const updatedTalk = { ...talk, id: "talk-2", isGlobal: false, companyId: "company-1" };

    beforeEach(() => {
      req.params = { id: "talk-2" };
      req.body = {
        title: "Ladder Safety Refresher (Updated)",
        tradeTag: "Roofing",
        summary: "Keep three points of contact.",
        talkingPoints: ["Inspect rungs before use"],
        siteHazardsToCheck: [],
        discussionQuestions: [],
        oshaStandards: [],
        estimatedMinutes: 5,
      };
    });

    it("should call the service with req.params.id, the assembled body fields, and the caller's companyId, and respond 200", async () => {
      // Arrange
      updateSpy.mockResolvedValue(updatedTalk);

      // Act
      await updateTalk(req, res, next);

      // Assert
      expect(updateSpy).toHaveBeenCalledWith({
        id: "talk-2",
        companyId: "company-1",
        title: "Ladder Safety Refresher (Updated)",
        tradeTag: "Roofing",
        summary: "Keep three points of contact.",
        talkingPoints: ["Inspect rungs before use"],
        siteHazardsToCheck: [],
        discussionQuestions: [],
        oshaStandards: [],
        estimatedMinutes: 5,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedTalk });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next() (e.g. the 409 in-use guard or 404 not-found)", async () => {
      // Arrange
      const error = new Error("Talk not found");
      updateSpy.mockRejectedValue(error);

      // Act
      await updateTalk(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should pass targetLanguages through to the service when the caller's tier has translation access", async () => {
      // Arrange
      req.body.targetLanguages = ["es"];
      req.user.tier = "enterprise";
      updateSpy.mockResolvedValue(updatedTalk);

      // Act
      await updateTalk(req, res, next);

      // Assert
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ targetLanguages: ["es"] }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject with a 403 AppError, without calling the service, when targetLanguages is given but the tier lacks translation access", async () => {
      // Arrange
      req.body.targetLanguages = ["es"];
      req.user.tier = "basic";

      // Act
      await updateTalk(req, res, next);

      // Assert
      expect(updateSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to Trade Pro to unlock multi-language talks",
        }),
      );
    });
  });

  describe("deleteTalk", () => {
    it("should call the service with req.params.id and the caller's companyId, and respond 200", async () => {
      // Arrange
      req.params = { id: "talk-2" };
      removeSpy.mockResolvedValue({ id: "talk-2" });

      // Act
      await deleteTalk(req, res, next);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith({
        id: "talk-2",
        companyId: "company-1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: "talk-2" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next() (e.g. the 409 in-use guard)", async () => {
      // Arrange
      req.params = { id: "talk-2" };
      const error = new Error(
        "This talk has been used in a logged safety talk and can't be edited or deleted.",
      );
      removeSpy.mockRejectedValue(error);

      // Act
      await deleteTalk(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("listTranslationLanguages", () => {
    it("should respond 200 with the supported languages when the caller's tier has translation access", async () => {
      // Arrange
      req.user.tier = "premium";
      getSupportedLanguagesSpy.mockResolvedValue([{ code: "es", name: "Spanish" }]);

      // Act
      await listTranslationLanguages(req, res, next);

      // Assert
      expect(getSupportedLanguagesSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ code: "es", name: "Spanish" }],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject with a 403 AppError, without calling the service, when the caller's tier lacks translation access", async () => {
      // Arrange
      req.user.tier = "basic";

      // Act
      await listTranslationLanguages(req, res, next);

      // Assert
      expect(getSupportedLanguagesSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to Trade Pro to unlock multi-language talks",
        }),
      );
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      req.user.tier = "premium";
      const error = new Error("boom");
      getSupportedLanguagesSpy.mockRejectedValue(error);

      // Act
      await listTranslationLanguages(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
