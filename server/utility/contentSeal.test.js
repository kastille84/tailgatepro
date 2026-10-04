// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
process.env.MEETING_LOG_SEAL_SECRET = "test-secret-one";

const { buildCanonicalPayload, computeSeal, shortSeal, sealsMatch } = require("./contentSeal");

const meetingLog = {
  id: "meeting-1",
  projectId: "project-1",
  talkId: "talk-1",
  companyId: "company-1",
  foremanId: "user-1",
  crewPhotoUrl: null,
  heldAt: "2026-09-14T01:00:00.000Z",
  completedAt: "2026-09-14T01:05:00.000Z",
};

const signatures = [
  { id: "sig-b", workerName: "Bob", quizScore: 2, quizPassed: false },
  { id: "sig-a", workerName: "Ann", quizScore: 3, quizPassed: true },
];

describe("contentSeal: buildCanonicalPayload", () => {
  it("should sort signatures by id ascending regardless of input order", () => {
    // Act
    const forward = buildCanonicalPayload({ meetingLog, signatures });
    const reversed = buildCanonicalPayload({
      meetingLog,
      signatures: [...signatures].reverse(),
    });

    // Assert
    expect(forward).toBe(reversed);
    expect(JSON.parse(forward).signatures.map((s) => s.id)).toEqual([
      "sig-a",
      "sig-b",
    ]);
  });

  it("should only carry id/workerName/quizScore/quizPassed per signature, never the signature path", () => {
    // Act
    const payload = JSON.parse(
      buildCanonicalPayload({
        meetingLog,
        signatures: [
          {
            id: "sig-a",
            workerName: "Ann",
            quizScore: 3,
            quizPassed: true,
            signaturePath: "meeting-1/sig-a.png",
          },
        ],
      }),
    );

    // Assert
    expect(payload.signatures[0]).toEqual({
      id: "sig-a",
      workerName: "Ann",
      quizScore: 3,
      quizPassed: true,
    });
  });

  it("should produce an identical payload whether heldAt/completedAt arrive as a JS toISOString() string or a Postgres/PostgREST timestamptz round-trip of the same instant", () => {
    // Arrange — jsFormat is what complete() passes (new Date().toISOString());
    // pgOffsetFormat and pgNoFractionFormat are how the same instants come
    // back from a TIMESTAMPTZ column via PostgREST (see contentSeal.js's
    // toCanonicalTimestamp comment).
    const jsFormatLog = {
      ...meetingLog,
      heldAt: "2026-09-14T01:00:00.500Z",
      completedAt: "2026-09-14T01:05:00.000Z",
    };
    const pgFormatLog = {
      ...meetingLog,
      heldAt: "2026-09-14T01:00:00.5+00:00", // offset instead of "Z"
      completedAt: "2026-09-14T01:05:00+00:00", // zero fraction dropped entirely
    };

    // Act
    const jsPayload = buildCanonicalPayload({ meetingLog: jsFormatLog, signatures });
    const pgPayload = buildCanonicalPayload({ meetingLog: pgFormatLog, signatures });

    // Assert
    expect(pgPayload).toBe(jsPayload);
    expect(computeSeal(pgPayload)).toBe(computeSeal(jsPayload));
  });

  it("should not include finalPdfUrl or any field beyond meetingLog's own", () => {
    // Act
    const payload = JSON.parse(buildCanonicalPayload({ meetingLog, signatures: [] }));

    // Assert
    expect(Object.keys(payload).sort()).toEqual(
      [
        "id",
        "projectId",
        "talkId",
        "companyId",
        "foremanId",
        "crewPhotoUrl",
        "heldAt",
        "completedAt",
        "signatures",
      ].sort(),
    );
  });
});

describe("contentSeal: computeSeal", () => {
  it("should be deterministic for the same payload and secret", () => {
    // Arrange
    const payload = buildCanonicalPayload({ meetingLog, signatures });

    // Act & Assert
    expect(computeSeal(payload)).toBe(computeSeal(payload));
  });

  it("should produce a different seal when the payload changes", () => {
    // Arrange
    const payloadA = buildCanonicalPayload({ meetingLog, signatures });
    const payloadB = buildCanonicalPayload({
      meetingLog: { ...meetingLog, talkId: "talk-2" },
      signatures,
    });

    // Act & Assert
    expect(computeSeal(payloadA)).not.toBe(computeSeal(payloadB));
  });

  it("should produce a different seal for the same payload under a different secret", () => {
    // Arrange
    const payload = buildCanonicalPayload({ meetingLog, signatures });
    const sealUnderSecretOne = computeSeal(payload);

    // Act
    process.env.MEETING_LOG_SEAL_SECRET = "test-secret-two";
    const sealUnderSecretTwo = computeSeal(payload);
    process.env.MEETING_LOG_SEAL_SECRET = "test-secret-one";

    // Assert
    expect(sealUnderSecretOne).not.toBe(sealUnderSecretTwo);
  });

  it("should throw when no secret is configured", () => {
    // Arrange
    const payload = buildCanonicalPayload({ meetingLog, signatures });
    delete process.env.MEETING_LOG_SEAL_SECRET;

    // Act & Assert
    expect(() => computeSeal(payload)).toThrow(
      "MEETING_LOG_SEAL_SECRET is not configured",
    );

    // Cleanup
    process.env.MEETING_LOG_SEAL_SECRET = "test-secret-one";
  });
});

describe("contentSeal: shortSeal", () => {
  it("should return the first 12 hex characters, uppercased", () => {
    // Arrange
    const seal = "abcdef0123456789abcdef0123456789";

    // Act & Assert
    expect(shortSeal(seal)).toBe("ABCDEF012345");
  });
});

describe("contentSeal: sealsMatch", () => {
  it("should return true for identical strings", () => {
    expect(sealsMatch("abc123", "abc123")).toBe(true);
  });

  it("should return false for different strings of the same length", () => {
    expect(sealsMatch("abc123", "abc124")).toBe(false);
  });

  it("should return false for strings of different lengths, without throwing", () => {
    expect(sealsMatch("abc", "abcdef")).toBe(false);
  });

  it("should return false when either argument isn't a string", () => {
    expect(sealsMatch(null, "abc")).toBe(false);
    expect(sealsMatch("abc", undefined)).toBe(false);
  });
});
