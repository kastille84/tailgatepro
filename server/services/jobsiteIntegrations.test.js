// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");

const { supabase } = require("../utility/supabaseClient");
const jobsitesService = require("./jobsites");
const auditLogService = require("./auditLog");
const storageService = require("./storage");
const { encrypt } = require("../utility/secretBox");
const procore = require("./integrations/procore");
const acc = require("./integrations/acc");
const {
  list,
  connect,
  disconnect,
  pushMeeting,
  retryPush,
} = require("./jobsiteIntegrations");

// A thenable, chainable stand-in for a PostgREST builder: every chained call
// returns itself and awaiting it (or .single()) resolves to `result`.
const builder = (result) => {
  const b = {};
  [
    "select", "eq", "in", "order", "limit", "upsert", "update", "delete",
  ].forEach((method) => {
    b[method] = vi.fn(() => b);
  });
  b.single = vi.fn(() => Promise.resolve(result));
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
};

const fromSpy = vi.spyOn(supabase, "from");
const getOwnedSpy = vi.spyOn(jobsitesService, "getOwnedJobsite");
const auditSpy = vi.spyOn(auditLogService, "record");
const downloadSpy = vi.spyOn(storageService, "downloadBlob");
const procorePush = vi.spyOn(procore, "push");
const procoreVerify = vi.spyOn(procore, "verify");
const accVerify = vi.spyOn(acc, "verify");

const proSite = { id: "js-1", sitePro: true };
const freeSite = { id: "js-1", sitePro: false };
const procoreCreds = { clientId: "id", clientSecret: "secret", companyId: "9" };

const integrationRow = {
  id: "int-1",
  jobsite_id: "js-1",
  provider: "procore",
  external_project_id: "77",
  external_folder_id: null,
  encrypted_credentials: encrypt(JSON.stringify(procoreCreds)),
  status: "connected",
  last_error: null,
};

beforeEach(() => {
  fromSpy.mockReset();
  getOwnedSpy.mockReset().mockResolvedValue(proSite);
  auditSpy.mockReset().mockResolvedValue(undefined);
  downloadSpy.mockReset();
  procorePush.mockReset();
  procoreVerify.mockReset().mockResolvedValue(undefined);
  accVerify.mockReset().mockResolvedValue(undefined);
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
    const result = await list({ jobsiteId: "js-1", gcCompanyId: "gc-1" });
    expect(result.sitePro).toBe(true);
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

  it("skips the pushes query when nothing is connected", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: null }));
    const result = await list({ jobsiteId: "js-1", gcCompanyId: "gc-1" });
    expect(result.integrations).toEqual([]);
    expect(result.recentPushes).toEqual([]);
    expect(fromSpy).toHaveBeenCalledTimes(1);
  });

  it("maps database errors to 502", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { message: "boom" } }));
    await expect(list({ jobsiteId: "js-1", gcCompanyId: "gc-1" })).rejects.toMatchObject({ statusCode: 502 });

    fromSpy
      .mockReturnValueOnce(builder({ data: [integrationRow], error: null }))
      .mockReturnValueOnce(builder({ data: null, error: { message: "boom" } }));
    await expect(list({ jobsiteId: "js-1", gcCompanyId: "gc-1" })).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("connect", () => {
  const base = {
    jobsiteId: "js-1",
    gcCompanyId: "gc-1",
    provider: "procore",
    credentials: { ...procoreCreds, extra: "dropped" },
    projectId: "77",
    folderId: "",
  };

  it("verifies then stores only the provider's fields, encrypted", async () => {
    const upsertBuilder = builder({ data: integrationRow, error: null });
    fromSpy.mockReturnValueOnce(upsertBuilder);
    const result = await connect(base);
    expect(procoreVerify).toHaveBeenCalledWith(procoreCreds, { projectId: "77", folderId: null });
    const saved = upsertBuilder.upsert.mock.calls[0][0];
    expect(saved.encrypted_credentials).not.toContain("secret");
    expect(saved.encrypted_credentials.startsWith("v1.")).toBe(true);
    expect(result.provider).toBe("procore");
    expect(result).not.toHaveProperty("encryptedCredentials");
  });

  it("rejects unknown providers", async () => {
    await expect(connect({ ...base, provider: "jobtread" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("requires Site Pro", async () => {
    getOwnedSpy.mockResolvedValue(freeSite);
    await expect(connect(base)).rejects.toMatchObject({ statusCode: 403, data: { code: "PLAN_REQUIRED" } });
    expect(procoreVerify).not.toHaveBeenCalled();
  });

  it("requires every credential field, the project, and the ACC folder", async () => {
    await expect(connect({ ...base, credentials: { clientId: "id" } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(connect({ ...base, credentials: undefined })).rejects.toMatchObject({ statusCode: 400 });
    await expect(connect({ ...base, projectId: "" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      connect({ ...base, provider: "acc", credentials: { clientId: "a", clientSecret: "b" }, folderId: "" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("connects ACC with a folder", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: { ...integrationRow, provider: "acc" }, error: null }));
    await connect({
      ...base,
      provider: "acc",
      credentials: { clientId: "a", clientSecret: "b" },
      folderId: "urn:folder",
    });
    expect(accVerify).toHaveBeenCalledWith({ clientId: "a", clientSecret: "b" }, { projectId: "77", folderId: "urn:folder" });
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
    await disconnect({ jobsiteId: "js-1", gcCompanyId: "gc-1", provider: "acc" });
    expect(getOwnedSpy).toHaveBeenCalledWith("js-1", "gc-1", null);
    expect(deleteBuilder.delete).toHaveBeenCalled();
  });

  it("rejects unknown providers and maps failures to 502", async () => {
    await expect(disconnect({ jobsiteId: "js-1", gcCompanyId: "gc-1", provider: "x" })).rejects.toMatchObject({ statusCode: 400 });
    fromSpy.mockReturnValueOnce(builder({ error: { message: "boom" } }));
    await expect(disconnect({ jobsiteId: "js-1", gcCompanyId: "gc-1", provider: "acc" })).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("pushMeeting", () => {
  const args = { meetingLogId: "m-1", jobsiteId: "js-1", pdfBuffer: Buffer.from("pdf"), filename: "a.pdf" };

  const arrange = ({ jobsite, rows }) => {
    const pushUpsert = builder({ error: null });
    const integrationUpdate = builder({ error: null });
    fromSpy
      .mockReturnValueOnce(builder({ data: jobsite, error: null }))
      .mockReturnValueOnce(builder({ data: rows, error: null }))
      .mockReturnValueOnce(pushUpsert)
      .mockReturnValueOnce(integrationUpdate);
    return { pushUpsert, integrationUpdate };
  };

  it("does nothing for an unlinked project", async () => {
    await pushMeeting({ ...args, jobsiteId: null });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the jobsite lost Site Pro access", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: { plan: "free", companies: { tier: "basic" } }, error: null }));
    await pushMeeting(args);
    expect(procorePush).not.toHaveBeenCalled();
  });

  it("pushes to each integration, records the result and the audit event", async () => {
    procorePush.mockResolvedValue({ externalFileId: "555" });
    const { pushUpsert, integrationUpdate } = arrange({
      jobsite: { plan: "site_pro", companies: { tier: "basic" } },
      rows: [integrationRow],
    });
    await pushMeeting(args);
    expect(procorePush).toHaveBeenCalledWith(
      expect.objectContaining({
        creds: procoreCreds,
        target: { projectId: "77", folderId: null },
        filename: "a.pdf",
      }),
    );
    expect(pushUpsert.upsert.mock.calls[0][0]).toMatchObject({
      meeting_log_id: "m-1",
      integration_id: "int-1",
      status: "sent",
      external_file_id: "555",
      filename: "a.pdf",
    });
    expect(integrationUpdate.update.mock.calls[0][0]).toEqual({ status: "connected", last_error: null });
    expect(auditSpy).toHaveBeenCalledWith({
      meetingLogId: "m-1",
      eventType: "integration_pushed",
      metadata: { provider: "procore", externalFileId: "555" },
    });
  });

  it("covers Portfolio companies via companyTier", async () => {
    procorePush.mockResolvedValue({ externalFileId: "1" });
    arrange({ jobsite: { plan: "free", companies: { tier: "premium" } }, rows: [integrationRow] });
    await pushMeeting(args);
    expect(procorePush).toHaveBeenCalled();
  });

  it("records a failed push without throwing and without an audit event", async () => {
    procorePush.mockRejectedValue(new Error("Procore rejected the request (403)"));
    const { pushUpsert, integrationUpdate } = arrange({
      jobsite: { plan: "site_pro", companies: null },
      rows: [integrationRow],
    });
    await expect(pushMeeting(args)).resolves.toBeUndefined();
    expect(pushUpsert.upsert.mock.calls[0][0]).toMatchObject({
      status: "failed",
      error: "Procore rejected the request (403)",
    });
    expect(integrationUpdate.update.mock.calls[0][0].status).toBe("error");
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it("falls back to a generic message and survives a failed result save", async () => {
    procorePush.mockRejectedValue({});
    const pushUpsert = builder({ error: { message: "db down" } });
    fromSpy
      .mockReturnValueOnce(builder({ data: { plan: "site_pro", companies: null }, error: null }))
      .mockReturnValueOnce(builder({ data: [integrationRow], error: null }))
      .mockReturnValueOnce(pushUpsert)
      .mockReturnValueOnce(builder({ error: null }));
    await pushMeeting(args);
    expect(pushUpsert.upsert.mock.calls[0][0].error).toBe("Push failed");
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
    const result = await retryPush({ pushId: "p-1", gcCompanyId: "gc-1" });
    expect(result).toEqual({ status: "sent" });
    expect(downloadSpy).toHaveBeenCalledWith("meeting-pdfs", "m-1/report.pdf");
    expect(getOwnedSpy).toHaveBeenCalledWith("js-1", "gc-1", null);
    expect(procorePush.mock.calls[0][0].filename).toBe("saved.pdf");
  });

  it("falls back to a generated filename", async () => {
    procorePush.mockResolvedValue({ externalFileId: "9" });
    downloadSpy.mockResolvedValue(Buffer.from("pdf"));
    fromSpy
      .mockReturnValueOnce(builder({ data: { ...pushRow, filename: null }, error: null }))
      .mockReturnValueOnce(builder({ error: null }))
      .mockReturnValueOnce(builder({ error: null }));
    await retryPush({ pushId: "p-1", gcCompanyId: "gc-1" });
    expect(procorePush.mock.calls[0][0].filename).toBe("m-1.pdf");
  });

  it("404s for a missing push and 502s for a database error", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { code: "PGRST116" } }));
    await expect(retryPush({ pushId: "p-1", gcCompanyId: "gc-1" })).rejects.toMatchObject({ statusCode: 404 });
    fromSpy.mockReturnValueOnce(builder({ data: null, error: { code: "XX" } }));
    await expect(retryPush({ pushId: "p-1", gcCompanyId: "gc-1" })).rejects.toMatchObject({ statusCode: 502 });
    fromSpy.mockReturnValueOnce(builder({ data: { id: "p-1", integration: null }, error: null }));
    await expect(retryPush({ pushId: "p-1", gcCompanyId: "gc-1" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires Site Pro and ownership", async () => {
    fromSpy.mockReturnValueOnce(builder({ data: pushRow, error: null }));
    getOwnedSpy.mockResolvedValue(freeSite);
    await expect(retryPush({ pushId: "p-1", gcCompanyId: "gc-1" })).rejects.toMatchObject({ statusCode: 403 });
    expect(downloadSpy).not.toHaveBeenCalled();
  });
});
