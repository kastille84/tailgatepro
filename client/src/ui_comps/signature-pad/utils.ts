/**
 * Decodes a `data:<mime>;base64,<data>` URL -- what `signature_pad`'s
 * `toDataURL()` returns -- into a `Blob`. Kept pure and DOM-independent so it
 * gets full unit coverage without a real canvas: jsdom has no 2D canvas
 * context capable of producing a real PNG to export, so this is the one
 * piece of `SignaturePad`'s logic that's actually testable end-to-end.
 */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header.match(/^data:(.*);base64$/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};
