/**
 * Saves a Blob the browser already has in memory as a file, via a detached
 * `<a download>` click. Every other file download in this app is a signed
 * Storage URL opened with `window.open` (see `useGcMeetingPdfUrl.ts`) — this
 * exists for the one case that isn't, the 9e Defense Bundle ZIP, which is a
 * streamed authenticated response body, not a URL a new tab can fetch on its
 * own. Small and reusable if a future export needs the same shape.
 */
export const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
