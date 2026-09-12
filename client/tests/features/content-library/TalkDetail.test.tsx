import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { TalkDetail } from "../../../src/features/content-library";
import theme from "../../../src/styles/theme";
import type { Talk } from "../../../src/interfaces/talk";

// FavoriteButton (rendered in the title row) owns its own tests; stub its
// mutation hook here so this file doesn't need an AuthProvider/QueryClient.
vi.mock("../../../src/hooks/useToggleFavorite", () => ({
  useToggleFavorite: () => ({ toggleFavorite: vi.fn(), isToggling: false }),
}));

const fullTalk: Talk = {
  id: "t1",
  slug: "eye-protection",
  title: "Eye Protection on the Jobsite",
  tradeTag: "General Construction",
  tradeTags: ["General Construction", "Welding"],
  content: "# Eye Protection\n",
  structured: {
    summary: "Match eyewear to the hazard.",
    talking_points: ["Wear Z87+ glasses"],
    site_hazards_to_check: ["Missing eyewash station"],
    discussion_questions: ["What eyewear matches today's task?"],
    osha_standards: ["29 CFR 1926.102"],
    estimated_minutes: 5,
  },
  attribution: {
    source: "NIOSH",
    publisher: "National Institute for Occupational Safety and Health (NIOSH)",
    copyright: "U.S. Government work — public domain.",
    license: "public-domain",
    source_url: "https://www.cdc.gov/niosh/docs/2022-136/2022-136.pdf",
    notice:
      "Adapted from a NIOSH Toolbox Talk (co-developed with CPWR). Public-domain source; not an endorsement by NIOSH or CPWR.",
  },
  isGlobal: true,
  companyId: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

const renderDetail = (
  props: Partial<React.ComponentProps<typeof TalkDetail>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <TalkDetail
        talk={fullTalk}
        favoriteIds={new Set()}
        onClose={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe("TalkDetail", () => {
  it("renders nothing when no talk is selected", () => {
    renderDetail({ talk: undefined });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the favorite toggle in the title row, reflecting favoriteIds", () => {
    renderDetail({ favoriteIds: new Set(["t1"]) });

    expect(
      screen.getByRole("button", {
        name: /remove eye protection on the jobsite from favorites/i,
      }),
    ).toBeDefined();
  });

  it("renders the title, trade badges, summary and every content section", () => {
    renderDetail();

    expect(
      screen.getByRole("heading", { name: /eye protection on the jobsite/i }),
    ).toBeDefined();
    expect(screen.getByText("General Construction")).toBeDefined();
    expect(screen.getByText("Welding")).toBeDefined();
    expect(screen.getByText("Match eyewear to the hazard.")).toBeDefined();
    expect(screen.getByText("Wear Z87+ glasses")).toBeDefined();
    expect(screen.getByText("Missing eyewash station")).toBeDefined();
    expect(screen.getByText("What eyewear matches today's task?")).toBeDefined();
  });

  it("shows the OSHA standards and estimated minutes together", () => {
    renderDetail();
    expect(screen.getByText("OSHA: 29 CFR 1926.102 · ~5 min")).toBeDefined();
  });

  it("shows only the OSHA standards when there is no estimated time", () => {
    renderDetail({
      talk: {
        ...fullTalk,
        structured: { ...fullTalk.structured!, estimated_minutes: null },
      },
    });
    expect(screen.getByText("OSHA: 29 CFR 1926.102")).toBeDefined();
  });

  it("shows only the estimated minutes when there are no OSHA standards", () => {
    renderDetail({
      talk: {
        ...fullTalk,
        structured: { ...fullTalk.structured!, osha_standards: [] },
      },
    });
    expect(screen.getByText("~5 min")).toBeDefined();
  });

  it("renders the source's copyright and no-endorsement notice", () => {
    renderDetail();
    expect(
      screen.getByText(/u\.s\. government work — public domain\./i),
    ).toBeDefined();
    expect(screen.getByText(/not an endorsement by niosh or cpwr/i)).toBeDefined();
  });

  it("omits every optional section when structured and attribution are absent", () => {
    renderDetail({ talk: { ...fullTalk, structured: null, attribution: null } });

    expect(screen.queryByText("Match eyewear to the hazard.")).toBeNull();
    expect(screen.queryByText(/talking points/i)).toBeNull();
    expect(screen.queryByText(/hazards to check on site/i)).toBeNull();
    expect(screen.queryByText(/discussion questions/i)).toBeNull();
    expect(screen.queryByText(/osha:/i)).toBeNull();
    expect(screen.queryByText(/public domain/i)).toBeNull();
  });

  it("shows a Custom badge for a company's own custom talk", () => {
    renderDetail({ talk: { ...fullTalk, isGlobal: false, companyId: "company-1" } });
    expect(screen.getByText("Custom")).toBeDefined();
  });

  it("shows no Custom badge for a global talk", () => {
    renderDetail();
    expect(screen.queryByText("Custom")).toBeNull();
  });
});
