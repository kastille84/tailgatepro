/** One raw binary awaiting upload — see `tailgateDb.ts`'s `mediaBlobs` table.
 *  A queued signature/crew-photo outbox row's JSON `payload` carries this
 *  row's `id`, never the bytes themselves; the replay handler reads the blob
 *  back out at flush time and PUTs it raw. See
 *  `docs/meeting-flow-design.md`. */
export interface MediaBlobRow {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}
