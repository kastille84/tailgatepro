// Manually runs the SMS nudge tick (server/services/smsNudges.js runNudgeTick)
// as if it were Monday 7:00 AM in a given time zone, so the Monday nudge can be
// tested without waiting for the hourly cron.
//
// This SENDS REAL TEXTS through whichever TWILIO_* keys the root .env selects
// for the current NODE_ENV. With no keys set it only logs "would send".
//
// The tick still applies its normal filters (sms_nudges_enabled, Site Pro,
// active, confirmed phone, a sub with no log last week), and a site is nudged at
// most once per local Monday via jobsites.sms_last_nudged_on. Pass --reset to
// clear that column on sms_nudges_enabled sites first so a re-run can send again.
//
// Usage (from repo root):
//   node scripts/run-nudge-tick.js [--tz America/Chicago] [--reset]
// --tz defaults to this machine's time zone. Only sites whose own timezone
// matches the instant (Monday 7:xx in THEIR zone) are nudged, so pass the zone
// of the site you are testing.

require("dotenv").config();

const { supabase } = require("../server/utility/supabaseClient");
const { runNudgeTick } = require("../server/services/smsNudges");
const { localParts } = require("../server/utility/localTime");

const HOUR_MS = 60 * 60 * 1000;

const args = process.argv.slice(2);
const tzIndex = args.indexOf("--tz");
const timeZone =
  tzIndex === -1 ? Intl.DateTimeFormat().resolvedOptions().timeZone : args[tzIndex + 1];
const reset = args.includes("--reset");

// Most recent instant (looking back up to 8 days) at which `timeZone` reads
// Monday 7:xx, aligned to the top of the hour.
const mostRecentMonday7 = (zone) => {
  const start = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  for (let i = 0; i <= 8 * 24; i += 1) {
    const candidate = new Date(start - i * HOUR_MS);
    const local = localParts(candidate, zone);
    if (!local) throw new Error(`Unknown time zone: ${zone}`);
    if (local.weekday === "Mon" && local.hour === 7) return candidate;
  }
  throw new Error(`Could not find a Monday 7:00 in ${zone}`);
};

const main = async () => {
  const now = mostRecentMonday7(timeZone);
  console.log(`Simulating ${now.toISOString()} (Monday 7:xx in ${timeZone}).`);

  if (reset) {
    const { error } = await supabase
      .from("jobsites")
      .update({ sms_last_nudged_on: null })
      .eq("sms_nudges_enabled", true);
    if (error) throw new Error(`--reset failed: ${error.message}`, { cause: error });
    console.log("Cleared sms_last_nudged_on on nudge-enabled sites.");
  }

  const sent = await runNudgeTick(now);
  console.log(`Tick finished: ${sent} message(s) sent.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
