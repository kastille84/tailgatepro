// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const signaturesService = require("../services/signatures");
const { listSignatures, createSignature } = require("./signatures");

const listForMeetingSpy = vi.spyOn(signaturesService, "listForMeeting");
const createSpy = vi.spyOn(signaturesService, "create");

const signature = {
  id: "sig-1",
  meetingId: "meeting-1",
  workerName: "Alex Worker",
  signaturePath: "signatures/meeting-1/sig-1.png",
  quizPassed: true,
  quizScore: 3,
  quizAnswers: [
    { questionIndex: 0, selectedIndex: 0, correct: true },
    { questionIndex: 1, selectedIndex: 1, correct: true },
    { questionIndex: 2, selectedIndex: 0, correct: true },
  ],
  createdAt: "2026-09-14T00:00:00.000Z",
};

describe("signatures controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    listForMeetingSpy.mockReset();
    createSpy.mockReset();
    req = {
      params: { meetingId: "meeting-1" },
      body: {},
      user: { id: "user-1", companyId: "company-1" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("listSignatures", () => {
    it("should call the service with req.params.meetingId + the caller's companyId and respond 200", async () => {
      // Arrange
      listForMeetingSpy.mockResolvedValue([signature]);

      // Act
      await listSignatures(req, res, next);

      // Assert
      expect(listForMeetingSpy).toHaveBeenCalledWith("meeting-1", "company-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [signature],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next() (e.g. the 404 not-found case)", async () => {
      // Arrange
      const error = new Error("Meeting not found");
      listForMeetingSpy.mockRejectedValue(error);

      // Act
      await listSignatures(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("createSignature", () => {
    beforeEach(() => {
      req.body = {
        id: "sig-1",
        workerName: "Alex Worker",
        quizAnswers: [
          { questionIndex: 0, selectedIndex: 0 },
          { questionIndex: 1, selectedIndex: 1 },
          { questionIndex: 2, selectedIndex: 0 },
        ],
      };
    });

    it("should call the service with the body fields, req.params.meetingId, and the caller's companyId, then respond 201", async () => {
      // Arrange
      createSpy.mockResolvedValue(signature);

      // Act
      await createSignature(req, res, next);

      // Assert
      expect(createSpy).toHaveBeenCalledWith({
        id: "sig-1",
        companyId: "company-1",
        meetingId: "meeting-1",
        workerName: "Alex Worker",
        quizAnswers: req.body.quizAnswers,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: signature });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a service error to next() (e.g. the already-completed 409 guard)", async () => {
      // Arrange
      const error = new Error(
        "This meeting has already been completed and can't be changed.",
      );
      createSpy.mockRejectedValue(error);

      // Act
      await createSignature(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
