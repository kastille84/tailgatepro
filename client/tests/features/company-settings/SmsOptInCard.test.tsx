import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { SmsOptInCard } from "../../../src/features/company-settings/SmsOptInCard";
import theme from "../../../src/styles/theme";

const mockUseOnlineStatus = vi.fn();
const mockUseMySmsOptIn = vi.fn();
const mockSave = vi.fn();
const mockClear = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useMySmsOptIn", () => ({
  useMySmsOptIn: () => mockUseMySmsOptIn(),
}));

const state = (overrides: Record<string, unknown> = {}) => ({
  optIn: null,
  isLoading: false,
  isError: false,
  saveOptIn: mockSave,
  isSaving: false,
  clearOptIn: mockClear,
  isClearing: false,
  ...overrides,
});

const renderCard = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <SmsOptInCard />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("SmsOptInCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockUseMySmsOptIn.mockReturnValue(state());
    mockSave.mockResolvedValue(undefined);
    mockClear.mockResolvedValue(undefined);
  });

  it("shows a loading status while the opt-in loads", () => {
    mockUseMySmsOptIn.mockReturnValue(state({ isLoading: true }));
    renderCard();
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
  });

  it("shows an error note when the opt-in cannot be loaded", () => {
    mockUseMySmsOptIn.mockReturnValue(state({ isError: true }));
    renderCard();
    expect(screen.getByRole("alert").textContent).toMatch(/could not load/i);
  });

  it("requires consent before saving, showing the reason", async () => {
    renderCard();

    fireEvent.change(screen.getByLabelText(/mobile number/i), {
      target: { value: "5125550123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /turn on reminders/i }));

    expect(await screen.findByText(/agree to receive texts/i)).toBeDefined();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("requires a phone number", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /turn on reminders/i }));

    expect(await screen.findByText(/enter your mobile number/i)).toBeDefined();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("saves the number once the consent box is checked, then resets the form", async () => {
    renderCard();

    fireEvent.change(screen.getByLabelText(/mobile number/i), {
      target: { value: "(512) 555-0123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /turn on reminders/i }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith("(512) 555-0123"));
    await waitFor(() =>
      expect((screen.getByLabelText(/mobile number/i) as HTMLInputElement).value).toBe(""),
    );
  });

  it("keeps the form when saving fails (the hook already toasts)", async () => {
    mockSave.mockRejectedValue(new Error("Bad number"));
    renderCard();

    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /turn on reminders/i }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect((screen.getByLabelText(/mobile number/i) as HTMLInputElement).value).toBe("123");
  });

  it("shows the active number and lets the foreman turn reminders off", async () => {
    mockUseMySmsOptIn.mockReturnValue(
      state({ optIn: { phone: "+15125550123", optedOut: false } }),
    );
    renderCard();

    expect(screen.getByText(/reminders are on for \+15125550123/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /update number/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /turn off reminders/i }));
    await waitFor(() => expect(mockClear).toHaveBeenCalled());
  });

  it("survives a failed turn-off (the hook already toasts)", async () => {
    mockClear.mockRejectedValue(new Error("nope"));
    mockUseMySmsOptIn.mockReturnValue(
      state({ optIn: { phone: "+15125550123", optedOut: false } }),
    );
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /turn off reminders/i }));
    await waitFor(() => expect(mockClear).toHaveBeenCalled());
  });

  it("explains a STOP and how to resume", () => {
    mockUseMySmsOptIn.mockReturnValue(
      state({ optIn: { phone: "+15125550123", optedOut: true } }),
    );
    renderCard();

    expect(screen.getByText(/paused because you replied stop/i)).toBeDefined();
  });

  it("disables everything and explains when offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderCard();

    expect(screen.getByText(/you.re offline/i)).toBeDefined();
    expect((screen.getByLabelText(/mobile number/i) as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: /turn on reminders/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
