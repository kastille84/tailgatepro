import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { IntegrationConnectForm } from "../../../src/features/jobsites/IntegrationConnectForm";
import { INTEGRATION_PROVIDERS } from "../../../src/data/integrationProviders";
import theme from "../../../src/styles/theme";

const mockUseOnlineStatus = vi.fn();
const mockConnect = vi.fn();

vi.mock("../../../src/context/online-status", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock("../../../src/hooks/useConnectIntegration", () => ({
  useConnectIntegration: () => ({
    connectIntegration: mockConnect,
    isConnecting: false,
  }),
}));

const procore = INTEGRATION_PROVIDERS.find((p) => p.provider === "procore")!;
const acc = INTEGRATION_PROVIDERS.find((p) => p.provider === "acc")!;

const renderForm = (config = procore) =>
  render(
    <ThemeProvider theme={theme}>
      <IntegrationConnectForm jobsiteId="j1" config={config} />
    </ThemeProvider>,
  );

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("IntegrationConnectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({ isOnline: true });
    mockConnect.mockResolvedValue(undefined);
  });

  it("requires the credentials and project before calling the server", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /connect procore/i }));

    expect((await screen.findAllByText(/this field is required/i)).length).toBe(4);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("masks the client secret", () => {
    renderForm();
    expect((screen.getByLabelText(/client secret/i) as HTMLInputElement).type).toBe("password");
    expect((screen.getByLabelText(/client id/i) as HTMLInputElement).type).toBe("text");
  });

  it("submits Procore credentials with the company id and no folder", async () => {
    renderForm();

    fill(/client id/i, "id");
    fill(/client secret/i, "secret");
    fill(/procore company id/i, "9");
    fill(/procore project id/i, "77");
    fireEvent.click(screen.getByRole("button", { name: /connect procore/i }));

    await waitFor(() =>
      expect(mockConnect).toHaveBeenCalledWith({
        jobsiteId: "j1",
        provider: "procore",
        credentials: { clientId: "id", clientSecret: "secret", companyId: "9" },
        projectId: "77",
        folderId: undefined,
      }),
    );
  });

  it("requires a folder for ACC and sends it", async () => {
    renderForm(acc);
    expect(screen.queryByLabelText(/company id/i)).toBeNull();

    fill(/client id/i, "id");
    fill(/client secret/i, "secret");
    fill(/acc project id/i, "p");
    fireEvent.click(screen.getByRole("button", { name: /connect autodesk acc/i }));
    expect(await screen.findByText(/this field is required/i)).toBeDefined();
    expect(mockConnect).not.toHaveBeenCalled();

    fill(/folder id/i, "urn:folder");
    fireEvent.click(screen.getByRole("button", { name: /connect autodesk acc/i }));
    await waitFor(() =>
      expect(mockConnect).toHaveBeenCalledWith({
        jobsiteId: "j1",
        provider: "acc",
        credentials: { clientId: "id", clientSecret: "secret" },
        projectId: "p",
        folderId: "urn:folder",
      }),
    );
  });

  it("clears the form after a successful connect", async () => {
    renderForm();
    fill(/client id/i, "id");
    fill(/client secret/i, "secret");
    fill(/procore company id/i, "9");
    fill(/procore project id/i, "77");
    fireEvent.click(screen.getByRole("button", { name: /connect procore/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/client secret/i) as HTMLInputElement).value).toBe(""),
    );
  });

  it("keeps the values when the server rejects the credentials", async () => {
    mockConnect.mockRejectedValue(new Error("rejected"));
    renderForm();
    fill(/client id/i, "id");
    fill(/client secret/i, "secret");
    fill(/procore company id/i, "9");
    fill(/procore project id/i, "77");
    fireEvent.click(screen.getByRole("button", { name: /connect procore/i }));

    await waitFor(() => expect(mockConnect).toHaveBeenCalled());
    expect((screen.getByLabelText(/client secret/i) as HTMLInputElement).value).toBe("secret");
  });

  it("disables everything while offline", () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false });
    renderForm();

    expect((screen.getByLabelText(/client id/i) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /connect procore/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
