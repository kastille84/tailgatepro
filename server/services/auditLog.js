// Meeting-log lifecycle audit trail (Phase 9e, docs/tamper-evidence-design.md).
// Scoped to meeting_logs only, not a general system-wide audit log. Every
// write here is soft-fail -- record() swallows and logs its own errors
// instead of throwing, so a broken insert never blocks the meeting-log
// operation it's describing (same soft-fail convention as
// pdfGenerationQueue.js's own best-effort side effects).
const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");

const EVENT_TYPES = [
  "created",
  "completed",
  "pdf_generated",
  "seal_verified",
  "integration_pushed",
];

/**
 * @param {object} params
 * @param {string} params.meetingLogId
 * @param {"created"|"completed"|"pdf_generated"|"seal_verified"|"integration_pushed"} params.eventType
 * @param {string|null} [params.actorId] - the acting user's id, or null for a
 *   system-triggered event (pdf_generated).
 * @param {object|null} [params.metadata]
 */
const record = async ({ meetingLogId, eventType, actorId = null, metadata = null }) => {
  try {
    const { error } = await supabase.from("meeting_log_audit_events").insert({
      id: uuidv4(),
      meeting_log_id: meetingLogId,
      event_type: eventType,
      actor_id: actorId,
      metadata,
    });
    if (error) throw error;
  } catch (error) {
    console.error(
      `auditLog: failed to record "${eventType}" for meeting ${meetingLogId}`,
      error,
    );
  }
};

module.exports = { record, EVENT_TYPES };
