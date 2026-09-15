// Phase 5 hook point (see docs/tasks.md Phase 5, docs/meeting-flow-design.md).
// meetingLogs.js's complete() calls this the instant a meeting is finalized.
// A no-op stub today, rather than an inline `// TODO`, so Phase 5 has one
// obvious function to implement — server-side PDF generation, storing the
// result on meeting_logs.final_pdf_url and emailing it to the GC — instead of
// a call site to rediscover.
const enqueue = async (_meetingLogId) => {
  // Intentionally empty until Phase 5.
};

module.exports = { enqueue };
