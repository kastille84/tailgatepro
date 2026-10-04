import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { InviteSubcontractorForm } from "../../../src/features/jobsites/InviteSubcontractorForm";
import theme from "../../../src/styles/theme";

const mockUseOnlineStatus = vi.fn();
const mockInvite = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useInviteSubcontractor", () => ({
  useInviteSubcontractor: () => ({
    inviteSubcontractor: mockInvite,
    isInviting: false,
  }),
}));

const renderForm = () =>
  render(
    <ThemeProvider theme={theme}>
      <InviteSubcontractorForm jobsiteId="j1" />
    </ThemeProvider>,
  );

describe("InviteSubcontractorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockInvite.mockResolvedValue(undefined);
  });

  it("requires an email before calling the server", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByText(/email is required/i)).toBeDefined();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "nope" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByText(/valid email/i)).toBeDefined();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("submits { jobsiteId, email } and clears the field on success", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "sub@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(mockInvite).toHaveBeenCalledWith({
        jobsiteId: "j1",
        email: "sub@example.com",
      }),
    );
    await waitFor(() =>
      expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(
        "",
      ),
    );
  });

  it("keeps the email filled when sending fails", async () => {
    mockInvite.mockRejectedValue(new Error("nope"));
    renderForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "sub@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(mockInvite).toHaveBeenCalled());
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(
      "sub@example.com",
    );
  });

  it("disables the field and button while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderForm();

    expect((screen.getByLabelText(/email/i) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: /send invite/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
