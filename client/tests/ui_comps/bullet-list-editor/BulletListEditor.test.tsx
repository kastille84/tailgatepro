import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

import { BulletListEditor } from "../../../src/ui_comps/bullet-list-editor";
import theme from "../../../src/styles/theme";

const renderEditor = (
  props: Partial<React.ComponentProps<typeof BulletListEditor>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <BulletListEditor value={[]} onChange={vi.fn()} {...props} />
    </ThemeProvider>,
  );

describe("BulletListEditor", () => {
  it("renders each seeded value as a bullet", () => {
    renderEditor({ value: ["Inspect rungs", "Wear a harness"] });

    expect(screen.getByText("Inspect rungs")).toBeDefined();
    expect(screen.getByText("Wear a harness")).toBeDefined();
    expect(document.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders a single empty bullet when value is empty", () => {
    renderEditor({ value: [] });
    expect(document.querySelectorAll("li")).toHaveLength(1);
  });

  it("marks the editor invalid when hasError is set", () => {
    const { container } = renderEditor({ hasError: true, id: "talking-points" });
    const wrapper = container.querySelector("#talking-points");
    expect(wrapper?.getAttribute("aria-invalid")).toBe("true");
  });

  it("wires aria-describedby through to the wrapper", () => {
    const { container } = renderEditor({
      id: "talking-points",
      "aria-describedby": "talking-points-error",
    });
    expect(
      container.querySelector("#talking-points")?.getAttribute("aria-describedby"),
    ).toBe("talking-points-error");
  });

  it("pushes typed content back out through onChange", async () => {
    const onChange = vi.fn();
    const { container } = renderEditor({ value: [], onChange });

    const proseMirror = container.querySelector(".ProseMirror") as HTMLElement;
    expect(proseMirror).not.toBeNull();

    proseMirror.focus();
    // jsdom has neither ClipboardEvent nor DataTransfer — build a plain Event
    // and stub just the clipboardData.getData/types shape ProseMirror's paste
    // handler reads, rather than pulling in real browser clipboard classes.
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/plain" ? "Inspect rungs before use" : "",
        types: ["text/plain"],
        files: [],
      },
    });
    proseMirror.dispatchEvent(pasteEvent);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([
      "Inspect rungs before use",
    ]);
  });
});
