// One-shot PDF regeneration for docs/tasks.md 11e: re-renders already-completed
// meetings' PDFs with the current renderer, so a header/format fix reaches
// historical logs. Overwrites each meeting's existing `<id>/report.pdf`
// (previously emailed signed links keep working), never sends email, and never
// touches content_seal / completed_at / held_at — the seal doesn't cover PDF
// bytes. Each run records a `pdf_generated` audit event with regenerated: true.
//
// Idempotent. Dry-run by default; nothing is written without --apply. A failure
// on one meeting is reported and the run continues; exit code 1 if any failed.
//
// Usage (from repo root):
//   node scripts/regenerate-pdfs.js [--apply] [--id <uuid>] [--company <uuid>] [--since <ISO date>] [--limit <n>]
// Requires the root .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and
// MEETING_LOG_SEAL_SECRET (the PDF footer prints the seal fragment).

require("dotenv").config();

const { supabase } = require("../server/utility/supabaseClient");
const { regenerate } = require("../server/services/pdfGenerationQueue");
const { parseArgs, selectMeetings } = require("./lib/regeneratePlan");

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  const { data, error } = await supabase
    .from("meeting_logs")
    .select("id, company_id, completed_at, final_pdf_url")
    .not("completed_at", "is", null)
    .not("final_pdf_url", "is", null);
  if (error) throw new Error(`select meeting_logs: ${error.message}`, { cause: error });

  const meetings = selectMeetings(data, options);
  console.log(
    `${meetings.length} meeting(s) selected${options.apply ? "" : " (dry run — pass --apply to regenerate)"}`,
  );
  if (!options.apply) {
    meetings.forEach((m) => console.log(`  ${m.id}  (company ${m.company_id})`));
    return 0;
  }

  let ok = 0;
  let failed = 0;
  for (const meeting of meetings) {
    try {
      await regenerate(meeting.id, meeting.company_id);
      ok += 1;
      console.log(`ok      ${meeting.id}`);
    } catch (err) {
      failed += 1;
      console.error(`FAILED  ${meeting.id}: ${err.message}`);
    }
  }
  console.log(`Done: ${ok} regenerated, ${failed} failed`);
  return failed > 0 ? 1 : 0;
};

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
