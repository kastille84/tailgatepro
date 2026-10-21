// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const noWorkDaysService = require("../services/noWorkDays");
const { listNoWorkDays, createNoWorkDay, removeNoWorkDay } = require("./noWorkDays");

const createSpy = vi.spyOn(noWorkDaysService, "create");
const removeSpy = vi.spyOn(noWorkDaysService, "remove");
const listSpy = vi.spyOn(noWorkDaysService, "listForProject");

const noWorkDay = { id: "nwd-1", offDate: "2026-09-24", reason: "holiday" };

describe("noWorkDays controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    createSpy.mockReset();
    removeSpy.mockReset();
    listSpy.mockReset();
    req = {
      user: { id: "user-1", companyId: "company-1" },
      params: {},
      query: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listNoWorkDays", () => {
    it("should list the project's marks for the caller's company and respond 200", async () => {
      // Arrange
      req.query = { projectId: "project-1" };
      listSpy.mockResolvedValue([noWorkDay]);

      // Act
      await listNoWorkDays(req, res, next);

      // Assert
      expect(listSpy).toHaveBeenCalledWith({ projectId: "project-1", companyId: "company-1" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [noWorkDay] });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      listSpy.mockRejectedValue(error);

      // Act
      await listNoWorkDays(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("createNoWorkDay", () => {
    beforeEach(() => {
      req.body = { id: "nwd-1", projectId: "project-1", offDate: "2026-09-24", reason: "holiday" };
    });

    it("should pass the caller's company and user, never body ones, and respond 201 for a new mark", async () => {
      // Arrange
      createSpy.mockResolvedValue({ noWorkDay, created: true });

      // Act
      await createNoWorkDay(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({
        id: "nwd-1",
        companyId: "company-1",
        userId: "user-1",
        projectId: "project-1",
        offDate: "2026-09-24",
        reason: "holiday",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: noWorkDay });
    });

    it("should respond 200 when the day was already marked", async () => {
      // Arrange
      createSpy.mockResolvedValue({ noWorkDay, created: false });

      // Act
      await createNoWorkDay(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: noWorkDay });
    });

    it("should respond 200 { ignored: true } for a weekend or out-of-range date", async () => {
      // Arrange
      createSpy.mockResolvedValue({ ignored: true });

      // Act
      await createNoWorkDay(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { ignored: true } });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      createSpy.mockRejectedValue(error);

      // Act
      await createNoWorkDay(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("removeNoWorkDay", () => {
    it("should remove the caller's mark and respond 200", async () => {
      // Arrange
      req.params = { id: "nwd-1" };
      removeSpy.mockResolvedValue({ id: "nwd-1" });

      // Act
      await removeNoWorkDay(req, res, next);

      // Assert
      expect(removeSpy).toHaveBeenCalledWith({ id: "nwd-1", companyId: "company-1" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: "nwd-1" } });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      removeSpy.mockRejectedValue(error);

      // Act
      await removeNoWorkDay(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
