import { describe, expect, it } from "vitest";

import { dataUrlToBlob } from "../../../src/ui_comps/signature-pad/utils";

// A real, tiny (1x1 transparent) PNG, base64-encoded -- the same shape
// signature_pad's toDataURL("image/png") returns.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PNG_BYTES = Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0));

describe("dataUrlToBlob", () => {
  it("decodes a PNG data URL into a Blob with the matching mime type and bytes", async () => {
    const blob = dataUrlToBlob(`data:image/png;base64,${PNG_BASE64}`);

    expect(blob.type).toBe("image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes).toEqual(PNG_BYTES);
  });

  it("defaults to image/png when the header doesn't match the expected data-URL shape", () => {
    const blob = dataUrlToBlob("not-a-real-data-url");

    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(0);
  });
});
