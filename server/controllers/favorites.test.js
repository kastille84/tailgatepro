// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const favoritesService = require("../services/favorites");
const talksService = require("../services/talks");
const { listFavorites, addFavorite, removeFavorite } = require("./favorites");

const listForUserSpy = vi.spyOn(favoritesService, "listForUser");
const addSpy = vi.spyOn(favoritesService, "add");
const removeSpy = vi.spyOn(favoritesService, "remove");
const getTalkSpy = vi.spyOn(talksService, "getById");

const favorite = {
  talkId: "talk-1",
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("favorites controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    listForUserSpy.mockReset();
    addSpy.mockReset();
    removeSpy.mockReset();
    getTalkSpy.mockReset().mockResolvedValue({ id: "talk-1" });
    req = {
      user: {
        id: "user-1",
        companyId: "company-1",
        companyType: "subcontractor",
        tier: "premium",
      },
      params: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listFavorites", () => {
    it("should call the service with the caller's id and respond 200", async () => {
      // Arrange
      listForUserSpy.mockResolvedValue([favorite]);

      // Act
      await listFavorites(req, res, next);

      // Assert
      expect(listForUserSpy).toHaveBeenCalledWith("user-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [favorite] });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      listForUserSpy.mockRejectedValue(error);

      // Act
      await listFavorites(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("addFavorite", () => {
    it("should call the service with the caller's id and req.body.talkId, and respond 201", async () => {
      // Arrange
      req.body = { talkId: "talk-1" };
      addSpy.mockResolvedValue(favorite);

      // Act
      await addFavorite(req, res, next);

      // Assert
      expect(addSpy).toHaveBeenCalledWith({ userId: "user-1", talkId: "talk-1" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: favorite });
      expect(next).not.toHaveBeenCalled();
    });

    it("should not check talk visibility for a plan with the full library", async () => {
      // Arrange
      req.body = { talkId: "talk-1" };
      addSpy.mockResolvedValue(favorite);

      // Act
      await addFavorite(req, res, next);

      // Assert
      expect(getTalkSpy).not.toHaveBeenCalled();
    });

    it("should let a Trade Free caller favorite a core talk", async () => {
      // Arrange
      req.user.tier = "basic";
      req.body = { talkId: "talk-1" };
      addSpy.mockResolvedValue(favorite);

      // Act
      await addFavorite(req, res, next);

      // Assert
      expect(getTalkSpy).toHaveBeenCalledWith("talk-1", "company-1", {
        fullLibrary: false,
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should reject a Trade Free caller favoriting a non-core talk", async () => {
      // Arrange
      req.user.tier = "basic";
      req.body = { talkId: "pro-only" };
      const error = new Error("Talk not found");
      getTalkSpy.mockRejectedValue(error);

      // Act
      await addFavorite(req, res, next);

      // Assert
      expect(addSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it("should forward a service error to next() (e.g. the 404 talk-not-found case)", async () => {
      // Arrange
      req.body = { talkId: "missing" };
      const error = new Error("Talk not found");
      addSpy.mockRejectedValue(error);

      // Act
      await addFavorite(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("removeFavorite", () => {
    it("should call the service with the caller's id and req.params.talkId, and respond 200", async () => {
      // Arrange
      req.params = { talkId: "talk-1" };
      removeSpy.mockResolvedValue({ talkId: "talk-1" });

      // Act
      await removeFavorite(req, res, next);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith({ userId: "user-1", talkId: "talk-1" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { talkId: "talk-1" },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      req.params = { talkId: "talk-1" };
      const error = new Error("boom");
      removeSpy.mockRejectedValue(error);

      // Act
      await removeFavorite(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
