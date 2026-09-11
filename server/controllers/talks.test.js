// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const talksService = require("../services/talks");
const { listTalks, getTalk } = require("./talks");

const listGlobalSpy = vi.spyOn(talksService, "listGlobal");
const getByIdSpy = vi.spyOn(talksService, "getById");

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
    listGlobalSpy.mockReset();
    getByIdSpy.mockReset();
    req = { params: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listTalks", () => {
    it("should respond 200 with every global talk", async () => {
      // Arrange
      listGlobalSpy.mockResolvedValue([talk]);

      // Act
      await listTalks(req, res, next);

      // Assert
      expect(listGlobalSpy).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [talk] });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      listGlobalSpy.mockRejectedValue(error);

      // Act
      await listTalks(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getTalk", () => {
    it("should call the service with req.params.id and respond 200", async () => {
      // Arrange
      req.params = { id: "talk-1" };
      getByIdSpy.mockResolvedValue(talk);

      // Act
      await getTalk(req, res, next);

      // Assert
      expect(getByIdSpy).toHaveBeenCalledWith("talk-1");
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
});
