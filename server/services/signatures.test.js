// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const meetingLogsService = require("./meetingLogs");
const { create, listForMeeting } = require("./signatures");

const SIGNATURE_COLUMNS =
  "id, meeting_id, worker_name, signature_path, quiz_passed, quiz_score, quiz_answers, created_at";

const quiz = [
  { question: "Q1", choices: ["a", "b"], correctIndex: 0 },
  { question: "Q2", choices: ["a", "b"], correctIndex: 1 },
  { question: "Q3", choices: ["a", "b"], correctIndex: 0 },
];

const dbRow = {
  id: "sig-1",
  meeting_id: "meeting-1",
  worker_name: "Alex Worker",
  signature_path: "signatures/meeting-1/sig-1.png",
  quiz_passed: true,
  quiz_score: 3,
  quiz_answers: [
    { questionIndex: 0, selectedIndex: 0, correct: true },
    { questionIndex: 1, selectedIndex: 1, correct: true },
    { questionIndex: 2, selectedIndex: 0, correct: true },
  ],
  created_at: "2026-09-14T00:00:00.000Z",
};

const mappedSignature = {
  id: "sig-1",
  meetingId: "meeting-1",
  workerName: "Alex Worker",
  signaturePath: "signatures/meeting-1/sig-1.png",
  quizPassed: true,
  quizScore: 3,
  quizAnswers: dbRow.quiz_answers,
  createdAt: "2026-09-14T00:00:00.000Z",
};

const fromSpy = vi.spyOn(supabase, "from");
const assertNotCompletedSpy = vi.spyOn(meetingLogsService, "assertNotCompleted");
const getByIdSpy = vi.spyOn(meetingLogsService, "getById");

describe("signatures service: create", () => {
  let talkSingle;
  let talkEq;
  let talkSelect;
  let insertSingle;
  let insertSelect;
  let insertFn;

  beforeEach(() => {
    assertNotCompletedSpy.mockReset().mockResolvedValue({
      id: "meeting-1",
      talkId: "talk-1",
    });

    talkSingle = vi.fn().mockResolvedValue({ data: { quiz }, error: null });
    talkEq = vi.fn(() => ({ single: talkSingle }));
    talkSelect = vi.fn(() => ({ eq: talkEq }));

    insertSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    insertSelect = vi.fn(() => ({ single: insertSingle }));
    insertFn = vi.fn(() => ({ select: insertSelect }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "toolbox_talks") return { select: talkSelect };
      if (table === "signatures") return { insert: insertFn };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  const payload = {
    id: "sig-1",
    companyId: "company-1",
    meetingId: "meeting-1",
    workerName: "Alex Worker",
    quizAnswers: [
      { questionIndex: 0, selectedIndex: 0 },
      { questionIndex: 1, selectedIndex: 1 },
      { questionIndex: 2, selectedIndex: 0 },
    ],
  };

  it("should verify the meeting isn't completed, score the quiz server-side, insert the signature, and map it to camelCase", async () => {
    // Act
    const result = await create(payload);

    // Assert
    expect(assertNotCompletedSpy).toHaveBeenCalledWith("meeting-1", "company-1");
    expect(talkSelect).toHaveBeenCalledWith("quiz");
    expect(talkEq).toHaveBeenCalledWith("id", "talk-1");
    expect(insertFn).toHaveBeenCalledWith({
      id: "sig-1",
      meeting_id: "meeting-1",
      worker_name: "Alex Worker",
      signature_path: "signatures/meeting-1/sig-1.png",
      quiz_passed: true,
      quiz_score: 3,
      quiz_answers: dbRow.quiz_answers,
    });
    expect(insertSelect).toHaveBeenCalledWith(SIGNATURE_COLUMNS);
    expect(result).toEqual(mappedSignature);
  });

  it("should compute a partial score/fail against a client-submitted answer set, ignoring any client-supplied pass/fail", async () => {
    // Act — 2 correct, 1 wrong; a hostile client could try to smuggle
    // quizPassed:true here (not even a real field on the input shape), which
    // must be impossible to influence.
    await create({
      ...payload,
      quizAnswers: [
        { questionIndex: 0, selectedIndex: 0 }, // correct
        { questionIndex: 1, selectedIndex: 0 }, // wrong (correctIndex is 1)
        { questionIndex: 2, selectedIndex: 0 }, // correct
      ],
    });

    // Assert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ quiz_score: 2, quiz_passed: false }),
    );
  });

  it("should treat a missing answer for a question as incorrect, not skip it", async () => {
    // Act
    await create({ ...payload, quizAnswers: [{ questionIndex: 0, selectedIndex: 0 }] });

    // Assert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        quiz_score: 1,
        quiz_passed: false,
        quiz_answers: [
          { questionIndex: 0, selectedIndex: 0, correct: true },
          { questionIndex: 1, selectedIndex: null, correct: false },
          { questionIndex: 2, selectedIndex: null, correct: false },
        ],
      }),
    );
  });

  it("should skip the quiz lookup and score null/null/null when the meeting has no talk", async () => {
    // Arrange
    assertNotCompletedSpy.mockResolvedValue({ id: "meeting-1", talkId: null });

    // Act
    await create(payload);

    // Assert
    expect(talkSelect).not.toHaveBeenCalled();
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        quiz_score: null,
        quiz_passed: null,
        quiz_answers: null,
      }),
    );
  });

  it("should score null/null/null when the talk has no quiz authored yet", async () => {
    // Arrange
    talkSingle.mockResolvedValue({ data: { quiz: null }, error: null });

    // Act
    await create(payload);

    // Assert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        quiz_score: null,
        quiz_passed: null,
        quiz_answers: null,
      }),
    );
  });

  it("should propagate the meeting-not-found/already-completed error from assertNotCompleted without inserting", async () => {
    // Arrange
    const error = new Error(
      "This meeting has already been completed and can't be changed.",
    );
    assertNotCompletedSpy.mockRejectedValue(error);

    // Act & Assert
    await expect(create(payload)).rejects.toBe(error);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the talk's quiz can't be loaded", async () => {
    // Arrange
    talkSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not load the talk's quiz",
    });
  });

  it("should throw a 409 AppError when the id already exists", async () => {
    // Arrange
    insertSingle.mockResolvedValue({ data: null, error: { code: "23505" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 409,
      message: "This signature already exists",
    });
  });

  it("should throw a 502 AppError on any other insert failure", async () => {
    // Arrange
    insertSingle.mockResolvedValue({ data: null, error: { code: "OTHER" } });

    // Act & Assert
    await expect(create(payload)).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not create the signature",
    });
  });
});

describe("signatures service: listForMeeting", () => {
  let order;
  let eq;
  let select;

  beforeEach(() => {
    getByIdSpy.mockReset().mockResolvedValue({ id: "meeting-1" });

    order = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    eq = vi.fn(() => ({ order }));
    select = vi.fn(() => ({ eq }));

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "signatures") return { select };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("should confirm the meeting belongs to the caller's company, then list its signatures oldest-first, mapped to camelCase", async () => {
    // Act
    const result = await listForMeeting("meeting-1", "company-1");

    // Assert
    expect(getByIdSpy).toHaveBeenCalledWith("meeting-1", "company-1");
    expect(select).toHaveBeenCalledWith(SIGNATURE_COLUMNS);
    expect(eq).toHaveBeenCalledWith("meeting_id", "meeting-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toEqual([mappedSignature]);
  });

  it("should propagate the meeting-not-found error from getById without querying signatures", async () => {
    // Arrange
    const error = new Error("Meeting not found");
    getByIdSpy.mockRejectedValue(error);

    // Act & Assert
    await expect(listForMeeting("missing", "company-1")).rejects.toBe(error);
    expect(select).not.toHaveBeenCalled();
  });

  it("should throw a 502 AppError when the query fails", async () => {
    // Arrange
    order.mockResolvedValue({ data: null, error: new Error("db down") });

    // Act & Assert
    await expect(
      listForMeeting("meeting-1", "company-1"),
    ).rejects.toMatchObject({ statusCode: 502, message: "Could not load signatures" });
  });
});
