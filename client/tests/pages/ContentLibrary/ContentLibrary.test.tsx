import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { ContentLibrary } from "../../../src/pages/ContentLibrary/ContentLibrary";
import theme from "../../../src/styles/theme";

const mockUseAuth = vi.fn();
const mockUseTalks = vi.fn();
const mockUseFavorites = vi.fn();

vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("../../../src/hooks/useTalks", () => ({
  useTalks: (...args: unknown[]) => mockUseTalks(...args),
}));
vi.mock("../../../src/hooks/useFavorites", () => ({
  useFavorites: (...args: unknown[]) => mockUseFavorites(...args),
}));

// The feature components have their own tests; stub them so the page test
// stays focused on page state (guards, loading/error, filtering, selection).
// Mocked by their own file paths (not the features/content-library barrel):
// ContentLibrary.tsx imports TalkList/TalkDetail directly and lazy-loads
// TalkForm separately, precisely so a static import of the barrel here
// wouldn't pull TalkForm's module (and Tiptap) into this test's graph either.
vi.mock("../../../src/features/content-library/TalkList", () => ({
  TalkList: ({
    talks,
    onSelect,
  }: {
    talks: { id: string; title: string }[];
    onSelect: (t: { id: string; title: string }) => void;
  }) => (
    <div data-testid="talk-list">
      {talks.length} talks
      {talks.map((t) => (
        <button key={t.id} type="button" onClick={() => onSelect(t)}>
          select-{t.id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../../../src/features/content-library/TalkDetail", () => ({
  TalkDetail: ({
    talk,
    onClose,
    onEdit,
  }: {
    talk?: { id: string; title: string };
    onClose: () => void;
    onEdit: (talk: { id: string; title: string }) => void;
  }) =>
    talk ? (
      <div role="dialog">
        {talk.title}
        <button type="button" onClick={onClose}>
          stub-close
        </button>
        <button type="button" onClick={() => onEdit(talk)}>
          stub-edit
        </button>
      </div>
    ) : null,
}));
vi.mock("../../../src/features/content-library/TalkForm", () => ({
  TalkForm: ({
    onClose,
    talk,
  }: {
    onClose: () => void;
    talk?: { id: string };
  }) => (
    <div data-testid="talk-form">
      {talk ? `editing-${talk.id}` : "creating"}
      <button type="button" onClick={onClose}>
        stub-form-close
      </button>
    </div>
  ),
}));

const talks = [
  {
    id: "t1",
    title: "Eye Protection",
    tradeTags: ["General Construction", "Welding"],
  },
  { id: "t2", title: "Silica Dust Exposure", tradeTags: ["Masonry"] },
];

const tradeOptions = [
  { value: "General Construction", label: "General Construction" },
  { value: "Masonry", label: "Masonry" },
  { value: "Welding", label: "Welding" },
];

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <ContentLibrary />
    </ThemeProvider>,
  );

describe("ContentLibrary page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { email: "a@b.com" }, loading: false });
    mockUseTalks.mockReturnValue({
      talks,
      tradeOptions,
      isLoading: false,
      isError: false,
    });
    mockUseFavorites.mockReturnValue({ favoriteIds: new Set() });
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

  it("shows a spinner while the talks query is loading", () => {
    mockUseTalks.mockReturnValue({
      talks: [],
      tradeOptions: [],
      isLoading: true,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("shows an error message when the talks query fails", () => {
    mockUseTalks.mockReturnValue({
      talks: [],
      tradeOptions: [],
      isLoading: false,
      isError: true,
    });
    renderPage();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("renders every talk by default and the shared footer", () => {
    renderPage();
    expect(screen.getByTestId("talk-list").textContent).toContain("2 talks");
    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} TailgatePro`, "i"),
      ),
    ).toBeTruthy();
  });

  it("filters by trade using the Select control", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^trade$/i), {
      target: { value: "Masonry" },
    });

    expect(screen.getByTestId("talk-list").textContent).toContain("1 talks");
  });

  it("filters by title using the search input", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^search$/i), {
      target: { value: "silica" },
    });

    expect(screen.getByTestId("talk-list").textContent).toContain("1 talks");
  });

  it("narrows the list to only favorited talks when 'Favorites only' is checked", () => {
    mockUseFavorites.mockReturnValue({ favoriteIds: new Set(["t2"]) });
    renderPage();

    fireEvent.click(screen.getByLabelText(/favorites only/i));

    expect(screen.getByTestId("talk-list").textContent).toContain("1 talks");
  });

  it("combines the favorites filter with the trade filter", () => {
    mockUseFavorites.mockReturnValue({ favoriteIds: new Set(["t1"]) });
    renderPage();

    fireEvent.click(screen.getByLabelText(/favorites only/i));
    fireEvent.change(screen.getByLabelText(/^trade$/i), {
      target: { value: "Masonry" },
    });

    // t1 is favorited but not Masonry; t2 is Masonry but not favorited.
    expect(screen.getByTestId("talk-list").textContent).toContain("0 talks");
  });

  it("restores the full list when 'Favorites only' is unchecked", () => {
    mockUseFavorites.mockReturnValue({ favoriteIds: new Set(["t2"]) });
    renderPage();

    const checkbox = screen.getByLabelText(/favorites only/i);
    fireEvent.click(checkbox);
    expect(screen.getByTestId("talk-list").textContent).toContain("1 talks");

    fireEvent.click(checkbox);
    expect(screen.getByTestId("talk-list").textContent).toContain("2 talks");
  });

  it("shows the empty result set when the trade and search filters both exclude everything", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^trade$/i), {
      target: { value: "Masonry" },
    });
    fireEvent.change(screen.getByLabelText(/^search$/i), {
      target: { value: "eye" },
    });

    expect(screen.getByTestId("talk-list").textContent).toContain("0 talks");
  });

  it("opens and closes the talk detail modal from the list", () => {
    renderPage();

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /select-t1/i }));
    expect(screen.getByRole("dialog").textContent).toContain("Eye Protection");

    fireEvent.click(screen.getByRole("button", { name: /stub-close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens and closes the (lazily-loaded) talk creation form from New talk", async () => {
    renderPage();

    expect(screen.queryByTestId("talk-form")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Add a new talk/i }));
    const form = await screen.findByTestId("talk-form");
    expect(form.textContent).toContain("creating");

    fireEvent.click(screen.getByRole("button", { name: /stub-form-close/i }));
    expect(screen.queryByTestId("talk-form")).toBeNull();
  });

  it("opens the edit form for a talk selected from its detail modal, closing the detail", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /select-t1/i }));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /stub-edit/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    const form = await screen.findByTestId("talk-form");
    expect(form.textContent).toContain("editing-t1");
  });
});
