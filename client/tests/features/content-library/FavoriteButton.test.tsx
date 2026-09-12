import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { FavoriteButton } from "../../../src/features/content-library";
import theme from "../../../src/styles/theme";
import type { Talk } from "../../../src/interfaces/talk";

const mockToggleFavorite = vi.fn();
const mockUseToggleFavorite = vi.fn();

vi.mock("../../../src/hooks/useToggleFavorite", () => ({
  useToggleFavorite: () => mockUseToggleFavorite(),
}));

const talk = { id: "t1", title: "Eye Protection on the Jobsite" } as Talk;

const renderButton = (
  props: Partial<React.ComponentProps<typeof FavoriteButton>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <FavoriteButton talk={talk} isFavorited={false} {...props} />
    </ThemeProvider>,
  );

describe("FavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToggleFavorite.mockReturnValue({
      toggleFavorite: mockToggleFavorite,
      isToggling: false,
    });
  });

  it("shows an 'Add to favorites' label and aria-pressed false when not favorited", () => {
    renderButton({ isFavorited: false });

    const button = screen.getByRole("button", {
      name: /add eye protection on the jobsite to favorites/i,
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows a 'Remove from favorites' label and aria-pressed true when favorited", () => {
    renderButton({ isFavorited: true });

    const button = screen.getByRole("button", {
      name: /remove eye protection on the jobsite from favorites/i,
    });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls toggleFavorite with the talk id and current favorited state on click", () => {
    renderButton({ isFavorited: false });

    fireEvent.click(
      screen.getByRole("button", { name: /add .* to favorites/i }),
    );

    expect(mockToggleFavorite).toHaveBeenCalledWith({
      talkId: "t1",
      isFavorited: false,
    });
  });

  it("shows the loading state while toggling", () => {
    mockUseToggleFavorite.mockReturnValue({
      toggleFavorite: mockToggleFavorite,
      isToggling: true,
    });
    renderButton();

    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
  });
});
