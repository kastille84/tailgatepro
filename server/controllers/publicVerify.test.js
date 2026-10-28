// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const publicVerifyService = require("../services/publicVerify");
const { verifyRecord, verifyFile } = require("./publicVerify");

const verifyRecordSpy = vi.spyOn(publicVerifyService, "verifyRecord");
const verifyFileSpy = vi.spyOn(publicVerifyService, "verifyFile");

describe("publicVerify controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    verifyRecordSpy.mockReset();
    verifyFileSpy.mockReset();
    req = { params: { id: "meeting-1" }, body: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  describe("verifyRecord", () => {
    it("should respond 200 with the service's result", async () => {
      // Arrange
      const data = { sealed: true, valid: true };
      verifyRecordSpy.mockResolvedValue(data);

      // Act
      await verifyRecord(req, res, next);

      // Assert
      expect(verifyRecordSpy).toHaveBeenCalledWith("meeting-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      verifyRecordSpy.mockRejectedValue(error);

      // Act
      await verifyRecord(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("verifyFile", () => {
    it("should lowercase the submitted digest before comparing", async () => {
      // Arrange
      req.body = { sha256: "ABCDEF".padEnd(64, "0") };
      verifyFileSpy.mockResolvedValue({ matches: true, status: "current" });

      // Act
      await verifyFile(req, res, next);

      // Assert
      expect(verifyFileSpy).toHaveBeenCalledWith("meeting-1", "abcdef".padEnd(64, "0"));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { matches: true, status: "current" },
      });
    });

    it("should forward a service error to next()", async () => {
      // Arrange
      const error = new Error("boom");
      req.body = { sha256: "a".repeat(64) };
      verifyFileSpy.mockRejectedValue(error);

      // Act
      await verifyFile(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
