// Plain CommonJS — see requireAuth.test.js for why (nested require() sharing).
const envUtils = require("../utility/envUtils");
const { MAILGUN_TEMPLATES } = require("../constants/templates");
const emailService = require("./email");
const {
  sendMeetingLogEmail,
  sendCompanyInviteEmail,
  sendJobsiteInviteEmail,
  getMailgunClient,
} = emailService;

const keysSpy = vi.spyOn(envUtils, "keysBasedOnEnv");
const clientSpy = vi.spyOn(emailService, "getMailgunClient");

const params = {
  to: "gc@example.com",
  projectName: "Downtown Highrise",
  companyName: "Acme Roofing",
  pdfUrl: "https://signed.example/report.pdf",
  meetingDate: "2026-09-14T01:00:00.000Z",
};

let consoleLogSpy;
let consoleErrorSpy;

beforeEach(() => {
  keysSpy.mockReset();
  clientSpy.mockReset();
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe("email service: getMailgunClient", () => {
  it("returns null when apiKey is unset", () => {
    keysSpy.mockReturnValue({ mailgun: { apiKey: undefined, domain: "mg.example.com" } });

    expect(getMailgunClient()).toBeNull();
  });

  it("returns null when domain is unset", () => {
    keysSpy.mockReturnValue({ mailgun: { apiKey: "key-123", domain: undefined } });

    expect(getMailgunClient()).toBeNull();
  });

  it("returns a client object when both apiKey and domain are set", () => {
    keysSpy.mockReturnValue({ mailgun: { apiKey: "key-123", domain: "mg.example.com" } });

    const result = getMailgunClient();

    expect(result).not.toBeNull();
    expect(result.domain).toBe("mg.example.com");
    expect(result.client.messages).toBeDefined();
  });
});

describe("email service: sendMeetingLogEmail", () => {
  it("logs the composed email instead of sending when Mailgun isn't configured", async () => {
    clientSpy.mockReturnValue(null);

    await sendMeetingLogEmail(params);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("not configured"),
      expect.objectContaining({
        to: params.to,
        subject: expect.stringContaining(params.companyName),
        variables: expect.objectContaining({
          companyName: params.companyName,
          projectName: params.projectName,
          pdfUrl: params.pdfUrl,
        }),
      }),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("sends via the configured Mailgun template with a dynamic subject and stringified variables", async () => {
    const create = vi.fn().mockResolvedValue({ id: "<msg-1>", message: "Queued" });
    clientSpy.mockReturnValue({
      client: { messages: { create } },
      domain: "mg.example.com",
    });

    await sendMeetingLogEmail(params);

    expect(create).toHaveBeenCalledTimes(1);
    const [domain, data] = create.mock.calls[0];
    expect(domain).toBe("mg.example.com");
    expect(data.to).toEqual([params.to]);
    expect(data.from).toContain("mg.example.com");
    expect(data["h:Reply-To"]).toBe("support@mg.example.com");
    expect(data.template).toBe(MAILGUN_TEMPLATES.MEETING_LOG_REPORT);
    expect(data.subject).toContain(params.companyName);
    expect(data.subject).toContain(params.projectName);

    const variables = JSON.parse(data["h:X-Mailgun-Variables"]);
    expect(variables).toEqual({
      companyName: params.companyName,
      projectName: params.projectName,
      pdfUrl: params.pdfUrl,
      completedDate: "September 14, 2026 at 1:00 AM UTC",
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("catches and logs a Mailgun send failure instead of throwing", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Mailgun 500"));
    clientSpy.mockReturnValue({
      client: { messages: { create } },
      domain: "mg.example.com",
    });

    await expect(sendMeetingLogEmail(params)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("email service: sendCompanyInviteEmail", () => {
  const inviteParams = {
    to: "newhire@example.com",
    companyName: "Rivera Electric",
    inviterName: "Alex Builder",
    role: "Foreman",
    acceptUrl: "https://localhost:5173/invite/abc123",
  };

  it("logs the composed email instead of sending when Mailgun isn't configured", async () => {
    clientSpy.mockReturnValue(null);

    await sendCompanyInviteEmail(inviteParams);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("not configured"),
      expect.objectContaining({
        to: inviteParams.to,
        subject: expect.stringContaining(inviteParams.inviterName),
        variables: expect.objectContaining({
          companyName: inviteParams.companyName,
          inviterName: inviteParams.inviterName,
          role: inviteParams.role,
          acceptUrl: inviteParams.acceptUrl,
        }),
      }),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("sends via the configured Mailgun template with a dynamic subject and stringified variables", async () => {
    const create = vi.fn().mockResolvedValue({ id: "<msg-1>", message: "Queued" });
    clientSpy.mockReturnValue({
      client: { messages: { create } },
      domain: "mg.example.com",
    });

    await sendCompanyInviteEmail(inviteParams);

    expect(create).toHaveBeenCalledTimes(1);
    const [domain, data] = create.mock.calls[0];
    expect(domain).toBe("mg.example.com");
    expect(data.to).toEqual([inviteParams.to]);
    expect(data.from).toContain("mg.example.com");
    expect(data["h:Reply-To"]).toBe("support@mg.example.com");
    expect(data.template).toBe(MAILGUN_TEMPLATES.COMPANY_INVITE);
    expect(data.subject).toContain(inviteParams.inviterName);
    expect(data.subject).toContain(inviteParams.companyName);

    const variables = JSON.parse(data["h:X-Mailgun-Variables"]);
    expect(variables).toEqual({
      companyName: inviteParams.companyName,
      inviterName: inviteParams.inviterName,
      role: inviteParams.role,
      acceptUrl: inviteParams.acceptUrl,
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("catches and logs a Mailgun send failure instead of throwing", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Mailgun 500"));
    clientSpy.mockReturnValue({
      client: { messages: { create } },
      domain: "mg.example.com",
    });

    await expect(sendCompanyInviteEmail(inviteParams)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("email service: sendJobsiteInviteEmail", () => {
  const inviteParams = {
    to: "jane@acme.com",
    gcCompanyName: "Turner Construction",
    jobsiteName: "Riverside Tower",
    inviterName: "Alex Builder",
    acceptUrl: "https://localhost:5173/jobsite-invite/abc123",
  };

  it("logs the composed email instead of sending when Mailgun isn't configured", async () => {
    clientSpy.mockReturnValue(null);

    await sendJobsiteInviteEmail(inviteParams);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("not configured"),
      expect.objectContaining({
        to: inviteParams.to,
        subject: expect.stringContaining(inviteParams.jobsiteName),
        variables: expect.objectContaining({
          gcCompanyName: inviteParams.gcCompanyName,
          jobsiteName: inviteParams.jobsiteName,
          inviterName: inviteParams.inviterName,
          acceptUrl: inviteParams.acceptUrl,
        }),
      }),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("sends via the jobsite-invite Mailgun template with a dynamic subject and stringified variables", async () => {
    const create = vi.fn().mockResolvedValue({ id: "<msg-1>", message: "Queued" });
    clientSpy.mockReturnValue({
      client: { messages: { create } },
      domain: "mg.example.com",
    });

    await sendJobsiteInviteEmail(inviteParams);

    expect(create).toHaveBeenCalledTimes(1);
    const [domain, data] = create.mock.calls[0];
    expect(domain).toBe("mg.example.com");
    expect(data.to).toEqual([inviteParams.to]);
    expect(data.from).toContain("mg.example.com");
    expect(data["h:Reply-To"]).toBe("support@mg.example.com");
    expect(data.template).toBe(MAILGUN_TEMPLATES.JOBSITE_INVITE);
    expect(data.subject).toContain(inviteParams.gcCompanyName);
    expect(data.subject).toContain(inviteParams.jobsiteName);

    const variables = JSON.parse(data["h:X-Mailgun-Variables"]);
    expect(variables).toEqual({
      gcCompanyName: inviteParams.gcCompanyName,
      jobsiteName: inviteParams.jobsiteName,
      inviterName: inviteParams.inviterName,
      acceptUrl: inviteParams.acceptUrl,
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("catches and logs a Mailgun send failure instead of throwing", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Mailgun 500"));
    clientSpy.mockReturnValue({
      client: { messages: { create } },
      domain: "mg.example.com",
    });

    await expect(sendJobsiteInviteEmail(inviteParams)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
