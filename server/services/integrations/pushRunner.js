// Provider-agnostic push attempt shared by the GC (jobsite) and sub (project)
// integrations: calls the adapter, records the outcome in the pushes table and
// on the integration row, and adds the audit event on success. Never throws: a
// provider outage must not fail the meeting flow (same soft-fail rule as
// pdfGenerationQueue). Returns the final push status.
const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../../utility/supabaseClient");
const { decrypt } = require("../../utility/secretBox");
const { getProvider } = require("./index");
const auditLogService = require("../auditLog");

/**
 * @param {{ integrationsTable: string, pushesTable: string }} tables
 */
const runPush = async ({
  integration,
  meetingLogId,
  pdfBuffer,
  filename,
  integrationsTable,
  pushesTable,
}) => {
  const adapter = getProvider(integration.provider);
  let status = "sent";
  let externalFileId = null;
  let errorMessage = null;
  try {
    const creds = JSON.parse(decrypt(integration.encrypted_credentials));
    const result = await adapter.push({
      creds,
      target: {
        projectId: integration.external_project_id,
        folderId: integration.external_folder_id,
      },
      pdfBuffer,
      filename,
    });
    externalFileId = result.externalFileId;
  } catch (error) {
    status = "failed";
    errorMessage = String(error.message ?? "Push failed").slice(0, 300);
    console.error(
      `integrations: ${integration.provider} push failed for meeting ${meetingLogId}`,
      error,
    );
  }

  const { error: saveError } = await supabase.from(pushesTable).upsert(
    {
      id: uuidv4(),
      meeting_log_id: meetingLogId,
      integration_id: integration.id,
      status,
      external_file_id: externalFileId,
      filename,
      error: errorMessage,
      attempted_at: new Date().toISOString(),
    },
    { onConflict: "meeting_log_id,integration_id" },
  );
  if (saveError) {
    console.error("integrations: could not record push result", saveError);
  }

  // The integration's own health follows its latest attempt.
  await supabase
    .from(integrationsTable)
    .update({
      status: status === "sent" ? "connected" : "error",
      last_error: errorMessage,
    })
    .eq("id", integration.id);

  if (status === "sent") {
    await auditLogService.record({
      meetingLogId,
      eventType: "integration_pushed",
      metadata: { provider: integration.provider, externalFileId },
    });
  }
  return status;
};

module.exports = { runPush };
