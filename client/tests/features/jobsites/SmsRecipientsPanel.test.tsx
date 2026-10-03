import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { SmsRecipientsPanel } from "../../../src/features/jobsites/SmsRecipientsPanel";
import theme from "../../../src/styles/theme";
import type { Jobsite } from "../../../src/interfaces/jobsite";

const mockUseOnlineStatus = vi.fn();
const mockUseRecipients = vi.fn();
const mockAdd = vi.fn();
const mockRemove = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useJobsiteSmsRecipients", () => ({
  useJobsiteSmsRecipients: (id: string) => mockUseRecipients(id),
}));

const jobsite: Jobsite = {
  id: "j1",
  gcCompanyId: "gc-1",
  name: "Riverside",
  status: "active",
  archivedAt: null,
  createdBySub: false,
  plan: "site_pro",
  sitePro: true,
  meetingCadence: "daily",
  smsNudgesEnabled: true,
  timezone: "America/Chicago",
  createdAt: "x",
  subcontractors: [
    { id: "m1", email: "a@x.com", status: "accepted", companyName: "Acme Electric", locked: false },
    { id: "m2", email: "b@x.com", status: "accepted", companyName: null, locked: false },
    { id: "m3", email: "c@x.com", status: "pending", companyName: null, locked: false },
    { id: "m4", email: null, status: "accepted", companyName: null, locked: true },
  ],
};

const recipient = (overrides: Record<string, unknown> = {}) => ({
  id: "r1",
  subCompanyId: "sub1",
  jobsiteId: "j1",
  phone: "+15125550123",
  source: "gc",
  consentedAt: "x",
  confirmedAt: null,
  optedOut: false,
  subCompanyName: "Acme Electric",
  ...overrides,
});

const state = (overrides: Record<string, unknown> = {}) => ({
  recipients: [],
  isLoading: false,
  isError: false,
  addRecipient: mockAdd,
  isAdding: false,
  removeRecipient: mockRemove,
  isRemoving: false,
  ...overrides,
});

const renderPanel = (site: Jobsite = jobsite) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <SmsRecipientsPanel jobsite={site} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("SmsRecipientsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseRecipients.mockReturnValue(state());
    mockAdd.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  it("says whether reminders are on for the site", () => {
    renderPanel();
    expect(screen.getByText(/text reminders are on for this job site/i)).toBeDefined();
    expect(mockUseRecipients).toHaveBeenCalledWith("j1");
  });

  it("tells the GC to turn reminders on when they are off", () => {
    renderPanel({ ...jobsite, smsNudgesEnabled: false });
    expect(screen.getByText(/text reminders are off/i)).toBeDefined();
  });

  it("offers only accepted, unlocked subs, labelled by company or email", () => {
    renderPanel();
    const select = screen.getByLabelText("Subcontractor") as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toContain("Acme Electric");
    expect(labels).toContain("b@x.com");
    expect(labels).not.toContain("c@x.com");
    expect(labels).toHaveLength(3); // placeholder + two subs
  });

  it("falls back to a generic label for a sub with neither name nor email", () => {
    renderPanel({
      ...jobsite,
      subcontractors: [
        { id: "m9", email: null, status: "accepted", companyName: null, locked: false },
      ],
    });
    const select = screen.getByLabelText("Subcontractor") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toContain(
      "Subcontractor",
    );
  });

  it("explains there is nobody to add yet when no sub has accepted", () => {
    renderPanel({ ...jobsite, subcontractors: [] });
    expect(screen.getByText(/once a subcontractor accepts/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /add number/i })).toBeNull();
  });

  it("validates before adding", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /add number/i }));

    expect(await screen.findByText(/choose a subcontractor/i)).toBeDefined();
    expect(screen.getByText(/enter a mobile number/i)).toBeDefined();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("adds a number for the chosen sub, then resets", async () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText("Subcontractor"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText(/foreman mobile number/i), {
      target: { value: "(512) 555-0123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add number/i }));

    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith({ rosterId: "m1", phone: "(512) 555-0123" }),
    );
    await waitFor(() =>
      expect((screen.getByLabelText(/foreman mobile number/i) as HTMLInputElement).value).toBe(""),
    );
  });

  it("keeps the form when adding fails (the hook already toasts)", async () => {
    mockAdd.mockRejectedValue(new Error("Bad number"));
    renderPanel();

    fireEvent.change(screen.getByLabelText("Subcontractor"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText(/foreman mobile number/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /add number/i }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalled());
    expect((screen.getByLabelText(/foreman mobile number/i) as HTMLInputElement).value).toBe("123");
  });

  it("lists numbers with their confirmation state", () => {
    mockUseRecipients.mockReturnValue(
      state({
        recipients: [
          recipient({ id: "r1" }),
          recipient({ id: "r2", phone: "+15125550124", confirmedAt: "x" }),
          recipient({ id: "r3", phone: "+15125550125", confirmedAt: "x", optedOut: true }),
          recipient({ id: "r4", phone: "+15125550126", subCompanyName: null }),
        ],
      }),
    );
    renderPanel();

    // r1 and r4 are both still unconfirmed.
    expect(screen.getAllByText("Awaiting YES reply")).toHaveLength(2);
    expect(screen.getByText("Confirmed")).toBeDefined();
    expect(screen.getByText("Opted out")).toBeDefined();
    expect(screen.getByText("+15125550123")).toBeDefined();
    // A recipient with no embedded company name falls back to a generic label.
    // Three rows plus the sub picker's own option.
    expect(screen.getAllByText("Acme Electric")).toHaveLength(4);
    // The form field's label, plus the fallback name on the fourth row.
    expect(screen.getAllByText("Subcontractor")).toHaveLength(2);
  });

  it("does not list numbers while loading", () => {
    mockUseRecipients.mockReturnValue(state({ isLoading: true, recipients: [recipient()] }));
    renderPanel();
    expect(screen.queryByText("+15125550123")).toBeNull();
  });

  it("removes a number, and survives a failed remove (the hook toasts)", async () => {
    mockUseRecipients.mockReturnValue(state({ recipients: [recipient()] }));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /remove \+15125550123/i }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith("r1"));

    mockRemove.mockRejectedValue(new Error("nope"));
    fireEvent.click(screen.getByRole("button", { name: /remove \+15125550123/i }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledTimes(2));
  });

  it("shows an error note when the numbers cannot be loaded", () => {
    mockUseRecipients.mockReturnValue(state({ isError: true }));
    renderPanel();
    expect(screen.getByRole("alert").textContent).toMatch(/could not load/i);
  });

  it("disables the controls when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    mockUseRecipients.mockReturnValue(state({ recipients: [recipient()] }));
    renderPanel();

    expect((screen.getByRole("button", { name: /add number/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: /remove \+15125550123/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
