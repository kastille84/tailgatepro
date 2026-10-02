// Procore / Autodesk ACC document push (Phase 9f, docs/integrations-design.md).
// A GC manager connects THEIR OWN Procore/ACC project to one jobsite by
// pasting service-account credentials; every sealed meeting-log PDF for that
// jobsite is then pushed into the project's Documents folder. Gated to Site Pro
// access (hasSiteProAccess). Credentials are AES-256-GCM encrypted at rest
// (utility/secretBox.js) and never returned to the client.
const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { encrypt } = require("../utility/secretBox");
const { hasSiteProAccess } = require("../utility/entitlements");
const { getProvider, PROVIDER_FIELDS, GC_PROVIDERS } = require("./integrations");
const { runPush: runProviderPush } = require("./integrations/pushRunner");
const jobsitesService = require("./jobsites");
const storageService = require("./storage");

const PDF_BUCKET = "meeting-pdfs";
const RECENT_PUSH_LIMIT = 20;

const INTEGRATION_COLUMNS =
  "id, jobsite_id, provider, external_project_id, external_folder_id, encrypted_credentials, status, last_error";

// Never includes the credentials, encrypted or not.
const toIntegration = (row) => ({
  id: row.id,
  provider: row.provider,
  externalProjectId: row.external_project_id,
  externalFolderId: row.external_folder_id,
  status: row.status,
  lastError: row.last_error,
});

const toPush = (row) => ({
  id: row.id,
  meetingLogId: row.meeting_log_id,
  integrationId: row.integration_id,
  status: row.status,
  error: row.error,
  attemptedAt: row.attempted_at,
});

const requireProvider = (provider) => {
  const adapter = GC_PROVIDERS.includes(provider) ? getProvider(provider) : null;
  if (!adapter) {
    throw new AppError("Unsupported integration provider", 400);
  }
  return adapter;
};

const requireSitePro = (jobsite) => {
  if (!jobsite.sitePro) {
    throw new AppError("Integrations require GC Site Pro", 403, {
      data: { code: "PLAN_REQUIRED" },
    });
  }
};

const listIntegrationRows = async (jobsiteId) => {
  const { data, error } = await supabase
    .from("jobsite_integrations")
    .select(INTEGRATION_COLUMNS)
    .eq("jobsite_id", jobsiteId);
  if (error) {
    throw new AppError("Could not load integrations", 502, { cause: error });
  }
  return data ?? [];
};

/** Connected integrations plus recent push results for one jobsite. */
const list = async ({ jobsiteId, gcCompanyId, allowedJobsiteIds = null }) => {
  const jobsite = await jobsitesService.getOwnedJobsite(
    jobsiteId,
    gcCompanyId,
    allowedJobsiteIds,
  );
  const rows = await listIntegrationRows(jobsiteId);

  let recentPushes = [];
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("integration_pushes")
      .select("id, meeting_log_id, integration_id, status, error, attempted_at")
      .in(
        "integration_id",
        rows.map((row) => row.id),
      )
      .order("attempted_at", { ascending: false })
      .limit(RECENT_PUSH_LIMIT);
    if (error) {
      throw new AppError("Could not load integration activity", 502, { cause: error });
    }
    recentPushes = (data ?? []).map(toPush);
  }

  return {
    sitePro: jobsite.sitePro,
    integrations: rows.map(toIntegration),
    recentPushes,
  };
};

/**
 * Verifies the pasted credentials against the provider, then stores them
 * encrypted. Reconnecting the same provider replaces the old row's config.
 */
const connect = async ({
  jobsiteId,
  gcCompanyId,
  allowedJobsiteIds = null,
  provider,
  credentials,
  projectId,
  folderId,
}) => {
  const adapter = requireProvider(provider);
  const jobsite = await jobsitesService.getOwnedJobsite(
    jobsiteId,
    gcCompanyId,
    allowedJobsiteIds,
  );
  requireSitePro(jobsite);

  const fields = PROVIDER_FIELDS[provider];
  const missing = fields.credentials.filter((field) => !credentials?.[field]);
  if (missing.length > 0 || !projectId || (fields.folderRequired && !folderId)) {
    throw new AppError("Missing required integration details", 400);
  }

  // Only the fields this provider uses are kept -- never an arbitrary blob.
  const creds = Object.fromEntries(
    fields.credentials.map((field) => [field, String(credentials[field])]),
  );
  const target = { projectId: String(projectId), folderId: folderId ? String(folderId) : null };

  // Throws AppError 502 when the provider rejects the credentials/project.
  await adapter.verify(creds, target);

  const { data, error } = await supabase
    .from("jobsite_integrations")
    .upsert(
      {
        id: uuidv4(),
        jobsite_id: jobsiteId,
        provider,
        external_project_id: target.projectId,
        external_folder_id: target.folderId,
        encrypted_credentials: encrypt(JSON.stringify(creds)),
        status: "connected",
        last_error: null,
      },
      { onConflict: "jobsite_id,provider" },
    )
    .select(INTEGRATION_COLUMNS)
    .single();
  if (error) {
    throw new AppError("Could not save the integration", 502, { cause: error });
  }
  return toIntegration(data);
};

const disconnect = async ({ jobsiteId, gcCompanyId, allowedJobsiteIds = null, provider }) => {
  requireProvider(provider);
  await jobsitesService.getOwnedJobsite(jobsiteId, gcCompanyId, allowedJobsiteIds);
  const { error } = await supabase
    .from("jobsite_integrations")
    .delete()
    .eq("jobsite_id", jobsiteId)
    .eq("provider", provider);
  if (error) {
    throw new AppError("Could not remove the integration", 502, { cause: error });
  }
};

// One push attempt for one integration (soft-fail, see integrations/pushRunner.js).
const runPush = (args) =>
  runProviderPush({
    ...args,
    integrationsTable: "jobsite_integrations",
    pushesTable: "integration_pushes",
  });

/**
 * Called by pdfGenerationQueue.enqueue once a meeting's PDF exists. Pushes to
 * every connected integration on the meeting's jobsite, unless the jobsite no
 * longer has Site Pro access. Soft-fail: never throws.
 */
const pushMeeting = async ({ meetingLogId, jobsiteId, pdfBuffer, filename }) => {
  try {
    if (!jobsiteId) return;

    const { data: jobsite, error } = await supabase
      .from("jobsites")
      .select("plan, companies(tier)")
      .eq("id", jobsiteId)
      .single();
    if (error) throw error;
    if (!hasSiteProAccess({ sitePlan: jobsite.plan, companyTier: jobsite.companies?.tier })) {
      return;
    }

    const rows = await listIntegrationRows(jobsiteId);
    await Promise.all(
      rows.map((integration) =>
        runPush({ integration, meetingLogId, pdfBuffer, filename }),
      ),
    );
  } catch (error) {
    console.error(
      `jobsiteIntegrations: could not push meeting ${meetingLogId}`,
      error,
    );
  }
};

/** Manual retry of a failed push; re-reads the stored PDF from storage. */
const retryPush = async ({ pushId, gcCompanyId, allowedJobsiteIds = null }) => {
  const { data: push, error } = await supabase
    .from("integration_pushes")
    .select(
      `id, meeting_log_id, filename, integration:jobsite_integrations(${INTEGRATION_COLUMNS})`,
    )
    .eq("id", pushId)
    .single();
  if (error || !push?.integration) {
    if (error && error.code !== "PGRST116") {
      throw new AppError("Could not load the push", 502, { cause: error });
    }
    throw new AppError("Push not found", 404, { cause: error });
  }

  // Ownership: the push's jobsite must belong to the caller (404 otherwise).
  const jobsite = await jobsitesService.getOwnedJobsite(
    push.integration.jobsite_id,
    gcCompanyId,
    allowedJobsiteIds,
  );
  requireSitePro(jobsite);

  const pdfBuffer = await storageService.downloadBlob(
    PDF_BUCKET,
    `${push.meeting_log_id}/report.pdf`,
  );
  const status = await runPush({
    integration: push.integration,
    meetingLogId: push.meeting_log_id,
    pdfBuffer,
    filename: push.filename ?? `${push.meeting_log_id}.pdf`,
  });
  return { status };
};

module.exports = { list, connect, disconnect, pushMeeting, retryPush };
