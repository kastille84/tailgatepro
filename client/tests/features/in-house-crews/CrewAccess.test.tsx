import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import toast from "react-hot-toast";
import QRCode from "qrcode";

import { CrewAccessModal } from "../../../src/features/in-house-crews/CrewAccessModal";
import { CrewJoinLinkSection } from "../../../src/features/in-house-crews/CrewJoinLinkSection";
import { CrewPeopleSection } from "../../../src/features/in-house-crews/CrewPeopleSection";
import { triggerBrowserDownload } from "../../../src/utils/triggerBrowserDownload";
import theme from "../../../src/styles/theme";

vi.mock("react-hot-toast");
vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn() } }));
vi.mock("../../../src/utils/triggerBrowserDownload", () => ({
  triggerBrowserDownload: vi.fn(),
}));

const mockUseMembers = vi.fn();
vi.mock("../../../src/hooks/useCrewMembers", () => ({
  useCrewMembers: (crewId: string | undefined) => mockUseMembers(crewId),
}));

const mockUseJoinLink = vi.fn();
vi.mock("../../../src/hooks/useCrewJoinLink", () => ({
  useCrewJoinLink: (crewId: string | undefined) => mockUseJoinLink(crewId),
}));

const crew = { id: "c1", name: "Hyperion - Framing", archivedAt: null, createdAt: "x" };
const archivedCrew = { ...crew, archivedAt: "2026-02-01" };

const jamie = { id: "u1", name: "Jamie Foreman", role: "foreman" as const, email: "j@example.com" };
const sam = { id: "u2", name: "Sam Office", role: "safety_manager" as const, email: null };
const pat = { id: "u3", name: "Pat Admin", role: "admin" as const, email: "p@example.com" };

const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const setClipboard = (clipboard: unknown) =>
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });

describe("CrewPeopleSection", () => {
  const removeMember = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    removeMember.mockResolvedValue(undefined);
    mockUseMembers.mockReturnValue({
      members: [jamie, sam, pat],
      isLoading: false,
      isError: false,
      removeMember,
      isRemoving: false,
    });
  });

  it("lists each person with their role label and email when there is one", () => {
    wrap(<CrewPeopleSection crew={crew} />);

    expect(mockUseMembers).toHaveBeenCalledWith("c1");
    expect(screen.getByText("Jamie Foreman")).toBeDefined();
    expect(screen.getByText("Foreman · j@example.com")).toBeDefined();
    expect(screen.getByText("Safety Director")).toBeDefined();
    expect(screen.getByText("Admin · p@example.com")).toBeDefined();
  });

  it("shows loading, error and empty states", () => {
    mockUseMembers.mockReturnValue({ members: [], isLoading: true, isError: false, removeMember });
    const { unmount } = wrap(<CrewPeopleSection crew={crew} />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByText("No one has joined yet.")).toBeNull();
    unmount();

    mockUseMembers.mockReturnValue({ members: [], isLoading: false, isError: true, removeMember });
    const second = wrap(<CrewPeopleSection crew={crew} />);
    expect(screen.getByRole("alert").textContent).toMatch(/could not load/i);
    expect(screen.queryByText("No one has joined yet.")).toBeNull();
    second.unmount();

    mockUseMembers.mockReturnValue({ members: [], isLoading: false, isError: false, removeMember });
    wrap(<CrewPeopleSection crew={crew} />);
    expect(screen.getByText("No one has joined yet.")).toBeDefined();
  });

  it("confirms before removing, then removes the chosen person", async () => {
    wrap(<CrewPeopleSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Jamie Foreman" }));
    expect(screen.getByText(/their sign-in is deleted/i)).toBeDefined();
    expect(removeMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeMember).toHaveBeenCalledWith("u1"));
    await waitFor(() => expect(screen.queryByText(/their sign-in is deleted/i)).toBeNull());
  });

  it("closes the confirmation even when the removal fails", async () => {
    removeMember.mockRejectedValue(new Error("nope"));
    wrap(<CrewPeopleSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Sam Office" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeMember).toHaveBeenCalledWith("u2"));
    await waitFor(() => expect(screen.queryByText(/their sign-in is deleted/i)).toBeNull());
  });

  it("cancels without removing anyone", () => {
    wrap(<CrewPeopleSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Pat Admin" }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(removeMember).not.toHaveBeenCalled();
    expect(screen.queryByText(/their sign-in is deleted/i)).toBeNull();
  });
});

describe("CrewJoinLinkSection", () => {
  const createLink = vi.fn();
  const turnOff = vi.fn();
  const link = {
    joinUrl: "https://app.example.com/crew-join/tok",
    expiresAt: "2026-02-08T12:00:00.000Z",
    usesLeft: 7,
  };
  const state = (overrides = {}) => ({
    link: null,
    isLoading: false,
    isError: false,
    createLink,
    isCreating: false,
    turnOff,
    isTurningOff: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    createLink.mockResolvedValue(link);
    turnOff.mockResolvedValue(undefined);
    mockUseJoinLink.mockReturnValue(state());
    vi.mocked(QRCode.toCanvas).mockResolvedValue(undefined as never);
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    setClipboard(undefined);
  });

  it("offers to create a link when the crew has none", async () => {
    wrap(<CrewJoinLinkSection crew={crew} />);

    expect(mockUseJoinLink).toHaveBeenCalledWith("c1");
    expect(screen.getByText(/anyone with it can join as a foreman/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Create join link" }));
    await waitFor(() => expect(createLink).toHaveBeenCalled());
  });

  it("swallows a failed create (already toasted by the hook)", async () => {
    createLink.mockRejectedValue(new Error("nope"));
    wrap(<CrewJoinLinkSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: "Create join link" }));

    await waitFor(() => expect(createLink).toHaveBeenCalled());
  });

  it("shows loading and error states without any controls", () => {
    mockUseJoinLink.mockReturnValue(state({ isLoading: true }));
    const { unmount } = wrap(<CrewJoinLinkSection crew={crew} />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Create join link" })).toBeNull();
    unmount();

    mockUseJoinLink.mockReturnValue(state({ isError: true }));
    wrap(<CrewJoinLinkSection crew={crew} />);
    expect(screen.getByRole("alert").textContent).toMatch(/could not load the join link/i);
    expect(screen.queryByRole("button", { name: "Create join link" })).toBeNull();
  });

  it("draws the QR for an existing link and says how long it lasts and what it allows", async () => {
    mockUseJoinLink.mockReturnValue(state({ link }));
    wrap(<CrewJoinLinkSection crew={crew} />);

    await waitFor(() =>
      expect(QRCode.toCanvas).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        link.joinUrl,
        expect.objectContaining({ width: 180 }),
      ),
    );
    expect(screen.getByText(link.joinUrl)).toBeDefined();
    expect(
      screen.getByRole("img", { name: /qr code linking to join hyperion - framing/i }),
    ).toBeDefined();
    expect(screen.getByText(/7 spots left/)).toBeDefined();
    expect(screen.getByText(/can join hyperion - framing as a foreman/i)).toBeDefined();
  });

  it("says one spot, not one spots", () => {
    mockUseJoinLink.mockReturnValue(state({ link: { ...link, usesLeft: 1 } }));
    wrap(<CrewJoinLinkSection crew={crew} />);

    expect(screen.getByText(/1 spot left/)).toBeDefined();
  });

  it("toasts when the QR cannot be rendered", async () => {
    vi.mocked(QRCode.toCanvas).mockRejectedValue(new Error("boom"));
    mockUseJoinLink.mockReturnValue(state({ link }));
    wrap(<CrewJoinLinkSection crew={crew} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not render the QR code."));
  });

  it("copies the link, and says so when the clipboard refuses", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    mockUseJoinLink.mockReturnValue(state({ link }));
    wrap(<CrewJoinLinkSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Join link copied"));
    expect(writeText).toHaveBeenCalledWith(link.joinUrl);

    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not copy. Select the link and copy it manually.",
      ),
    );
  });

  it("downloads the QR named after the crew, and handles an empty canvas", async () => {
    const blob = new Blob(["fake"], { type: "image/png" });
    const toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb) => cb(blob));
    mockUseJoinLink.mockReturnValue(state({ link }));
    wrap(<CrewJoinLinkSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: /download qr/i }));
    await waitFor(() =>
      expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, "hyperion-framing-join-qr.png"),
    );

    toBlobSpy.mockImplementation((cb) => cb(null));
    fireEvent.click(screen.getByRole("button", { name: /download qr/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not download the QR code."),
    );
    toBlobSpy.mockRestore();
  });

  it("falls back to a generic filename when the crew name has no letters or digits", async () => {
    const blob = new Blob(["fake"], { type: "image/png" });
    const toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb) => cb(blob));
    mockUseJoinLink.mockReturnValue(state({ link }));
    wrap(<CrewJoinLinkSection crew={{ ...crew, name: "!!!" }} />);

    fireEvent.click(screen.getByRole("button", { name: /download qr/i }));

    await waitFor(() =>
      expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, "crew-join-qr.png"),
    );
    toBlobSpy.mockRestore();
  });

  it("makes a new link, and swallows a failure", async () => {
    mockUseJoinLink.mockReturnValue(state({ link }));
    wrap(<CrewJoinLinkSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: "Make a new link" }));
    await waitFor(() => expect(createLink).toHaveBeenCalledTimes(1));

    createLink.mockRejectedValue(new Error("nope"));
    fireEvent.click(screen.getByRole("button", { name: "Make a new link" }));
    await waitFor(() => expect(createLink).toHaveBeenCalledTimes(2));
  });

  it("turns the link off, and swallows a failure", async () => {
    mockUseJoinLink.mockReturnValue(state({ link }));
    wrap(<CrewJoinLinkSection crew={crew} />);

    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(turnOff).toHaveBeenCalledTimes(1));

    turnOff.mockRejectedValue(new Error("nope"));
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(turnOff).toHaveBeenCalledTimes(2));
  });

  it("does not offer a link for an archived crew", () => {
    wrap(<CrewJoinLinkSection crew={archivedCrew} />);

    expect(mockUseJoinLink).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Restore this crew to make a join link.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Create join link" })).toBeNull();
  });
});

describe("CrewAccessModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMembers.mockReturnValue({
      members: [],
      isLoading: false,
      isError: false,
      removeMember: vi.fn(),
      isRemoving: false,
    });
    mockUseJoinLink.mockReturnValue({
      link: null,
      isLoading: false,
      isError: false,
      createLink: vi.fn(),
      isCreating: false,
      turnOff: vi.fn(),
      isTurningOff: false,
    });
  });

  it("shows the crew's people and join link in one dialog, and closes", () => {
    const onClose = vi.fn();
    wrap(<CrewAccessModal crew={crew} onClose={onClose} />);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Hyperion - Framing: people and join link")).toBeDefined();
    expect(screen.getByRole("heading", { name: "People" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Join link" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
