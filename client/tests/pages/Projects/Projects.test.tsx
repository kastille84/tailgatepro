import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { Projects } from "../../../src/pages/Projects/Projects";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseProjects = vi.fn();
const mockUseCurrentUser = vi.fn();

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));
vi.mock("../../../src/hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
}));

// The feature components have their own tests; stub them so the page test
// stays focused on page state (guards, loading/error, opening the form).
vi.mock("../../../src/features/projects", () => ({
  ProjectList: ({
    projects,
    onEdit,
    onLinkGc,
  }: {
    projects: { id: string }[];
    onEdit: (p: { id: string }) => void;
    onLinkGc?: (p: { id: string }) => void;
  }) => (
    <div data-testid="project-list">
      {projects.length} projects
      <button type="button" onClick={() => onEdit({ id: "p1" })}>
        stub-edit
      </button>
      {onLinkGc && (
        <button type="button" onClick={() => onLinkGc({ id: "p1" })}>
          stub-link
        </button>
      )}
    </div>
  ),
  GcLinkModal: ({
    project,
    onClose,
  }: {
    project: { id: string };
    onClose: () => void;
  }) => (
    <div role="dialog">
      link {project.id}
      <button type="button" onClick={onClose}>
        stub-link-close
      </button>
    </div>
  ),
  ProjectForm: ({
    isOpen,
    onClose,
    project,
  }: {
    isOpen: boolean;
    onClose: () => void;
    project?: { id: string };
  }) =>
    isOpen ? (
      <div role="dialog">
        {project ? `edit ${project.id}` : "new"}
        <button type="button" onClick={onClose}>
          stub-close
        </button>
      </div>
    ) : null,
}));

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <Projects />
    </ThemeProvider>,
  );

describe("Projects page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "a@b.com" }, loading: false });
    mockUseCurrentUser.mockReturnValue({ isSubcontractor: true });
    mockUseProjects.mockReturnValue({
      projects: [],
      isLoading: false,
      isError: false,
    });
  });

  it("shows a loading status while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("shows an access-denied fallback when there is no user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderPage();
    expect(screen.getByText(/access denied/i)).toBeDefined();
  });

  it("shows a spinner while the projects query is loading", () => {
    mockUseProjects.mockReturnValue({
      projects: [],
      isLoading: true,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("shows an error message when the projects query fails", () => {
    mockUseProjects.mockReturnValue({
      projects: [],
      isLoading: false,
      isError: true,
    });
    renderPage();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("renders the list and opens/closes the form from the page controls", () => {
    mockUseProjects.mockReturnValue({
      projects: [{ id: "p1" }],
      isLoading: false,
      isError: false,
    });
    renderPage();

    expect(screen.getByTestId("project-list")).toBeDefined();
    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} TailgatePro`, "i"),
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    expect(screen.getByRole("dialog").textContent).toContain("new");

    fireEvent.click(screen.getByRole("button", { name: /stub-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the form in edit mode when a list row requests it", () => {
    mockUseProjects.mockReturnValue({
      projects: [{ id: "p1" }],
      isLoading: false,
      isError: false,
    });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /stub-edit/i }));
    expect(screen.getByRole("dialog").textContent).toContain("edit p1");
  });

  it("lets a subcontractor open the link-to-GC modal from a list row and close it again", () => {
    renderPage();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /stub-link$/i }));
    expect(screen.getByRole("dialog").textContent).toContain("link p1");

    fireEvent.click(screen.getByRole("button", { name: /stub-link-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers no link-to-GC action to a GC company or while the profile is still loading", () => {
    mockUseCurrentUser.mockReturnValue({ isSubcontractor: false });
    renderPage();

    expect(screen.queryByRole("button", { name: /stub-link$/i })).toBeNull();
  });

  it("hides the New project control from a GC company or while the profile is still loading", () => {
    mockUseCurrentUser.mockReturnValue({ isSubcontractor: false });
    renderPage();

    expect(
      screen.queryByRole("button", { name: /new project/i }),
    ).toBeNull();
  });

  it("asks useProjects to include archived projects when the toggle is checked", () => {
    renderPage();

    expect(mockUseProjects).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByLabelText(/show archived/i));

    expect(mockUseProjects).toHaveBeenLastCalledWith(true);
  });
});
