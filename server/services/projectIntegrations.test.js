// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");

const { supabase } = require("../utility/supabaseClient");
const projectsService = require("./projects");
const auditLogService = require("./auditLog");
const storageService = require("./storage");
const { encrypt } = require("../utility/secretBox");
const procore = require("./integrations/procore");
const jobtread = require("./integrations/jobtread");
const {
  list,
  connect,
  disconnect,
  pushMeeting,
  retryPush,
} = require("./projectIntegrations");

// A thenable, chainable stand-in for a PostgREST builder: every chained call
// returns itself and awaiting it (or .single()) resolves to `result`.
const builder = (result) => {
  const b = {};
  ["select", "eq", "in", "order", "limit", "upsert", "update", "delete"].forEach((method) => {
    b[method] = vi.fn(() => b);
  });
  b.single = vi.fn(() => Promise.resolve(result));
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
};

const fromSpy = vi.spyOn(supabase, "from");
const getByIdSpy = vi.spyOn(projectsService, "getById");
const auditSpy = vi.spyOn(auditLogService, "record");
const downloadSpy = vi.spyOn(storageService, "downloadBlob");
const procorePush = vi.spyOn(procore, "push");
const procoreVerify = vi.spyOn(procore, "verify");
const jobtreadPush = vi.spyOn(jobtread, "push");
const jobtreadVerify = vi.spyOn(jobtread, "verify");

const enterprise = { companyId: "co-1", companyType: "subcontractor", tier: "enterprise" };
const pro = { companyId: "co-1", companyType: "subcontractor", tier: "premium" };
const procoreCreds = { clientId: "id", clientSecret: "secret", companyId: "9" };

const integrationRow = {
  id: "int-1",
  project_id: "pr-1",
  provider: "procore",
  external_project_id: "77",
  external_folder_id: null,
  encrypted_credentials: encrypt(JSON.stringify(procoreCreds)),
  status: "connected",
  last_error: null,
};

beforeEach(() => {
  fromSpy.mockReset();
  getByIdSpy.mockReset().mockResolvedValue({ id: "pr-1" });
  auditSpy.mockReset().mockResolvedValue(undefined);
  downloadSpy.mockReset();
  procorePush.mockReset();
  procoreVerify.mockReset().mockResolvedValue(undefined);
  jobtreadPush.mockReset();
  jobtreadVerify.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("list", () => {
  it("returns integrations without credentials and recent pushes", async () => {
    fromSpy
      .mockReturnValueOnce(builder({ data: [integrationRow], error: null }))
      .mockReturnValueOnce(
        builder({
          data: [
            { id: "p1", meeting_log_id: "m1", integration_id: "int-1", status: "failed", error: "x", attempted_at: "t" },
          ],
          error: null,
        }),
      );
    const result = await list({ projectId: "pr-1", ...enterprise });
    expect(getByIdSpy).toHaveBeenCalledWith("pr-1", "co-1");
    expect(result.enterprise).toBe(true);
    expect(result.integrations).toEqual([
      {
        id: "int-1",
        provider: "procore",
        externalProjectId: "77",
        externalFolderId: null,
        status: "connected",
        lastError: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.recentPushes[0]).toMatchObject({ id: "p1", status: "failed", meetingLogId: "m1" });
  });

  it("flags a non-Enterprise caller and skips the pushes query when nothing is connected", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: null }));
    const result = await list({ projectId: "pr-1", ...pro });
    expect(result.enterprise).toBe(false);
    expect(result.integrations).toEqual([]);
    expect(result.recentPushes).toEqual([]);
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });

  it("maps database errors to 502", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { message: "boom" } }));
    await expect(list({ projectId: "pr-1", ...enterprise })).rejects.toMatchObject({ statusCode: 502 });

    fromSpy
      .mockReturnValueOnce(builder({ data: [integrationRow], error: null }))
      .mockReturnValueOnce(builder({ data: null, error: { message: "boom" } }));
    await expect(list({ projectId: "pr-1", ...enterprise })).rejects.toMatchObject({ statusCode: 502 });
  });

  it("propagates a missing/foreign project as 404", async () => {
    getByIdSpy.mockRejectedValue(Object.assign(new Error("Project not found"), { statusCode: 404 }));
    await expect(list({ projectId: "pr-1", ...enterprise })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("connect", () => {
  const base = {
    projectId: "pr-1",
    ...enterprise,
    provider: "procore",
    credentials: { ...procoreCreds, extra: "dropped" },
    externalProjectId: "77",
    folderId: "",
  };

  it("verifies then stores only the provider's fields, encrypted", async () => {
    const upsertBuilder = builder({ data: integrationRow, error: null });
    fromSpy.mockReturnValueOnce(upsertBuilder);
    const result = await connect(base);
    expect(procoreVerify).toHaveBeenCalledWith(procoreCreds, { projectId: "77", folderId: null });
    const saved = upsertBuilder.upsert.mock.calls[0][0];
    expect(saved.project_id).toBe("pr-1");
    expect(saved.encrypted_credentials).not.toContain("secret");
    expect(saved.encrypted_credentials.startsWith("v1.")).toBe(true);
    expect(result.provider).toBe("procore");
    expect(result).not.toHaveProperty("encryptedCredentials");
  });

  it("connects JobTread with just a grant key and a job id", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: { ...integrationRow, provider: "jobtread" }, error: null }));
    await connect({ ...base, provider: "jobtread", credentials: { grantKey: "gk" }, externalProjectId: "job-1" });
    expect(jobtreadVerify).toHaveBeenCalledWith({ grantKey: "gk" }, { projectId: "job-1", folderId: null });
  });

  it("keeps a provided folder id as a string", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: integrationRow, error: null }));
    await connect({ ...base, folderId: 12 });
    expect(procoreVerify).toHaveBeenCalledWith(procoreCreds, { projectId: "77", folderId: "12" });
  });

  it("rejects providers that are GC-only or unknown", async () => {
    await expect(connect({ ...base, provider: "acc" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(connect({ ...base, provider: "quickbooks" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("requires Trade Enterprise", async () => {
    await expect(connect({ ...base, ...pro })).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_REQUIRED" },
    });
    expect(procoreVerify).not.toHaveBeenCalled();
  });

  it("requires every credential field and the provider-side project id", async () => {
    await expect(connect({ ...base, credentials: { clientId: "id" } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(connect({ ...base, credentials: undefined })).rejects.toMatchObject({ statusCode: 400 });
    await expect(connect({ ...base, externalProjectId: "" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("does not store anything when verification fails", async () => {
    procoreVerify.mockRejectedValue(Object.assign(new Error("rejected"), { statusCode: 502 }));
    await expect(connect(base)).rejects.toMatchObject({ statusCode: 502 });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("maps a save failure to 502", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { message: "boom" } }));
    await expect(connect(base)).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("disconnect", () => {
  it("deletes the row after the ownership check", async () => {
    const deleteBuilder = builder({ error: null });
    fromSpy.mockReturnValueOnce(deleteBuilder);
    await disconnect({ projectId: "pr-1", companyId: "co-1", provider: "jobtread" });
    expect(getByIdSpy).toHaveBeenCalledWith("pr-1", "co-1");
    expect(deleteBuilder.delete).toHaveBeenCalled();
  });

  it("rejects unknown providers and maps failures to 502", async () => {
    await expect(disconnect({ projectId: "pr-1", companyId: "co-1", provider: "acc" })).rejects.toMatchObject({ statusCode: 400 });
    fromSpy.mockReturnValueOnce(builder({ error: { message: "boom" } }));
    await expect(disconnect({ projectId: "pr-1", companyId: "co-1", provider: "procore" })).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("pushMeeting", () => {
  const args = { meetingLogId: "m-1", projectId: "pr-1", pdfBuffer: Buffer.from("pdf"), filename: "a.pdf" };
  const enterpriseProject = { companies: { tier: "enterprise", company_type: "subcontractor" } };

  const arrange = ({ project, rows }) => {
    const pushUpsert = builder({ error: null });
    const integrationUpdate = builder({ error: null });
    fromSpy
      .mockReturnValueOnce(builder({ data: project, error: null }))
      .mockReturnValueOnce(builder({ data: rows, error: null }))
      .mockReturnValueOnce(pushUpsert)
      .mockReturnValueOnce(integrationUpdate);
    return { pushUpsert, integrationUpdate };
  };

  it("does nothing without a project id", async () => {
    await pushMeeting({ ...args, projectId: null });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the owner is not on Trade Enterprise (lapsed or never)", async () => {
    fromSpy.mockReturnValueOnce(
      builder({ data: { companies: { tier: "premium", company_type: "subcontractor" } }, error: null }),
    );
    await pushMeeting(args);
    expect(procorePush).not.toHaveBeenCalled();
    fromSpy.mockReturnValueOnce(builder({ data: { companies: null }, error: null }));
    await pushMeeting(args);
    expect(procorePush).not.toHaveBeenCalled();
  });

  it("pushes to each integration, records the result and the audit event", async () => {
    procorePush.mockResolvedValue({ externalFileId: "555" });
    const { pushUpsert, integrationUpdate } = arrange({ project: enterpriseProject, rows: [integrationRow] });
    await pushMeeting(args);
    expect(procorePush).toHaveBeenCalledWith(
      expect.objectContaining({
        creds: procoreCreds,
        target: { projectId: "77", folderId: null },
        filename: "a.pdf",
      }),
    );
    expect(fromSpy.mock.calls.map(([table]) => table)).toEqual([
      "projects",
      "project_integrations",
      "project_integration_pushes",
      "project_integrations",
    ]);
    expect(pushUpsert.upsert.mock.calls[0][0]).toMatchObject({
      meeting_log_id: "m-1",
      integration_id: "int-1",
      status: "sent",
      external_file_id: "555",
    });
    expect(integrationUpdate.update.mock.calls[0][0]).toEqual({ status: "connected", last_error: null });
    expect(auditSpy).toHaveBeenCalledWith({
      meetingLogId: "m-1",
      eventType: "integration_pushed",
      metadata: { provider: "procore", externalFileId: "555" },
    });
  });

  it("records a failed push without throwing and without an audit event", async () => {
    procorePush.mockRejectedValue(new Error("Procore rejected the request (403)"));
    const { pushUpsert, integrationUpdate } = arrange({ project: enterpriseProject, rows: [integrationRow] });
    await expect(pushMeeting(args)).resolves.toBeUndefined();
    expect(pushUpsert.upsert.mock.calls[0][0]).toMatchObject({
      status: "failed",
      error: "Procore rejected the request (403)",
    });
    expect(integrationUpdate.update.mock.calls[0][0].status).toBe("error");
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it("swallows lookup failures (soft-fail)", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { message: "boom" } }));
    await expect(pushMeeting(args)).resolves.toBeUndefined();
  });
});

describe("retryPush", () => {
  const pushRow = {
    id: "p-1",
    meeting_log_id: "m-1",
    filename: "saved.pdf",
    integration: integrationRow,
  };

  it("re-reads the stored PDF and pushes again", async () => {
    procorePush.mockResolvedValue({ externalFileId: "9" });
    downloadSpy.mockResolvedValue(Buffer.from("pdf"));
    fromSpy
      .mockReturnValueOnce(builder({ data: pushRow, error: null }))
      .mockReturnValueOnce(builder({ error: null }))
      .mockReturnValueOnce(builder({ error: null }));
    const result = await retryPush({ pushId: "p-1", ...enterprise });
    expect(result).toEqual({ status: "sent" });
    expect(downloadSpy).toHaveBeenCalledWith("meeting-pdfs", "m-1/report.pdf");
    expect(getByIdSpy).toHaveBeenCalledWith("pr-1", "co-1");
    expect(procorePush.mock.calls[0][0].filename).toBe("saved.pdf");
  });

  it("falls back to a generated filename", async () => {
    procorePush.mockResolvedValue({ externalFileId: "9" });
    downloadSpy.mockResolvedValue(Buffer.from("pdf"));
    fromSpy
      .mockReturnValueOnce(builder({ data: { ...pushRow, filename: null }, error: null }))
      .mockReturnValueOnce(builder({ error: null }))
      .mockReturnValueOnce(builder({ error: null }));
    await retryPush({ pushId: "p-1", ...enterprise });
    expect(procorePush.mock.calls[0][0].filename).toBe("m-1.pdf");
  });

  it("404s for a missing push and 502s for a database error", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { code: "PGRST116" } }));
    await expect(retryPush({ pushId: "p-1", ...enterprise })).rejects.toMatchObject({ statusCode: 404 });
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { code: "XX" } }));
    await expect(retryPush({ pushId: "p-1", ...enterprise })).rejects.toMatchObject({ statusCode: 502 });
    fromSpy.mockReturnValueOnce(builder({ data: { id: "p-1", integration: null }, error: null }));
    await expect(retryPush({ pushId: "p-1", ...enterprise })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires ownership and Trade Enterprise", async () => {
    fromSpy.mockReturnValue(builder({ data: pushRow, error: null }));
    getByIdSpy.mockRejectedValueOnce(Object.assign(new Error("nf"), { statusCode: 404 }));
    await expect(retryPush({ pushId: "p-1", ...enterprise })).rejects.toMatchObject({ statusCode: 404 });
    await expect(retryPush({ pushId: "p-1", ...pro })).rejects.toMatchObject({
      statusCode: 403,
      data: { code: "PLAN_REQUIRED" },
    });
    expect(procorePush).not.toHaveBeenCalled();
  });
});
