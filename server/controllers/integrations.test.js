// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const integrationsService = require("../services/jobsiteIntegrations");
const siteScopeService = require("../services/siteScope");
const {
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  retryPush,
} = require("./integrations");

const listSpy = vi.spyOn(integrationsService, "list");
const connectSpy = vi.spyOn(integrationsService, "connect");
const disconnectSpy = vi.spyOn(integrationsService, "disconnect");
const retrySpy = vi.spyOn(integrationsService, "retryPush");
const scopeSpy = vi.spyOn(siteScopeService, "getAllowedJobsiteIds");

describe("integrations controller", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    [listSpy, connectSpy, disconnectSpy, retrySpy, scopeSpy].forEach((spy) => spy.mockReset());
    scopeSpy.mockResolvedValue(null);
    req = {
      params: { id: "js-1", provider: "procore" },
      body: { credentials: { clientId: "a" }, projectId: "77", folderId: "5" },
      user: { companyId: "gc-1" },
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("listIntegrations returns the service data", async () => {
    listSpy.mockResolvedValue({ integrations: [] });
    await listIntegrations(req, res, next);
    expect(listSpy).toHaveBeenCalledWith({ jobsiteId: "js-1", gcCompanyId: "gc-1", allowedJobsiteIds: null });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { integrations: [] } });
  });

  it("connectIntegration passes the body and provider through", async () => {
    connectSpy.mockResolvedValue({ id: "int-1" });
    await connectIntegration(req, res, next);
    expect(connectSpy).toHaveBeenCalledWith({
      jobsiteId: "js-1",
      gcCompanyId: "gc-1",
      allowedJobsiteIds: null,
      provider: "procore",
      credentials: { clientId: "a" },
      projectId: "77",
      folderId: "5",
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: "int-1" } });
  });

  it("disconnectIntegration returns null data", async () => {
    disconnectSpy.mockResolvedValue(undefined);
    await disconnectIntegration(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it("retryPush uses the push id param", async () => {
    retrySpy.mockResolvedValue({ status: "sent" });
    req.params = { id: "p-1" };
    await retryPush(req, res, next);
    expect(retrySpy).toHaveBeenCalledWith({ pushId: "p-1", gcCompanyId: "gc-1", allowedJobsiteIds: null });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { status: "sent" } });
  });

  it.each([
    ["listIntegrations", listIntegrations, listSpy],
    ["connectIntegration", connectIntegration, connectSpy],
    ["disconnectIntegration", disconnectIntegration, disconnectSpy],
    ["retryPush", retryPush, retrySpy],
  ])("%s forwards errors to next", async (_name, handler, spy) => {
    const error = new Error("boom");
    spy.mockRejectedValue(error);
    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
