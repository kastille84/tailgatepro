// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const talksService = require("../services/talks");
const talkVisibilityService = require("../services/talkVisibility");
const translationService = require("../services/translation");
const {
  listTalks,
  getTalk,
  createTalk,
  updateTalk,
  deleteTalk,
  listTranslationLanguages,
  generateTalk,
  getAiUsage,
} = require("./talks");
const talkGenerationService = require("../services/talkGeneration");

const listForCompanySpy = vi.spyOn(talksService, "listForCompany");
const getByIdSpy = vi.spyOn(talksService, "getById");
const createSpy = vi.spyOn(talksService, "create");
const updateSpy = vi.spyOn(talksService, "update");
const removeSpy = vi.spyOn(talksService, "remove");
const resolveVisibilitySpy = vi.spyOn(talkVisibilityService, "resolveTalkVisibility");
const getSupportedLanguagesSpy = vi.spyOn(
  translationService,
  "getSupportedLanguages",
);

const generateDraftSpy = vi.spyOn(talkGenerationService, "generateTalkDraft");
const getUsageSpy = vi.spyOn(talkGenerationService, "getUsage");

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
    resolveVisibilitySpy
      .mockReset()
      .mockResolvedValue({ fullLibrary: true, gcCompanyIds: [] });
    getSupportedLanguagesSpy.mockReset();
    generateDraftSpy.mockReset();
    getUsageSpy.mockReset();
    req = {
      params: {},
      body: {},
      user: {
        id: "user-1",
        companyId: "company-1",
        companyType: "subcontractor",
        tier: "premium",
        role: "foreman",
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
      expect(resolveVisibilitySpy).toHaveBeenCalledWith(req.user);
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", {
        fullLibrary: true,
        gcCompanyIds: [],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [talk] });
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the resolved visibility (core-only library, the sub's GCs) to the service", async () => {
      // Arrange
      const visibility = { fullLibrary: false, gcCompanyIds: ["gc-1"] };
      resolveVisibilitySpy.mockResolvedValue(visibility);
      listForCompanySpy.mockResolvedValue([talk]);

      // Act
      await listTalks(req, res, next);

      // Assert
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1", visibility);
    });

    it("should forward a visibility-lookup error to next()", async () => {
      // Arrange
      const error = new Error("membership lookup failed");
      resolveVisibilitySpy.mockRejectedValue(error);

      // Act
      await listTalks(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(listForCompanySpy).not.toHaveBeenCalled();
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
        gcCompanyIds: [],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: talk });
      expect(next).not.toHaveBeenCalled();
    });

    it("should scope the lookup to the resolved visibility (core-only library, the sub's GCs)", async () => {
      // Arrange
      const visibility = { fullLibrary: false, gcCompanyIds: ["gc-1"] };
      resolveVisibilitySpy.mockResolvedValue(visibility);
      req.params = { id: "talk-1" };
      getByIdSpy.mockResolvedValue(talk);

      // Act
      await getTalk(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("talk-1", "company-1", visibility);
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

    it.each(["admin", "safety_manager"])(
      "should let a GC Portfolio %s author a company talk",
      async (role) => {
        // Arrange
        req.user.companyType = "gc";
        req.user.tier = "premium";
        req.user.role = role;
        createSpy.mockResolvedValue(customTalk);

        // Act
        await createTalk(req, res, next);

        // Assert
        expect(createSpy).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
      },
    );

    it.each(["superintendent", "foreman"])(
      "should reject a GC Portfolio %s with a 403, without calling the service",
      async (role) => {
        // Arrange
        req.user.companyType = "gc";
        req.user.tier = "premium";
        req.user.role = role;

        // Act
        await createTalk(req, res, next);

        // Assert
        expect(createSpy).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
            message: "Only a safety director or admin can write company talks",
          }),
        );
      },
    );

    it("should let a subcontractor foreman author regardless of the manager-role rule", async () => {
      // Arrange
      req.user.role = "foreman";
      createSpy.mockResolvedValue(customTalk);

      // Act
      await createTalk(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should reject a non-Portfolio GC with a 403, without calling the service", async () => {
      // Arrange
      req.user.companyType = "gc";
      req.user.tier = "basic";

      // Act
      await createTalk(req, res, next);

      // Assert
      expect(createSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to GC Portfolio to create company talks",
        }),
      );
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

    it("should let a GC Portfolio safety manager edit a company talk", async () => {
      // Arrange
      req.user.companyType = "gc";
      req.user.tier = "premium";
      req.user.role = "safety_manager";
      updateSpy.mockResolvedValue(updatedTalk);

      // Act
      await updateTalk(req, res, next);

      // Assert
      expect(updateSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject a GC Portfolio superintendent with a 403, without calling the service", async () => {
      // Arrange
      req.user.companyType = "gc";
      req.user.tier = "premium";
      req.user.role = "superintendent";

      // Act
      await updateTalk(req, res, next);

      // Assert
      expect(updateSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Only a safety director or admin can write company talks",
        }),
      );
    });

    it("should reject a non-Portfolio GC with a 403, without calling the service", async () => {
      // Arrange
      req.user.companyType = "gc";
      req.user.tier = "basic";

      // Act
      await updateTalk(req, res, next);

      // Assert
      expect(updateSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to GC Portfolio to create company talks",
        }),
      );
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

  describe("generateTalk / getAiUsage (AI Talk Builder)", () => {
    it("should respond 200 with the draft and usage for a Trade Pro caller", async () => {
      // Arrange
      req.body = { topic: "trenching", tradeTag: "Concrete" };
      const result = { draft: { title: "Trench Safety" }, usage: { used: 1, limit: 10, remaining: 9 } };
      generateDraftSpy.mockResolvedValue(result);

      // Act
      await generateTalk(req, res, next);

      // Assert
      expect(generateDraftSpy).toHaveBeenCalledWith({
        user: req.user,
        topic: "trenching",
        tradeTag: "Concrete",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
    });

    it("should reject Trade Free with a 403 upgrade message without calling the service", async () => {
      // Arrange
      req.user.tier = "basic";
      req.body = { topic: "trenching" };

      // Act
      await generateTalk(req, res, next);

      // Assert
      expect(generateDraftSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Upgrade to Trade Pro to unlock the AI Talk Builder",
        }),
      );
    });

    it("should apply the GC plan and role gates before the AI gate", async () => {
      // Arrange
      req.user = { ...req.user, companyType: "gc", tier: "basic", role: "admin" };

      // Act
      await generateTalk(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Upgrade to GC Portfolio to create company talks" }),
      );

      // Arrange: Portfolio but not a manager role
      next.mockReset();
      req.user = { ...req.user, tier: "premium", role: "superintendent" };

      // Act
      await generateTalk(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Only a safety director or admin can write company talks" }),
      );
      expect(generateDraftSpy).not.toHaveBeenCalled();
    });

    it("should allow a GC Portfolio manager", async () => {
      // Arrange
      req.user = { ...req.user, companyType: "gc", tier: "premium", role: "safety_manager" };
      req.body = { topic: "crane lift" };
      generateDraftSpy.mockResolvedValue({ draft: {}, usage: {} });

      // Act
      await generateTalk(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should forward a service error (e.g. the 429 cap) to next()", async () => {
      // Arrange
      req.body = { topic: "trenching" };
      const error = new Error("cap");
      generateDraftSpy.mockRejectedValue(error);

      // Act
      await generateTalk(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });

    it("getAiUsage should respond 200 with this month's usage", async () => {
      // Arrange
      const usage = { used: 2, limit: 10, remaining: 8 };
      getUsageSpy.mockResolvedValue(usage);

      // Act
      await getAiUsage(req, res, next);

      // Assert
      expect(getUsageSpy).toHaveBeenCalledWith(req.user);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: usage });
    });

    it("getAiUsage should 403 without access and forward service errors", async () => {
      // Arrange
      req.user.tier = "basic";

      // Act
      await getAiUsage(req, res, next);

      // Assert
      expect(getUsageSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));

      // Arrange
      next.mockReset();
      req.user.tier = "premium";
      const error = new Error("boom");
      getUsageSpy.mockRejectedValue(error);

      // Act
      await getAiUsage(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
