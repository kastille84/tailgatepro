// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const procore = require("./procore");
const acc = require("./acc");
const { request } = require("./http");
const { getProvider, PROVIDER_NAMES } = require("./index");

const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => "" });
const fail = (status, text = "nope") => ({
  ok: false,
  status,
  statusText: "Bad",
  text: async () => text,
});

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("http.request", () => {
  it("wraps network failures as AppError 502", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(request("X", "https://x")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("wraps non-2xx as AppError 502 and keeps the detail in cause", async () => {
    fetchMock.mockResolvedValue(fail(401, "bad creds"));
    const error = await request("X", "https://x").catch((e) => e);
    expect(error.statusCode).toBe(502);
    expect(error.cause.message).toBe("bad creds");
  });

  it("falls back to statusText when the body is unreadable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Boom",
      text: async () => {
        throw new Error("unreadable");
      },
    });
    const error = await request("X", "https://x").catch((e) => e);
    expect(error.cause.message).toBe("Boom");
  });
});

describe("registry", () => {
  it("resolves known providers and null for unknown", () => {
    expect(PROVIDER_NAMES).toEqual(["procore", "acc"]);
    expect(getProvider("procore")).toBe(procore);
    expect(getProvider("acc")).toBe(acc);
    expect(getProvider("jobtread")).toBeNull();
  });
});

describe("procore", () => {
  const creds = { clientId: "id", clientSecret: "secret", companyId: "99" };

  it("verify gets a token then reads the project", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "tok" })).mockResolvedValueOnce(ok({}));
    await procore.verify(creds, { projectId: "7" });
    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1.0/projects/7?company_id=99");
    expect(fetchMock.mock.calls[1][1].headers["Procore-Company-Id"]).toBe("99");
  });

  it("push runs the upload -> storage -> file flow and returns the file id", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: "tok" }))
      .mockResolvedValueOnce(ok({ uuid: "u1", url: "https://s3/put", fields: { key: "k" } }))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ id: 555 }));
    const result = await procore.push({
      creds,
      target: { projectId: "7", folderId: "12" },
      pdfBuffer: Buffer.from("pdf"),
      filename: "a.pdf",
    });
    expect(result).toEqual({ externalFileId: "555" });
    expect(fetchMock.mock.calls[2][0]).toBe("https://s3/put");
    expect(fetchMock.mock.calls[2][1].body.get("key")).toBe("k");
    const fileBody = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(fileBody.file).toEqual({ name: "a.pdf", upload_uuid: "u1", parent_id: 12 });
  });

  it("push omits parent_id when no folder is set and tolerates missing fields", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: "tok" }))
      .mockResolvedValueOnce(ok({ uuid: "u1", url: "https://s3/put" }))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ id: 1 }));
    await procore.push({
      creds,
      target: { projectId: "7", folderId: null },
      pdfBuffer: Buffer.from("pdf"),
      filename: "a.pdf",
    });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).file).not.toHaveProperty("parent_id");
  });

  it("push surfaces a failed step as AppError 502", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "tok" })).mockResolvedValueOnce(fail(403));
    await expect(
      procore.push({ creds, target: { projectId: "7" }, pdfBuffer: Buffer.from("x"), filename: "a.pdf" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("acc", () => {
  const creds = { clientId: "id", clientSecret: "secret" };
  const target = { projectId: "abc", folderId: "urn:adsk.wipprod:fs.folder:co.1" };

  it("verify reads the folder using the b.-prefixed project id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "tok" })).mockResolvedValueOnce(ok({}));
    await acc.verify(creds, target);
    expect(fetchMock.mock.calls[1][0]).toContain("/projects/b.abc/folders/");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from("id:secret").toString("base64")}`,
    );
  });

  it("does not double-prefix an id that already starts with b.", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "tok" })).mockResolvedValueOnce(ok({}));
    await acc.verify(creds, { ...target, projectId: "b.abc" });
    expect(fetchMock.mock.calls[1][0]).toContain("/projects/b.abc/folders/");
  });

  it("push creates storage, uploads via signed S3, then creates the item", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: "tok" }))
      .mockResolvedValueOnce(ok({ data: { id: "urn:adsk.objects:os.object:wip.dm.prod/obj-1" } }))
      .mockResolvedValueOnce(ok({ urls: ["https://s3/put"], uploadKey: "uk" }))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ data: { id: "urn:item" } }));
    const result = await acc.push({ creds, target, pdfBuffer: Buffer.from("pdf"), filename: "a.pdf" });
    expect(result).toEqual({ externalFileId: "urn:item" });
    expect(fetchMock.mock.calls[2][0]).toContain("/objects/obj-1/signeds3upload");
    expect(fetchMock.mock.calls[3][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ uploadKey: "uk" });
    const itemBody = JSON.parse(fetchMock.mock.calls[5][1].body);
    expect(itemBody.data.relationships.parent.data.id).toBe(target.folderId);
  });
});
