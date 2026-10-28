import { describe, expect, it, vi } from "vitest";

import { sha256File } from "../../src/utils/sha256File";

describe("sha256File", () => {
  it("returns the lowercase hex SHA-256 of the file's bytes", async () => {
    // Arrange — digest of the ASCII string "abc"; the file's bytes are stubbed
    // because jsdom's Blob has no arrayBuffer().
    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("abc").buffer),
    } as unknown as Blob;

    // Act
    const hash = await sha256File(file);

    // Assert
    expect(hash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("zero-pads bytes below 0x10 so the digest is always 64 characters", async () => {
    // Arrange — force a digest of leading zero bytes
    const digest = vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new Uint8Array(32).buffer);
    const file = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as Blob;

    // Act
    const hash = await sha256File(file);

    // Assert
    expect(hash).toBe("0".repeat(64));
    digest.mockRestore();
  });
});
