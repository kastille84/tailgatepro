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

const getSignedUrl = async (bucket, path, ttlSeconds) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);

  if (error) {
    throw new AppError("Could not generate a download link", 502, {
      cause: error,
    });
  }

  return data.signedUrl;
};

module.exports = { uploadBlob, getSignedUrl };
