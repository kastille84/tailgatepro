import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { CurrentPushCard } from "../../../src/features/gc-policy-push/CurrentPushCard";
import theme from "../../../src/styles/theme";
import type { PolicyPushState } from "../../../src/interfaces/policyPush";

describe("CurrentPushCard", () => {
  it("shows the empty state when nothing is currently pushed", () => {
    const push: PolicyPushState = {
      talkId: null,
      talkTitle: null,
      pushedAt: null,
      pushedByName: null,
    };

    render(
      <ThemeProvider theme={theme}>
        <CurrentPushCard push={push} />
      </ThemeProvider>,
    );

    expect(
      screen.getByText(/no topic is currently required/i),
    ).toBeDefined();
  });

  it("shows the pushed topic's title, pushed-at date, and pusher's name", () => {
    const push: PolicyPushState = {
      talkId: "talk-1",
      talkTitle: "Fall Protection",
      pushedAt: "2026-09-01T00:00:00.000Z",
      pushedByName: "Jane Admin",
    };

    render(
      <ThemeProvider theme={theme}>
        <CurrentPushCard push={push} />
      </ThemeProvider>,
    );

    expect(screen.getByText("Fall Protection")).toBeDefined();
    expect(screen.getByText(/pushed.*by jane admin/i)).toBeDefined();
  });

  it("omits the pushed-at date when pushedAt is null", () => {
    const push: PolicyPushState = {
      talkId: "talk-1",
      talkTitle: "Fall Protection",
      pushedAt: null,
      pushedByName: "Jane Admin",
    };

    render(
      <ThemeProvider theme={theme}>
        <CurrentPushCard push={push} />
      </ThemeProvider>,
    );

    expect(screen.getByText("Pushed by Jane Admin")).toBeDefined();
  });

  it("falls back to a placeholder title when talkTitle is null (a deleted talk)", () => {
    const push: PolicyPushState = {
      talkId: "talk-1",
      talkTitle: null,
      pushedAt: "2026-09-01T00:00:00.000Z",
      pushedByName: null,
    };

    render(
      <ThemeProvider theme={theme}>
        <CurrentPushCard push={push} />
      </ThemeProvider>,
    );

    expect(screen.getByText("Unknown talk")).toBeDefined();
  });
});
