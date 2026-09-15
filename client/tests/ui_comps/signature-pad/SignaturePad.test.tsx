import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignaturePad } from "../../../src/ui_comps/signature-pad/SignaturePad";
import type { SignaturePadHandle } from "../../../src/ui_comps/signature-pad/SignaturePad";
import theme from "../../../src/styles/theme";

// jsdom has no real 2D canvas context to draw/export a signature from, so
// this test mocks the signature_pad library boundary itself -- it verifies
// our own wiring (mount, imperative handle, Clear button, onEnd, disabled,
// resize), not the library's internal pixel drawing, which isn't our code.
// `vi.hoisted` lets the mock instances the factory below creates be read
// back from the test bodies without importing anything from "signature_pad"
// itself (which, unmocked, has no such export).
const { mockPadInstances, MockSignaturePad } = vi.hoisted(() => {
  class MockSignaturePad {
    canvas: HTMLCanvasElement;
    listeners: Record<string, Array<() => void>> = {};
    isEmptyValue = true;
    onFn = vi.fn();
    offFn = vi.fn();
    clearFn = vi.fn(() => {
      this.isEmptyValue = true;
    });
    toDataURLFn = vi.fn(() => "data:image/png;base64,AAAA");

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
    }

    addEventListener(type: string, callback: () => void) {
      (this.listeners[type] ??= []).push(callback);
    }

    removeEventListener(type: string, callback: () => void) {
      this.listeners[type] = (this.listeners[type] ?? []).filter(
        (listener) => listener !== callback,
      );
    }

    on() {
      this.onFn();
    }

    off() {
      this.offFn();
    }

    clear() {
      this.clearFn();
    }

    isEmpty() {
      return this.isEmptyValue;
    }

    toDataURL(type?: string) {
      return this.toDataURLFn(type);
    }

    /** Test helper: simulates the library firing one of its own events. */
    emit(type: string) {
      (this.listeners[type] ?? []).forEach((listener) => listener());
    }
  }

  return { mockPadInstances: [] as InstanceType<typeof MockSignaturePad>[], MockSignaturePad };
});

vi.mock("signature_pad", () => ({
  default: vi.fn().mockImplementation((canvas: HTMLCanvasElement) => {
    const pad = new MockSignaturePad(canvas);
    mockPadInstances.push(pad);
    return pad;
  }),
}));

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

beforeEach(() => {
  mockPadInstances.length = 0;
});

describe("SignaturePad", () => {
  it("instantiates signature_pad against its canvas on mount", () => {
    renderWithTheme(<SignaturePad />);

    expect(mockPadInstances).toHaveLength(1);
    expect(mockPadInstances[0].canvas).toBe(screen.getByRole("img"));
  });

  it("clears the pad and reports empty when the Clear button is clicked", () => {
    const onEnd = vi.fn();
    renderWithTheme(<SignaturePad onEnd={onEnd} />);
    const pad = mockPadInstances[0];
    pad.isEmptyValue = false;
    // The mount effect's initial resizeCanvas() call already clears the pad
    // once (see signature_pad's own "handling canvas resize" recipe) -- only
    // count clear() calls from the Clear button onward.
    const clearCallsBeforeClick = pad.clearFn.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(pad.clearFn.mock.calls.length).toBe(clearCallsBeforeClick + 1);
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it("forwards endStroke events to the onEnd prop with the pad's current isEmpty() value", () => {
    const onEnd = vi.fn();
    renderWithTheme(<SignaturePad onEnd={onEnd} />);
    const pad = mockPadInstances[0];
    pad.isEmptyValue = false;

    pad.emit("endStroke");

    expect(onEnd).toHaveBeenCalledWith(false);
  });

  it("does not throw when a stroke ends and no onEnd prop was given", () => {
    renderWithTheme(<SignaturePad />);
    const pad = mockPadInstances[0];

    expect(() => pad.emit("endStroke")).not.toThrow();
  });

  it("calls the latest onEnd even if the prop identity changed since mount", () => {
    const firstOnEnd = vi.fn();
    const secondOnEnd = vi.fn();
    const { rerender } = renderWithTheme(<SignaturePad onEnd={firstOnEnd} />);
    rerender(
      <ThemeProvider theme={theme}>
        <SignaturePad onEnd={secondOnEnd} />
      </ThemeProvider>,
    );
    const pad = mockPadInstances[0];

    pad.emit("endStroke");

    expect(firstOnEnd).not.toHaveBeenCalled();
    expect(secondOnEnd).toHaveBeenCalledTimes(1);
  });

  it("exposes an imperative handle whose clear/isEmpty/exportBlob delegate to the pad", async () => {
    const ref = React.createRef<SignaturePadHandle>();
    renderWithTheme(<SignaturePad ref={ref} />);
    const pad = mockPadInstances[0];
    pad.isEmptyValue = false;
    pad.toDataURLFn.mockReturnValue("data:image/png;base64,AAAA");

    expect(ref.current?.isEmpty()).toBe(false);

    const blob = await ref.current!.exportBlob();
    expect(pad.toDataURLFn).toHaveBeenCalledWith("image/png");
    expect(blob.type).toBe("image/png");

    const clearCallsBeforeHandleClear = pad.clearFn.mock.calls.length;
    ref.current!.clear();
    expect(pad.clearFn.mock.calls.length).toBe(clearCallsBeforeHandleClear + 1);
  });

  it("toggles the pad's own event binding when disabled changes", () => {
    const { rerender } = renderWithTheme(<SignaturePad disabled={false} />);
    const pad = mockPadInstances[0];

    rerender(
      <ThemeProvider theme={theme}>
        <SignaturePad disabled />
      </ThemeProvider>,
    );
    expect(pad.offFn).toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={theme}>
        <SignaturePad disabled={false} />
      </ThemeProvider>,
    );
    expect(pad.onFn).toHaveBeenCalled();
  });

  it("marks the canvas invalid when hasError is set", () => {
    renderWithTheme(<SignaturePad hasError />);
    expect(screen.getByRole("img").getAttribute("aria-invalid")).toBe("true");
  });

  it("uses a custom aria-label when given", () => {
    renderWithTheme(<SignaturePad aria-label="Worker signature" />);
    expect(screen.getByRole("img", { name: "Worker signature" })).toBeDefined();
  });

  it("re-scales the canvas on window resize, scaling the 2D context when one is available", () => {
    renderWithTheme(<SignaturePad />);
    const pad = mockPadInstances[0];
    const clearCallsBeforeResize = pad.clearFn.mock.calls.length;
    const scale = vi.fn();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ scale } as unknown as CanvasRenderingContext2D);

    fireEvent(window, new Event("resize"));

    expect(scale).toHaveBeenCalled();
    expect(pad.clearFn.mock.calls.length).toBeGreaterThan(clearCallsBeforeResize);

    getContextSpy.mockRestore();
  });

  it("re-scales the canvas on resize without throwing when no 2D context is available (jsdom default)", () => {
    renderWithTheme(<SignaturePad />);

    expect(() => fireEvent(window, new Event("resize"))).not.toThrow();
  });

  it("falls back to a 1x ratio when devicePixelRatio is unavailable (e.g. 0)", () => {
    const originalRatio = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      value: 0,
      configurable: true,
    });

    expect(() => renderWithTheme(<SignaturePad />)).not.toThrow();

    Object.defineProperty(window, "devicePixelRatio", {
      value: originalRatio,
      configurable: true,
    });
  });

  it("unbinds the resize listener and the pad's own listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderWithTheme(<SignaturePad />);
    const pad = mockPadInstances[0];

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(pad.offFn).toHaveBeenCalled();
  });
});
