// One-time, idempotent Supabase Storage bucket setup for Phase 4 (signatures +
// crew photos) and Phase 5 (generated meeting-log PDFs). See
// docs/meeting-flow-design.md.
//
// Creates two private buckets. The client never talks to Supabase Storage
// directly — the server broker (server/services/storage.js) uploads blobs and
// issues signed URLs, per docs/data-access.md's "private buckets, the server
// issues signed URLs" rule.
//
// Usage (from repo root):  node scripts/setup-storage-buckets.js
// Requires the root .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

require("dotenv").config();

const { supabase } = require("../server/utility/supabaseClient");

const BUCKETS = ["signatures", "crew-photos", "meeting-pdfs"];

const main = async () => {
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error(`could not list buckets: ${listError.message}`);
    process.exit(1);
  }

  const existingNames = new Set((existing ?? []).map((bucket) => bucket.name));

  for (const name of BUCKETS) {
    if (existingNames.has(name)) {
      console.log(`skip (already exists): ${name}`);
      continue;
    }

    const { error } = await supabase.storage.createBucket(name, { public: false });
    if (error) {
      console.error(`failed to create bucket "${name}": ${error.message}`);
      process.exit(1);
    }
    console.log(`created: ${name}`);
  }
};

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
