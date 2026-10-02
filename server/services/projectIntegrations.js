// Sub-side Procore / JobTread document push (Trade Enterprise,
// docs/integrations-design.md). A subcontractor manager connects THEIR OWN
// Procore project or JobTread job to one of their TailgatePro projects by
// pasting credentials; every sealed meeting-log PDF for that project is then
// pushed there. Gated to Trade Enterprise. Independent of the GC-side push
// (jobsiteIntegrations.js): a project linked to a GC jobsite pushes to both.
// Credentials are AES-256-GCM encrypted at rest and never returned.
const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { encrypt } = require("../utility/secretBox");
const { hasTradeEnterpriseAccess } = require("../utility/entitlements");
const { getProvider, PROVIDER_FIELDS, SUB_PROVIDERS } = require("./integrations");
const { runPush: runProviderPush } = require("./integrations/pushRunner");
const projectsService = require("./projects");
const storageService = require("./storage");

const PDF_BUCKET = "meeting-pdfs";
const RECENT_PUSH_LIMIT = 20;

const INTEGRATION_COLUMNS =
  "id, project_id, provider, external_project_id, external_folder_id, encrypted_credentials, status, last_error";

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
  const adapter = SUB_PROVIDERS.includes(provider) ? getProvider(provider) : null;
  if (!adapter) {
    throw new AppError("Unsupported integration provider", 400);
  }
  return adapter;
};

const isEnterprise = ({ companyType, tier }) =>
  hasTradeEnterpriseAccess(companyType, tier);

const requireEnterprise = (caller) => {
  if (!isEnterprise(caller)) {
    throw new AppError("Integrations require Trade Enterprise", 403, {
      data: { code: "PLAN_REQUIRED" },
    });
  }
};

const listIntegrationRows = async (projectId) => {
  const { data, error } = await supabase
    .from("project_integrations")
    .select(INTEGRATION_COLUMNS)
    .eq("project_id", projectId);
  if (error) {
    throw new AppError("Could not load integrations", 502, { cause: error });
  }
  return data ?? [];
};

/** Connected integrations plus recent push results for one project. */
const list = async ({ projectId, companyId, companyType, tier }) => {
  await projectsService.getById(projectId, companyId);
  const rows = await listIntegrationRows(projectId);

  let recentPushes = [];
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("project_integration_pushes")
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
    enterprise: isEnterprise({ companyType, tier }),
    integrations: rows.map(toIntegration),
    recentPushes,
  };
};

/**
 * Verifies the pasted credentials against the provider, then stores them
 * encrypted. Reconnecting the same provider replaces the old row's config.
 */
const connect = async ({
  projectId,
  companyId,
  companyType,
  tier,
  provider,
  credentials,
  externalProjectId,
  folderId,
}) => {
  const adapter = requireProvider(provider);
  await projectsService.getById(projectId, companyId);
  requireEnterprise({ companyType, tier });

  const fields = PROVIDER_FIELDS[provider];
  const missing = fields.credentials.filter((field) => !credentials?.[field]);
  if (missing.length > 0 || !externalProjectId || (fields.folderRequired && !folderId)) {
    throw new AppError("Missing required integration details", 400);
  }

  // Only the fields this provider uses are kept -- never an arbitrary blob.
  const creds = Object.fromEntries(
    fields.credentials.map((field) => [field, String(credentials[field])]),
  );
  const target = {
    projectId: String(externalProjectId),
    folderId: folderId ? String(folderId) : null,
  };

  // Throws AppError 502 when the provider rejects the credentials/project.
  await adapter.verify(creds, target);

  const { data, error } = await supabase
    .from("project_integrations")
    .upsert(
      {
        id: uuidv4(),
        project_id: projectId,
        provider,
        external_project_id: target.projectId,
        external_folder_id: target.folderId,
        encrypted_credentials: encrypt(JSON.stringify(creds)),
        status: "connected",
        last_error: null,
      },
      { onConflict: "project_id,provider" },
    )
    .select(INTEGRATION_COLUMNS)
    .single();
  if (error) {
    throw new AppError("Could not save the integration", 502, { cause: error });
  }
  return toIntegration(data);
};

const disconnect = async ({ projectId, companyId, provider }) => {
  requireProvider(provider);
  await projectsService.getById(projectId, companyId);
  const { error } = await supabase
    .from("project_integrations")
    .delete()
    .eq("project_id", projectId)
    .eq("provider", provider);
  if (error) {
    throw new AppError("Could not remove the integration", 502, { cause: error });
  }
};

// One push attempt for one integration (soft-fail, see integrations/pushRunner.js).
const runPush = (args) =>
  runProviderPush({
    ...args,
    integrationsTable: "project_integrations",
    pushesTable: "project_integration_pushes",
  });

/**
 * Called by pdfGenerationQueue.enqueue once a meeting's PDF exists. Pushes to
 * every connected integration on the meeting's project, unless the owning
 * company is no longer on Trade Enterprise. Soft-fail: never throws.
 */
const pushMeeting = async ({ meetingLogId, projectId, pdfBuffer, filename }) => {
  try {
    if (!projectId) return;

    const { data: project, error } = await supabase
      .from("projects")
      .select("companies:owner_company_id(tier, company_type)")
      .eq("id", projectId)
      .single();
    if (error) throw error;
    if (
      !isEnterprise({
        companyType: project.companies?.company_type,
        tier: project.companies?.tier,
      })
    ) {
      return;
    }

    const rows = await listIntegrationRows(projectId);
    await Promise.all(
      rows.map((integration) =>
        runPush({ integration, meetingLogId, pdfBuffer, filename }),
      ),
    );
  } catch (error) {
    console.error(
      `projectIntegrations: could not push meeting ${meetingLogId}`,
      error,
    );
  }
};

/** Manual retry of a failed push; re-reads the stored PDF from storage. */
const retryPush = async ({ pushId, companyId, companyType, tier }) => {
  const { data: push, error } = await supabase
    .from("project_integration_pushes")
    .select(
      `id, meeting_log_id, filename, integration:project_integrations(${INTEGRATION_COLUMNS})`,
    )
    .eq("id", pushId)
    .single();
  if (error || !push?.integration) {
    if (error && error.code !== "PGRST116") {
      throw new AppError("Could not load the push", 502, { cause: error });
    }
    throw new AppError("Push not found", 404, { cause: error });
  }

  // Ownership: the push's project must belong to the caller (404 otherwise).
  await projectsService.getById(push.integration.project_id, companyId);
  requireEnterprise({ companyType, tier });

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
