// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const talksService = require("../services/talks");
const { listTalks, getTalk, createTalk } = require("./talks");

const listForCompanySpy = vi.spyOn(talksService, "listForCompany");
const getByIdSpy = vi.spyOn(talksService, "getById");
const createSpy = vi.spyOn(talksService, "create");

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
    req = { params: {}, body: {}, user: { id: "user-1", companyId: "company-1" } };
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
      expect(listForCompanySpy).toHaveBeenCalledWith("company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [talk] });
      expect(next).not.toHaveBeenCalled();
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
      expect(getByIdSpy).toHaveBeenCalledWith("talk-1", "company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: talk });
      expect(next).not.toHaveBeenCalled();
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
  });
});
