// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const crypto = require("crypto");
const envUtils = require("../utility/envUtils");
const smsService = require("./sms");

const keys = (twilio) => ({ twilio });
const configured = {
  accountSid: "AC123",
  authToken: "secret-token",
  fromNumber: "+18885550100",
  webhookUrl: "https://api.example.com/webhook/twilio/sms",
};

let keysSpy;
let logSpy;
let errorSpy;

beforeEach(() => {
  keysSpy = vi.spyOn(envUtils, "keysBasedOnEnv").mockReturnValue(keys(configured));
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sendSms", () => {
  it("logs instead of sending when Twilio is not configured", async () => {
    keysSpy.mockReturnValue(keys({}));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(smsService.sendSms({ to: "+15125550123", body: "hi" })).resolves.toEqual({
      sent: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it("posts the message to Twilio with basic auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(smsService.sendSms({ to: "+15125550123", body: "hello" })).resolves.toEqual({
      sent: true,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from("AC123:secret-token").toString("base64")}`,
    );
    expect(options.body.get("To")).toBe("+15125550123");
    expect(options.body.get("From")).toBe("+18885550100");
    expect(options.body.get("Body")).toBe("hello");
  });

  it("reports a rejected message without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(smsService.sendSms({ to: "+15125550123", body: "x" })).resolves.toEqual({
      sent: false,
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("reports a network failure without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(smsService.sendSms({ to: "+15125550123", body: "x" })).resolves.toEqual({
      sent: false,
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("isValidTwilioSignature", () => {
  const params = { From: "+15125550123", Body: "YES" };
  const sign = (token, url, p) =>
    crypto
      .createHmac("sha1", token)
      .update(
        Object.keys(p)
          .sort()
          .reduce((acc, key) => acc + key + p[key], url),
      )
      .digest("base64");

  it("accepts a correct signature", () => {
    const signature = sign(configured.authToken, configured.webhookUrl, params);
    expect(smsService.isValidTwilioSignature({ signature, params })).toBe(true);
  });

  it("rejects a wrong, missing or tampered signature", () => {
    const signature = sign(configured.authToken, configured.webhookUrl, params);
    expect(smsService.isValidTwilioSignature({ signature: "nope", params })).toBe(false);
    expect(smsService.isValidTwilioSignature({ signature: undefined, params })).toBe(false);
    expect(
      smsService.isValidTwilioSignature({ signature, params: { ...params, Body: "STOP" } }),
    ).toBe(false);
  });

  it("rejects everything when the webhook is not configured", () => {
    const signature = sign(configured.authToken, configured.webhookUrl, params);
    keysSpy.mockReturnValue(keys({ authToken: configured.authToken }));
    expect(smsService.isValidTwilioSignature({ signature, params })).toBe(false);
  });
});
