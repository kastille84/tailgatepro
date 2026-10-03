// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const smsNudgesService = require("../services/smsNudges");
const smsService = require("../services/sms");
const siteScopeService = require("../services/siteScope");
const controller = require("./sms");

const getMineSpy = vi.spyOn(smsNudgesService, "getMine");
const setMineSpy = vi.spyOn(smsNudgesService, "setMine");
const clearMineSpy = vi.spyOn(smsNudgesService, "clearMine");
const listSpy = vi.spyOn(smsNudgesService, "listForJobsite");
const addSpy = vi.spyOn(smsNudgesService, "addForJobsite");
const removeSpy = vi.spyOn(smsNudgesService, "removeForJobsite");
const inboundSpy = vi.spyOn(smsNudgesService, "handleInbound");
const signatureSpy = vi.spyOn(smsService, "isValidTwilioSignature");
const getAllowedSpy = vi.spyOn(siteScopeService, "getAllowedJobsiteIds");

const makeRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.type = vi.fn(() => res);
  return res;
};

const user = { id: "u1", companyId: "c1", role: "admin" };
const boom = new Error("boom");

beforeEach(() => {
  getAllowedSpy.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("foreman opt-in endpoints", () => {
  it("getMine returns the row", async () => {
    getMineSpy.mockResolvedValue({ id: "r1" });
    const res = makeRes();
    await controller.getMine({ user }, res, vi.fn());
    expect(getMineSpy).toHaveBeenCalledWith("u1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: "r1" } });
  });

  it("setMine takes identity from the token context and the phone from the body", async () => {
    setMineSpy.mockResolvedValue({ id: "r1" });
    const res = makeRes();
    await controller.setMine({ user, body: { phone: "5125550123", userId: "evil" } }, res, vi.fn());
    expect(setMineSpy).toHaveBeenCalledWith({
      userId: "u1",
      subCompanyId: "c1",
      phone: "5125550123",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("clearMine returns success with no data", async () => {
    clearMineSpy.mockResolvedValue();
    const res = makeRes();
    await controller.clearMine({ user }, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it.each([
    ["getMine", getMineSpy],
    ["setMine", setMineSpy],
    ["clearMine", clearMineSpy],
  ])("%s forwards a service error to next()", async (name, spy) => {
    spy.mockRejectedValue(boom);
    const next = vi.fn();
    await controller[name]({ user, body: {} }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});

describe("GC recipient endpoints", () => {
  const req = {
    user,
    params: { id: "j1", recipientId: "r1" },
    body: { rosterId: "m1", phone: "5125550123" },
  };

  it("lists, adds (201) and removes, scoping to the caller's company and sites", async () => {
    getAllowedSpy.mockResolvedValue(["j1"]);
    listSpy.mockResolvedValue([]);
    addSpy.mockResolvedValue({ id: "r1" });
    removeSpy.mockResolvedValue();

    const listRes = makeRes();
    await controller.listForJobsite(req, listRes, vi.fn());
    expect(listSpy).toHaveBeenCalledWith({
      jobsiteId: "j1",
      gcCompanyId: "c1",
      allowedJobsiteIds: ["j1"],
    });

    const addRes = makeRes();
    await controller.addForJobsite(req, addRes, vi.fn());
    expect(addSpy).toHaveBeenCalledWith({
      jobsiteId: "j1",
      gcCompanyId: "c1",
      allowedJobsiteIds: ["j1"],
      rosterId: "m1",
      phone: "5125550123",
    });
    expect(addRes.status).toHaveBeenCalledWith(201);

    const removeRes = makeRes();
    await controller.removeForJobsite(req, removeRes, vi.fn());
    expect(removeSpy).toHaveBeenCalledWith({
      jobsiteId: "j1",
      recipientId: "r1",
      gcCompanyId: "c1",
      allowedJobsiteIds: ["j1"],
    });
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it.each([
    ["listForJobsite", listSpy],
    ["addForJobsite", addSpy],
    ["removeForJobsite", removeSpy],
  ])("%s forwards a service error to next()", async (name, spy) => {
    spy.mockRejectedValue(boom);
    const next = vi.fn();
    await controller[name](req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});

describe("handleInbound (Twilio webhook)", () => {
  const inbound = (body) => ({ body, get: vi.fn(() => "sig") });

  it("rejects a bad signature with a 403 and touches nothing", async () => {
    signatureSpy.mockReturnValue(false);
    const next = vi.fn();
    await controller.handleInbound(inbound({ From: "+15125550123", Body: "YES" }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(inboundSpy).not.toHaveBeenCalled();
  });

  it("answers a reply as TwiML, escaping the text", async () => {
    signatureSpy.mockReturnValue(true);
    inboundSpy.mockResolvedValue("Thanks & <bye>");
    const res = makeRes();
    await controller.handleInbound(inbound({ From: "+1 (512) 555-0123", Body: "YES" }), res, vi.fn());
    expect(inboundSpy).toHaveBeenCalledWith({ from: "+15125550123", body: "YES" });
    expect(res.type).toHaveBeenCalledWith("text/xml");
    expect(res.send).toHaveBeenCalledWith(
      "<Response><Message>Thanks &amp; &lt;bye&gt;</Message></Response>",
    );
  });

  it("answers an empty TwiML response when there is nothing to say", async () => {
    signatureSpy.mockReturnValue(true);
    inboundSpy.mockResolvedValue(null);
    const res = makeRes();
    await controller.handleInbound(inbound({ From: "+15125550123", Body: "STOP" }), res, vi.fn());
    expect(res.send).toHaveBeenCalledWith("<Response></Response>");
  });

  it("ignores a sender that is not a valid number", async () => {
    signatureSpy.mockReturnValue(true);
    const res = makeRes();
    await controller.handleInbound(inbound({ From: "garbage", Body: "YES" }), res, vi.fn());
    expect(inboundSpy).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith("<Response></Response>");
  });

  it("forwards a service error to next()", async () => {
    signatureSpy.mockReturnValue(true);
    inboundSpy.mockRejectedValue(boom);
    const next = vi.fn();
    await controller.handleInbound(inbound({ From: "+15125550123", Body: "YES" }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
