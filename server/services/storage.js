const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

// The one place any server code calls supabase.storage. Client never talks to
// Supabase Storage directly (docs/data-access.md: "private buckets, the
// server issues signed URLs") — every upload and every download URL is
// brokered here, called from meetingLogs.js/signatures.js, which already own
// the "does this belong to the caller's company" checks.

// `upsert: true` matters: a signature or crew-photo re-upload (a retried
// offline sync, or a foreman retaking a crew photo before the meeting is
// completed) must overwrite the same deterministic path, not fail on a
// duplicate-object error — this is what makes the upload idempotent, the
// same "a retry resolves to the same end state" principle
// docs/offline-sync-design.md already relies on for JSON writes.
const uploadBlob = async (bucket, path, buffer, contentType) => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) {
    throw new AppError("Could not upload the file", 502, { cause: error });
  }
};

// `downloadFilename`, when given, sets the signed URL's `download` option —
// Supabase serves the response with a Content-Disposition naming it that,
// independent of the object's actual Storage path/key. Every caller that
// omits it keeps today's behavior exactly (no `options` object passed).
const getSignedUrl = async (bucket, path, ttlSeconds, downloadFilename) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(
      path,
      ttlSeconds,
      downloadFilename ? { download: downloadFilename } : undefined,
    );

  if (error) {
    throw new AppError("Could not generate a download link", 502, {
      cause: error,
    });
  }

  return data.signedUrl;
};

// Downloads a blob's raw bytes — used by pdfGenerationQueue.js to fetch a
// crew photo to embed in the generated PDF. Supabase's storage client hands
// back a Blob, not a Buffer; every other server-side consumer of file bytes
// in this codebase (multer-free raw body uploads) works with Buffers, so the
// conversion happens once here rather than at each call site.
const downloadBlob = async (bucket, path) => {
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) {
    throw new AppError("Could not download the file", 502, { cause: error });
  }

  return Buffer.from(await data.arrayBuffer());
};

module.exports = { uploadBlob, getSignedUrl, downloadBlob };
