import { describe, it, expect, vi, beforeEach } from "vitest";

import { triggerBrowserDownload } from "../../src/utils/triggerBrowserDownload";

// jsdom has no real createObjectURL/revokeObjectURL implementation (same
// workaround as LogoUpload.test.tsx / PhotoCapture.test.tsx).
const createObjectURL = vi.fn(() => "blob:mock-url");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

describe("triggerBrowserDownload", () => {
  it("creates an object URL, clicks a download link named after the file, then revokes the URL", () => {
    const blob = new Blob(["zip bytes"], { type: "application/zip" });
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    triggerBrowserDownload(blob, "riverside-tower-defense-bundle.zip");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.href).toBe("blob:mock-url");
    expect(link.download).toBe("riverside-tower-defense-bundle.zip");
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(link);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
