import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { TalkList } from "../../../src/features/content-library";
import theme from "../../../src/styles/theme";
import type { Talk } from "../../../src/interfaces/talk";

// FavoriteButton (rendered inside every card) owns its own tests; stub its
// mutation hook here so this file doesn't need an AuthProvider/QueryClient.
vi.mock("../../../src/hooks/useToggleFavorite", () => ({
  useToggleFavorite: () => ({ toggleFavorite: vi.fn(), isToggling: false }),
}));

const talks: Talk[] = [
  {
    id: "t1",
    slug: "eye-protection",
    title: "Eye Protection on the Jobsite",
    tradeTag: "General Construction",
    tradeTags: ["General Construction", "Welding"],
    content: "# Eye Protection\n",
    structured: {
      summary: "Match eyewear to the hazard.",
      talking_points: [],
      site_hazards_to_check: [],
      discussion_questions: [],
      osha_standards: ["29 CFR 1926.102"],
      estimated_minutes: 5,
    },
    attribution: {
      source: "NIOSH",
      publisher: "NIOSH",
      copyright: "U.S. Government work — public domain.",
      license: "public-domain",
      source_url: null,
      notice: "Not an endorsement by NIOSH or CPWR.",
    },
    isGlobal: true,
    companyId: null,
    createdAt: "2026-09-09T00:00:00.000Z",
  },
  {
    id: "t2",
    slug: "silica",
    title: "Controlling Silica Dust Exposure",
    tradeTag: null,
    tradeTags: ["Masonry"],
    content: "# Silica\n",
    structured: null,
    attribution: null,
    isGlobal: true,
    companyId: null,
    createdAt: "2026-09-09T00:00:00.000Z",
  },
];

const renderList = (
  props: Partial<React.ComponentProps<typeof TalkList>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <TalkList
        talks={talks}
        favoriteIds={new Set()}
        onSelect={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe("TalkList", () => {
  it("renders an empty state when no talks match", () => {
    renderList({ talks: [] });
    expect(screen.getByText(/no talks match your filters/i)).toBeDefined();
  });

  it("marks a card's favorite button as favorited when its id is in favoriteIds", () => {
    renderList({ favoriteIds: new Set(["t1"]) });

    expect(
      screen.getByRole("button", {
        name: /remove eye protection on the jobsite from favorites/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: /add controlling silica dust exposure to favorites/i,
      }),
    ).toBeDefined();
  });

  it("renders a card per talk with its title, summary and trade badge", () => {
    renderList();
    expect(screen.getByText("Eye Protection on the Jobsite")).toBeDefined();
    expect(screen.getByText("Match eyewear to the hazard.")).toBeDefined();
    expect(screen.getByText("General Construction")).toBeDefined();
  });

  it("omits the summary and trade badge when a talk has none", () => {
    renderList();
    expect(screen.getByText("Controlling Silica Dust Exposure")).toBeDefined();
    // Only one trade badge should render (for t1) — t2 has a null tradeTag.
    expect(screen.getAllByText(/general construction/i)).toHaveLength(1);
  });

  it("calls onSelect with the talk when its View button is clicked", () => {
    const onSelect = vi.fn();
    renderList({ onSelect });

    fireEvent.click(
      screen.getByRole("button", { name: /view eye protection on the jobsite/i }),
    );
    expect(onSelect).toHaveBeenCalledWith(talks[0]);
  });
});
