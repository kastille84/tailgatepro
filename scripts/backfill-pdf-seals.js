// One-shot PDF-seal backfill for docs/tasks.md 16k: gives meetings completed
// before the PDF seal shipped a file fingerprint, so the public /verify page can
// check a dropped PDF against them. Hashes the PDF and embedded images
// CURRENTLY in Storage -- it vouches for what is stored today, not for what was
// stored at completion. Meetings whose content seal already fails are skipped.
//
// Never re-renders or overwrites a PDF, never touches content_seal. Records a
// `pdf_generated` audit event with backfilled: true. Idempotent (meetings that
// already have a PDF seal are not selected). Dry-run by default; nothing is
// written without --apply. A failure on one meeting is reported and the run
// continues; exit code 1 if any failed.
//
// Usage (from repo root):
//   node scripts/backfill-pdf-seals.js [--apply] [--id <uuid>] [--company <uuid>] [--since <ISO date>] [--limit <n>]
// Requires the root .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and
// MEETING_LOG_SEAL_SECRET.

require("dotenv").config();

const { supabase } = require("../server/utility/supabaseClient");
const { backfillPdfSeal } = require("../server/services/pdfSealBackfill");
const { parseArgs, selectMeetings } = require("./lib/regeneratePlan");

const main = async () => {
  const options = parseArgs(process.argv.slice(2), "backfill-pdf-seals.js");

  const { data, error } = await supabase
    .from("meeting_logs")
    .select("id, company_id, completed_at, final_pdf_url")
    .not("completed_at", "is", null)
    .not("final_pdf_url", "is", null)
    .not("content_seal", "is", null)
    .is("pdf_seal", null);
  if (error) throw new Error(`select meeting_logs: ${error.message}`, { cause: error });

  const meetings = selectMeetings(data, options);
  console.log(
    `${meetings.length} meeting(s) selected${options.apply ? "" : " (dry run — pass --apply to backfill)"}`,
  );
  if (!options.apply) {
    meetings.forEach((m) => console.log(`  ${m.id}  (company ${m.company_id})`));
    return 0;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const meeting of meetings) {
    try {
      const result = await backfillPdfSeal(meeting.id);
      if (result.status === "backfilled") {
        ok += 1;
        console.log(`ok      ${meeting.id}`);
      } else {
        skipped += 1;
        console.log(`skipped ${meeting.id}: ${result.reason}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`FAILED  ${meeting.id}: ${err.message}`);
    }
  }
  console.log(`Done: ${ok} backfilled, ${skipped} skipped, ${failed} failed`);
  return failed > 0 ? 1 : 0;
};

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
