/**
 * SHA-256 of a file's bytes as lowercase hex, computed in the browser with
 * SubtleCrypto so a PDF being checked against its sealed fingerprint never
 * leaves the user's machine. Needs a secure context (HTTPS or localhost).
 */
export const sha256File = async (file: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};
