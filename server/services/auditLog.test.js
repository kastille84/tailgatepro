// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const { supabase } = require("../utility/supabaseClient");
const { record } = require("./auditLog");

const fromSpy = vi.spyOn(supabase, "from");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("auditLog service: record", () => {
  let insertFn;

  beforeEach(() => {
    insertFn = vi.fn().mockResolvedValue({ error: null });

    fromSpy.mockReset();
    fromSpy.mockImplementation((table) => {
      if (table === "meeting_log_audit_events") return { insert: insertFn };
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should insert a server-generated id with the given event fields", async () => {
    // Act
    await record({
      meetingLogId: "meeting-1",
      eventType: "created",
      actorId: "user-1",
      metadata: { projectId: "project-1" },
    });

    // Assert
    expect(insertFn).toHaveBeenCalledWith({
      id: expect.stringMatching(UUID_RE),
      meeting_log_id: "meeting-1",
      event_type: "created",
      actor_id: "user-1",
      metadata: { projectId: "project-1" },
    });
  });

  it("should default actorId and metadata to null when omitted", async () => {
    // Act
    await record({ meetingLogId: "meeting-1", eventType: "pdf_generated" });

    // Assert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null, metadata: null }),
    );
  });

  it("should swallow and log an insert error instead of throwing", async () => {
    // Arrange
    insertFn.mockResolvedValue({ error: new Error("db down") });

    // Act & Assert
    await expect(
      record({ meetingLogId: "meeting-1", eventType: "completed" }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to record "completed"'),
      expect.any(Error),
    );
  });

  it("should swallow and log a thrown/synchronous failure instead of throwing", async () => {
    // Arrange
    fromSpy.mockImplementation(() => {
      throw new Error("unexpected table");
    });

    // Act & Assert
    await expect(
      record({ meetingLogId: "meeting-1", eventType: "seal_verified" }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
