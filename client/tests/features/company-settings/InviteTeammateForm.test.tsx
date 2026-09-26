import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";

import { PlanLimitError } from "../../../src/utils/PlanLimitError";

import { InviteTeammateForm } from "../../../src/features/company-settings/InviteTeammateForm";
import theme from "../../../src/styles/theme";

const mockUseOnlineStatus = vi.fn();
const mockUseInviteTeammate = vi.fn();
const mockInvite = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useInviteTeammate", () => ({
  useInviteTeammate: () => mockUseInviteTeammate(),
}));

const renderForm = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <InviteTeammateForm />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("InviteTeammateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockInvite.mockResolvedValue(undefined);
    mockUseInviteTeammate.mockReturnValue({
      inviteTeammate: mockInvite,
      isInviting: false,
    });
  });

  it("renders an email field, a role select defaulted to Foreman, and a Send invite button", () => {
    renderForm();

    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect((screen.getByLabelText(/role/i) as HTMLSelectElement).value).toBe(
      "foreman",
    );
    expect(screen.getByRole("button", { name: /send invite/i })).toBeDefined();
  });

  it("asks for an email instead of calling the server when the field is empty", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByText(/email is required/i)).toBeDefined();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before calling the server", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeDefined();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("submits the exact { email, role } payload and resets the form on success", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "newhire@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: "safety_manager" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(mockInvite).toHaveBeenCalledWith({
        email: "newhire@example.com",
        role: "safety_manager",
      }),
    );
    await waitFor(() =>
      expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(""),
    );
  });

  it("leaves the form filled when sending fails (the hook already toasts the reason)", async () => {
    mockInvite.mockRejectedValue(new Error("You don't have permission to do this"));
    renderForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "newhire@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(mockInvite).toHaveBeenCalled());
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(
      "newhire@example.com",
    );
  });

  it("shows the Send invite button as busy while inviting", () => {
    mockUseInviteTeammate.mockReturnValue({
      inviteTeammate: mockInvite,
      isInviting: true,
    });
    renderForm();

    expect(
      screen
        .getByRole("button", { name: /send invite/i })
        .getAttribute("aria-busy"),
    ).toBe("true");
  });

  describe("offline", () => {
    beforeEach(() => {
      mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    });

    it("explains why sending is unavailable and disables the fields and button", () => {
      renderForm();

      expect(screen.getByRole("status").textContent).toMatch(/you're offline/i);
      expect((screen.getByLabelText(/email/i) as HTMLInputElement).disabled).toBe(
        true,
      );
      expect((screen.getByLabelText(/role/i) as HTMLSelectElement).disabled).toBe(
        true,
      );
      expect(
        (screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });
  });

  it("shows no offline note while online", () => {
    renderForm();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows an inline upgrade prompt linking to /pricing on a plan-limit error", () => {
    mockUseInviteTeammate.mockReturnValue({
      inviteTeammate: mockInvite,
      isInviting: false,
      planLimitError: new PlanLimitError("Your plan allows 1 seat", 1),
    });
    renderForm();

    expect(screen.getByRole("alert").textContent).toContain("Your plan allows 1 seat");
    expect(
      screen.getByRole("link", { name: /see plans/i }).getAttribute("href"),
    ).toBe("/pricing");
  });
});
